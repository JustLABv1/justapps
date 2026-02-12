package admins

import (
	"net/http"

	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

func DeleteUser(context *gin.Context, db *bun.DB) {
	userID := context.Param("userID")

	_, err := db.NewDelete().Model(&models.Users{}).Where("id = ?", userID).Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error deleting user on db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"result": "success"})
}
