package admins

import (
	"net/http"

	"just-apps-backend/functions/httperror"
	"just-apps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

func GetTokens(context *gin.Context, db *bun.DB) {
	tokens := make([]models.Tokens, 0)
	err := db.NewSelect().Model(&tokens).Order("expires_at ASC").Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting tokens on db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"tokens": tokens})
}
