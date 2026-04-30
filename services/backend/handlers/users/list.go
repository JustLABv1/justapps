package users

import (
	"net/http"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ListSelectableUsers(context *gin.Context, db *bun.DB) {
	users := make([]models.Users, 0)
	err := db.NewSelect().Model(&users).
		Column("id", "username", "email", "role", "auth_type", "can_submit_apps", "disabled").
		Where("disabled = FALSE").
		OrderExpr("LOWER(username) ASC, LOWER(email) ASC").
		Scan(context.Request.Context())
	if err != nil {
		httperror.InternalServerError(context, "Error collecting users on db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"users": users})
}
