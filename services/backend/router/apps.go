package router

import (
	"app-store-backend/handlers/apps"
	"app-store-backend/middlewares"

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
		appsGroup.GET("/:id/ratings", func(c *gin.Context) {
			apps.GetRatings(c, db)
		})
		appsGroup.POST("/:id/ratings", func(c *gin.Context) {
			apps.AddRating(c, db)
		})
		appsGroup.DELETE("/:id/ratings/:ratingId", func(c *gin.Context) {
			apps.DeleteRating(c, db)
		})

		// Protected routes
		protected := appsGroup.Group("")
		protected.Use(middlewares.Admin(db))
		{
			protected.GET("/export", func(c *gin.Context) {
				apps.ExportApps(c, db)
			})
			protected.POST("/import", func(c *gin.Context) {
				apps.ImportApps(c, db)
			})
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
