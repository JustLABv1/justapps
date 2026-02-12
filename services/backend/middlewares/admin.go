package middlewares

import (
	"database/sql"
	"errors"

	"justwms-backend/functions/auth"
	"justwms-backend/functions/gatekeeper"
	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"

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

		err := auth.ValidateToken(tokenString)
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
