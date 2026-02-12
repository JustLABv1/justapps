package tokens

import (
	"net/http"

	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func DeleteRunnerToken(context *gin.Context, db *bun.DB) {
	tokenID := context.Param("apikey")

	// get token from db
	var key models.Tokens
	err := db.NewSelect().Model(&key).Where("id = ?", tokenID).Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error getting token from db", err)
		return
	}

	_, err = db.NewDelete().Model(&key).Where("id = ?", tokenID).Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error deleting token from db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"result": "success"})
}
