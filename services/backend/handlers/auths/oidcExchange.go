package auths

import (
	"errors"
	"net/http"

	"justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

type oidcExchangeRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

type oidcExchangeResponse struct {
	Token     string           `json:"token"`
	ExpiresAt int64            `json:"expiresAt"`
	User      oidcExchangeUser `json:"user"`
}

type oidcExchangeUser struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	Username      string    `json:"username"`
	Role          string    `json:"role"`
	AuthType      string    `json:"authType"`
	CanSubmitApps bool      `json:"canSubmitApps"`
}

// OIDCExchange validates a Keycloak ID token and returns a long-lived
// backend-issued JWT. This eliminates the need for Keycloak refresh tokens.
//
// POST /api/v1/auth/oidc/exchange
// Body: { "id_token": "<keycloak_id_token>" }
// Response: { "token": "<backend_jwt>", "expiresAt": 1234567890, "user": {...} }
func OIDCExchange(c *gin.Context, db *bun.DB) {
	var req oidcExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Missing or invalid id_token in request body", err)
		return
	}

	// Validate the Keycloak ID token
	idToken, err := auth.ValidateOIDCToken(req.IDToken)
	if err != nil {
		log.WithError(err).Warn("OIDC Exchange: ID token validation failed")
		httperror.Unauthorized(c, "Invalid or expired Keycloak ID token", errors.New("oidc token validation failed"))
		return
	}

	// Extract claims from the validated token
	claims, err := auth.GetOIDCClaims(idToken)
	if err != nil {
		log.WithError(err).Error("OIDC Exchange: Failed to extract claims")
		httperror.InternalServerError(c, "Failed to extract user claims from token", err)
		return
	}

	// Determine role
	role := "user"
	if auth.IsAdminOIDC(claims) {
		role = "admin"
	}

	username := claims.PreferredUser
	if username == "" {
		username = claims.Email
	}

	// Check if user exists in DB
	var user models.Users
	exists, err := db.NewSelect().Model(&user).Where("email = ?", claims.Email).Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Database error checking user", err)
		return
	}

	if !exists {
		// Create new user
		user = models.Users{
			Email:         claims.Email,
			Username:      username,
			Role:          role,
			AuthType:      "oidc",
			CanSubmitApps: true,
		}
		// Set a random password since OIDC users don't use passwords
		err = user.HashPassword(uuid.NewString())
		if err != nil {
			httperror.InternalServerError(c, "Error hashing password", err)
			return
		}

		_, err = db.NewInsert().Model(&user).Column("email", "username", "password", "role", "auth_type", "can_submit_apps").Exec(c)
		if err != nil {
			httperror.InternalServerError(c, "Error creating user", err)
			return
		}

		err = db.NewSelect().Model(&user).Where("email = ?", claims.Email).Scan(c)
		if err != nil {
			httperror.InternalServerError(c, "Error fetching created user", err)
			return
		}
		if user.ID == uuid.Nil {
			httperror.InternalServerError(c, "Created user is missing an ID", errors.New("created user has empty id"))
			return
		}
		log.WithField("email", user.Email).Info("Created new OIDC user")
	} else {
		// Fetch existing user to get ID and check disabled status
		err = db.NewSelect().Model(&user).Where("email = ?", claims.Email).Scan(c)
		if err != nil {
			httperror.InternalServerError(c, "Error fetching user", err)
			return
		}

		if user.Disabled {
			log.WithField("email", user.Email).Warn("OIDC login blocked: User disabled")
			httperror.Unauthorized(c, "Account is disabled: "+user.DisabledReason, errors.New("account disabled"))
			return
		}

		// Update AuthType if needed (migration from old OIDC handling)
		if user.AuthType != "oidc" {
			user.AuthType = "oidc"
			_, err = db.NewUpdate().Model(&user).Column("auth_type").Where("id = ?", user.ID).Exec(c)
			if err != nil {
				log.WithError(err).Warn("Failed to update user auth_type")
			}
		}
	}

	if user.ID == uuid.Nil {
		httperror.InternalServerError(c, "OIDC user is missing an ID", errors.New("oidc user has empty id"))
		return
	}

	// Generate a dedicated OIDC session JWT.
	// The auth middleware resolves the live user from the database via email.
	sessionToken, expiresAt, err := auth.GenerateOIDCSessionJWT(user.Email, user.Username, user.Role)
	if err != nil {
		log.WithError(err).Error("OIDC Exchange: Failed to generate session JWT")
		httperror.InternalServerError(c, "Failed to create session token", err)
		return
	}

	log.WithFields(log.Fields{
		"email":    user.Email,
		"username": user.Username,
		"role":     user.Role,
	}).Info("OIDC Exchange: Session token issued successfully")

	c.JSON(http.StatusOK, oidcExchangeResponse{
		Token:     sessionToken,
		ExpiresAt: expiresAt,
		User: oidcExchangeUser{
			ID:            user.ID,
			Email:         user.Email,
			Username:      user.Username,
			Role:          user.Role,
			AuthType:      user.AuthType,
			CanSubmitApps: user.CanSubmitApps,
		},
	})
}
