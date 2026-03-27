package middlewares

import (
	"database/sql"

	"justapps-backend/functions/auth"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func OptionalAuth(db *bun.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		tokenString := context.GetHeader("Authorization")
		if tokenString == "" {
			context.Next()
			return
		}

		if populateOptionalAuthContext(context, db, tokenString) {
			context.Next()
			return
		}

		context.Next()
	}
}

func populateOptionalAuthContext(context *gin.Context, db *bun.DB, tokenString string) bool {
	// Try backend-issued OIDC session token first.
	sessionClaims, err := auth.ValidateOIDCSessionToken(tokenString)
	if err == nil {
		var user models.Users
		dbErr := db.NewSelect().Model(&user).Where("email = ?", sessionClaims.Email).Scan(context)
		if dbErr != nil {
			log.Warnf("OptionalAuth: OIDC session token user %s not found in DB: %v", sessionClaims.Email, dbErr)
			return false
		}
		if user.Disabled {
			return false
		}
		context.Set("user_id", user.ID)
		context.Set("role", user.Role)
		context.Set("username", user.Username)
		context.Set("user_email", user.Email)

		return true
	}

	// Try raw Keycloak OIDC token.
	idToken, err := auth.ValidateOIDCToken(tokenString)
	if err == nil {
		claims, claimsErr := auth.GetOIDCClaims(idToken)
		if claimsErr == nil {
			context.Set("oidc_claims", claims)
			context.Set("user_email", claims.Email)
			context.Set("username", claims.PreferredUser)

			var user models.Users
			dbErr := db.NewSelect().Model(&user).Where("email = ?", claims.Email).Scan(context)
			if dbErr == nil {
				if user.Disabled {
					return false
				}
				context.Set("user_id", user.ID)
				context.Set("role", user.Role)
				context.Set("username", user.Username)
				context.Set("user_email", user.Email)
			} else {
				if auth.IsAdminOIDC(claims) {
					context.Set("role", "admin")
				} else {
					context.Set("role", "user")
				}
			}

			return true
		}
	}

	if err = auth.ValidateToken(tokenString); err != nil {
		return false
	}

	cleanToken := auth.CleanToken(tokenString)
	var dbToken models.Tokens
	err = db.NewSelect().Model(&dbToken).Where("key = ?", cleanToken).Scan(context)
	if err != nil {
		if err == sql.ErrNoRows {
			return false
		}
		return false
	}
	if dbToken.Disabled {
		return false
	}

	tokenType, err := auth.GetTypeFromToken(tokenString)
	if err != nil {
		return false
	}

	if tokenType != "user" {
		return false
	}

	userID, err := auth.GetUserIDFromToken(tokenString)
	if err != nil {
		return false
	}

	var user models.Users
	err = db.NewSelect().Model(&user).Where("id = ?", userID).Scan(context)
	if err != nil || user.Disabled {
		return false
	}

	context.Set("user_id", userID)
	context.Set("role", user.Role)
	context.Set("username", user.Username)
	context.Set("user_email", user.Email)

	return true
}
