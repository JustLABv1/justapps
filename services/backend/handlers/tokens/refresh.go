package tokens

import (
	"net/http"
	"strings"

	"justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RefreshToken(context *gin.Context, db *bun.DB) {
	token := auth.TokenFromRequest(context)
	newToken, expiresAt, err := auth.RefreshToken(token)
	if err != nil {
		if err.Error() == "token is not close to expiration" {
			httperror.StatusBadRequest(context, "Token is not close to expiration", err)
			return
		}
		httperror.InternalServerError(context, "Error refreshing active token", err)
		return
	}

	userID, err := auth.GetUserIDFromToken(newToken)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting userID from token", err)
		return
	}

	var user models.Users
	err = db.NewSelect().Model(&user).Column("id", "username", "email", "disabled", "role").Where("id = ?", userID).Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting user informations from db", err)
		return
	}

	// update the expired time in tokens table
	_, err = db.NewUpdate().Model(&models.Tokens{}).Set("expires_at = ?, key = ?", expiresAt, newToken).
		Where("key = ?", auth.CleanToken(token)).Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error updating token expiration time", err)
		return
	}

	auth.SetSessionCookie(context, newToken, expiresAt)
	response := gin.H{"result": "success", "expires_at": expiresAt, "user": user}
	// Keep explicit bearer-token refresh usable for API clients without making
	// browser clients handle the JWT in JavaScript.
	if strings.TrimSpace(context.GetHeader("Authorization")) != "" {
		response["token"] = newToken
	}
	context.JSON(http.StatusOK, response)
}
