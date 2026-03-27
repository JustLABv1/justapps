package users

import (
	"net/http"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	_ "github.com/lib/pq"
	"github.com/uptrace/bun"

	"github.com/gin-gonic/gin"
)

func ChangeUserDetails(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var user models.Users
	if err := context.ShouldBindJSON(&user); err != nil {
		httperror.StatusBadRequest(context, "Error parsing incoming data", err)
		return
	}

	_, err := db.NewUpdate().Model(&user).Column("username", "email").Where("id = ?", userID).Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error updating user on db", err)
		return
	}

	context.JSON(http.StatusCreated, gin.H{"result": "success"})
}
