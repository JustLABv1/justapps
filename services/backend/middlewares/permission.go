package middlewares

import (
	"errors"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
)

func RequirePermission(permission permissions.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !permissions.Has(c.GetString("role"), permission) {
			httperror.Forbidden(c, "You do not have permission to perform this action", errors.New("required permission missing"))
			c.Abort()
			return
		}
		c.Next()
	}
}
