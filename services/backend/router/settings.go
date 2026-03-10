package router

import (
	"just-apps-backend/handlers/platform"
	"just-apps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterSettings(group *gin.RouterGroup, db *bun.DB) {
	settings := group.Group("/settings")
	settings.Use(middlewares.Auth(db))
	{
		settings.GET("", func(c *gin.Context) {
			platform.GetSettings(c, db)
		})
		settings.PUT("", func(c *gin.Context) {
			platform.UpdateSettings(c, db)
		})
	}
}
