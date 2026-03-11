package router

import (
	"just-apps-backend/handlers/platform"
	"just-apps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterSettings(group *gin.RouterGroup, db *bun.DB) {
	settings := group.Group("/settings")
	{
		// Public: branding and store config is needed by all visitors
		settings.GET("", func(c *gin.Context) {
			platform.GetSettings(c, db)
		})
		// Admin-only: write requires authentication
		settings.PUT("", middlewares.Auth(db), func(c *gin.Context) {
			platform.UpdateSettings(c, db)
		})
	}
}
