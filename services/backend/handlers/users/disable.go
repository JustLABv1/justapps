package users

import (
	"net/http"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func DisableUser(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var user models.Users

	user.Disabled = true
	user.UpdatedAt = time.Now()

	_, err := db.NewUpdate().Model(&user).Column("disabled", "updated_at").Where("id = ?", userID).Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error disable user on db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"result": "success"})
}
