package auths

import (
	"errors"
	"net/http"

	"app-store-backend/functions/auth"
	"app-store-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
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
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// OIDCExchange validates a Keycloak ID token and returns a long-lived
// backend-issued JWT. This eliminates the need for Keycloak refresh tokens.
//
// POST /api/v1/auth/oidc/exchange
// Body: { "id_token": "<keycloak_id_token>" }
// Response: { "token": "<backend_jwt>", "expiresAt": 1234567890, "user": {...} }
func OIDCExchange(c *gin.Context) {
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

	// Generate a backend-issued session JWT (valid for 8 hours)
	sessionToken, expiresAt, err := auth.GenerateOIDCSessionJWT(claims.Email, username, role)
	if err != nil {
		log.WithError(err).Error("OIDC Exchange: Failed to generate session JWT")
		httperror.InternalServerError(c, "Failed to create session token", err)
		return
	}

	log.WithFields(log.Fields{
		"email":    claims.Email,
		"username": username,
		"role":     role,
	}).Info("OIDC Exchange: Session token issued successfully")

	c.JSON(http.StatusOK, oidcExchangeResponse{
		Token:     sessionToken,
		ExpiresAt: expiresAt,
		User: oidcExchangeUser{
			Email:    claims.Email,
			Username: username,
			Role:     role,
		},
	})
}
