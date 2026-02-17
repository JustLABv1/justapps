package admins

import (
	"net/http"

	"app-store-backend/functions/httperror"
	"app-store-backend/pkg/models"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

func GetUsers(context *gin.Context, db *bun.DB) {
	users := make([]models.Users, 0)
	err := db.NewSelect().Model(&users).ExcludeColumn("password").Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting users on db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"users": users})
}
