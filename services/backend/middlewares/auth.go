package middlewares

import (
	"database/sql"
	"errors"

	"app-store-backend/functions/auth"
	"app-store-backend/functions/httperror"
	"app-store-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func Auth(db *bun.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		tokenString := context.GetHeader("Authorization")
		if tokenString == "" {
			httperror.Unauthorized(context, "Request does not contain an access token", errors.New("request does not contain an access token"))
			return
		}

		// Try backend-issued OIDC session token first (most common for OIDC users)
		sessionClaims, err := auth.ValidateOIDCSessionToken(tokenString)
		if err == nil {
			context.Set("user_email", sessionClaims.Email)
			context.Set("username", sessionClaims.PreferredUsername)
			context.Set("role", sessionClaims.Role)
			context.Next()
			return
		}

		// Try raw Keycloak OIDC token (direct Keycloak ID token, e.g. from external clients)
		idToken, err := auth.ValidateOIDCToken(tokenString)
		if err == nil {
			claims, err := auth.GetOIDCClaims(idToken)
			if err == nil {
				context.Set("oidc_claims", claims)
				context.Set("user_email", claims.Email)
				context.Set("username", claims.PreferredUser)
				if auth.IsAdminOIDC(claims) {
					context.Set("role", "admin")
				} else {
					context.Set("role", "user")
				}
				context.Next()
				return
			}
		}

		err = auth.ValidateToken(tokenString)
		if err != nil {
			httperror.Unauthorized(context, "Token is not valid", err)
			return
		}

		valid, err := auth.ValidateTokenDBEntry(tokenString, db, context)
		if err != nil {
			if err != sql.ErrNoRows {
				httperror.InternalServerError(context, "Error receiving token from db", err)
			}
			return
		}

		if !valid {
			return
		}

		tokenType, err := auth.GetTypeFromToken(tokenString)
		if err != nil {
			httperror.InternalServerError(context, "Error receiving token type", err)
			return
		}

		if tokenType == "user" {
			userId, err := auth.GetUserIDFromToken(tokenString)
			if err != nil {
				httperror.InternalServerError(context, "Error receiving userID from token", err)
				return
			}
			// get the user from the db
			var user models.Users
			err = db.NewSelect().Model(&user).Where("id = ?", userId).Scan(context)
			if err != nil {
				httperror.InternalServerError(context, "Error receiving user from db", err)
				return
			}
			if user.Disabled {
				httperror.Unauthorized(context, "Your Account is currently disabled", errors.New("user is disabled"))
				return
			}

			context.Set("user_id", userId)
			context.Set("role", user.Role)
			context.Set("username", user.Username)
			context.Set("user_email", user.Email)

			context.Next()
		} else if tokenType == "project" || tokenType == "service" {
			tokenID, err := auth.GetIDFromToken(tokenString)
			if err != nil {
				httperror.InternalServerError(context, "Error receiving tokenID from token", err)
				return
			}

			// check for token in tokens table
			var token models.Tokens
			err = db.NewSelect().Model(&token).Where("id = ?", tokenID).Scan(context)
			if err != nil {
				httperror.Unauthorized(context, "Token is not valid", err)
				return
			}
			// check if token is disabled
			if token.Disabled {
				httperror.Unauthorized(context, "Token is currently disabled", errors.New("token is disabled"))
				return
			}

			context.Next()
		} else {
			httperror.Unauthorized(context, "Token type is invalid", errors.New("invalid token type"))
		}
	}
}
