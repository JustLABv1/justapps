package tokens

import (
	"net/http"

	"justwms-backend/functions/auth"
	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ValidateToken(context *gin.Context, db *bun.DB) {
	token := context.GetHeader("Authorization")
	err := auth.ValidateToken(token)
	if err != nil {
		httperror.Unauthorized(context, "Token is invalid", err)
		return
	}

	userID, err := auth.GetUserIDFromToken(token)
	if err != nil {
		httperror.Unauthorized(context, "Token is invalid", err)
		return
	}

	// check for token in db
	var dbToken models.Tokens
	err = db.NewSelect().Model(&dbToken).Where("user_id = ?", userID).Scan(context)
	if err != nil {
		httperror.Unauthorized(context, "No token found", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"result": "success"})
}
