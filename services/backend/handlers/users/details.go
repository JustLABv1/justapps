package users

import (
	"net/http"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	_ "github.com/lib/pq"
	"github.com/uptrace/bun"

	"github.com/gin-gonic/gin"
)

func GetUserDetails(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var user models.Users
	err := db.NewSelect().Model(&user).Column("id", "username", "email", "role", "created_at", "updated_at", "can_submit_apps", "auth_type").Where("id = ?", userID).Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting user data from db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"result": "success", "user": user})
}
