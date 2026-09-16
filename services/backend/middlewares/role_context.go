package middlewares

import (
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func setAuthenticatedUserContext(c *gin.Context, db *bun.DB, user models.Users) bool {
	if err := permissions.LoadRole(c.Request.Context(), db, user.Role); err != nil {
		httperror.InternalServerError(c, "Error loading role permissions", err)
		c.Abort()
		return false
	}
	c.Set("user_id", user.ID)
	c.Set("role", user.Role)
	c.Set("username", user.Username)
	c.Set("user_email", user.Email)
	return true
}
