package middlewares

import (
	"database/sql"
	"errors"

	"justapps-backend/functions/auth"
	"justapps-backend/functions/gatekeeper"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func Admin(db *bun.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		tokenString := context.GetHeader("Authorization")
		if tokenString == "" {
			httperror.Unauthorized(context, "Request does not contain an access token", errors.New("request does not contain an access token"))
			return
		}

		// Try backend-issued OIDC session token first (most common for OIDC users)
		sessionClaims, err := auth.ValidateOIDCSessionToken(tokenString)
		if err == nil {
			var user models.Users
			dbErr := db.NewSelect().Model(&user).Where("email = ?", sessionClaims.Email).Scan(context)
			if dbErr != nil {
				log.WithError(dbErr).Warnf("Admin Auth: OIDC session token user %s not found in DB", sessionClaims.Email)
				httperror.Unauthorized(context, "OIDC session token is not linked to a valid admin user", errors.New("oidc session user not found"))
				return
			}
			if user.Disabled {
				httperror.Unauthorized(context, "Your Account is currently disabled", errors.New("user is disabled"))
				return
			}
			if user.Role == "admin" {
				context.Set("user_id", user.ID)
				context.Set("user_email", user.Email)
				context.Set("username", user.Username)
				context.Set("role", user.Role)
				context.Next()
				return
			}
			log.Warn("Admin Auth: OIDC session token valid but user is not an admin")
			httperror.Unauthorized(context, "You are not an admin", errors.New("not an admin"))
			return
		}

		// Try raw Keycloak OIDC token (direct Keycloak ID token, e.g. from external clients)
		idToken, err := auth.ValidateOIDCToken(tokenString)
		if err == nil {
			claims, err := auth.GetOIDCClaims(idToken)
			if err == nil {
				if auth.IsAdminOIDC(claims) {
					var user models.Users
					dbErr := db.NewSelect().Model(&user).Where("email = ?", claims.Email).Scan(context)
					if dbErr != nil {
						log.WithError(dbErr).Warnf("Admin Auth: OIDC admin user %s not found in DB", claims.Email)
						httperror.Unauthorized(context, "OIDC admin user is not provisioned in the backend", errors.New("oidc admin user not found"))
						return
					}
					if user.Disabled {
						httperror.Unauthorized(context, "Your Account is currently disabled", errors.New("user is disabled"))
						return
					}
					if user.Role != "admin" {
						httperror.Unauthorized(context, "You are not an admin", errors.New("not an admin"))
						return
					}
					context.Set("oidc_claims", claims)
					context.Set("user_id", user.ID)
					context.Set("user_email", user.Email)
					context.Set("username", user.Username)
					context.Set("role", user.Role)
					context.Next()
					return
				}
				log.Warn("Admin Auth: OIDC token valid but user is not an admin")
				httperror.Unauthorized(context, "You are not an admin (OIDC)", errors.New("not an admin"))
				return
			}
		}

		// Only attempt local JWT if OIDC checks did not match
		err = auth.ValidateToken(tokenString)
		if err != nil {
			log.WithError(err).Warn("Admin Auth: Token validation failed (JWT)")
			httperror.Unauthorized(context, "Token is not valid (JWT)", err)
			return
		}

		valid, err := auth.ValidateTokenDBEntry(tokenString, db, context)
		if err != nil {
			if err != sql.ErrNoRows {
				log.WithError(err).Error("Admin Auth: DB validation error")
				httperror.InternalServerError(context, "Error receiving token from db", err)
			}
			return
		}

		if !valid {
			log.Warn("Admin Auth: Token not valid in DB")
			return
		}

		tokenType, err := auth.GetTypeFromToken(tokenString)
		if err != nil {
			log.WithError(err).Error("Admin Auth: Error getting token type")
			httperror.InternalServerError(context, "Error receiving token type", err)
			return
		}

		log.WithField("tokenType", tokenType).Info("Admin Auth: Processing token")

		if tokenType == "user" {
			// check if user is admin on db | second layer check
			userID, err := auth.GetUserIDFromToken(tokenString)
			if err != nil {
				log.WithError(err).Error("Admin Auth: Error getting userID from token")
				httperror.InternalServerError(context, "Error receiving userID from token", err)
				return
			}
			log.WithField("userID", userID).Info("Admin Auth: Checking admin role")
			isAdmin, err := gatekeeper.CheckAdmin(userID, db)
			if err != nil {
				log.WithError(err).Error("Admin Auth: Error checking admin role")
				httperror.InternalServerError(context, "Error checking for user role", err)
				return
			}
			if !isAdmin {
				log.WithField("userID", userID).Warn("Admin Auth: User is not an admin")
				httperror.Unauthorized(context, "You are not an admin (Role check)", errors.New("user is not admin"))
				return
			}

			// get the user from the db
			var user models.Users
			err = db.NewSelect().Model(&user).Where("id = ?", userID).Scan(context)
			if err != nil {
				httperror.InternalServerError(context, "Error receiving user from db", err)
				return
			}

			context.Set("user_id", userID)
			context.Set("role", user.Role)
			context.Set("username", user.Username)
			context.Set("user_email", user.Email)

			context.Next()
		} else if tokenType == "service" {
			tokenID, err := auth.GetIDFromToken(tokenString)
			if err != nil {
				httperror.InternalServerError(context, "Error receiving tokenID from token", err)
				return
			}

			// check for token in tokens table
			var token models.Tokens
			err = db.NewSelect().Model(&token).Where("id = ?", tokenID).Scan(context)
			if err != nil {
				httperror.Unauthorized(context, "Token is not valid (Service check)", err)
				return
			}
			// check if token is disabled
			if token.Disabled {
				httperror.Unauthorized(context, "Token is currently disabled", errors.New("token is disabled"))
				return
			}

			context.Next()
		} else {
			httperror.Unauthorized(context, "Token is not valid (Unknown type)", errors.New("token is not valid"))
			return
		}
	}
}
