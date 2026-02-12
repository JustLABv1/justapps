package router

import (
	"justwms-backend/handlers/apps"
	"justwms-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterApps(router *gin.RouterGroup, db *bun.DB) {
	appsGroup := router.Group("/apps")
	{
		appsGroup.GET("", func(c *gin.Context) {
			apps.GetApps(c, db)
		})
		appsGroup.GET("/:id", func(c *gin.Context) {
			apps.GetApp(c, db)
		})

		// Protected routes
		protected := appsGroup.Group("")
		protected.Use(middlewares.Auth(db))
		{
			protected.POST("", func(c *gin.Context) {
				apps.CreateApp(c, db)
			})
			protected.PUT("/:id", func(c *gin.Context) {
				apps.UpdateApp(c, db)
			})
			protected.DELETE("/:id", func(c *gin.Context) {
				apps.DeleteApp(c, db)
			})
		}
	}
}
