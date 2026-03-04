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

		// Partially protected or Admin-only routes?
		// 1. Export, Import -> Clearly Admin
		adminGroup := appsGroup.Group("")
		adminGroup.Use(middlewares.Admin(db))
		{
			adminGroup.GET("/export", func(c *gin.Context) {
				apps.ExportApps(c, db)
			})
			adminGroup.POST("/import", func(c *gin.Context) {
				apps.ImportApps(c, db)
			})
		}

		// 2. Create, Update, Delete -> Now available for standard Users (with ownership checks inside handlers)
		userGroup := appsGroup.Group("")
		userGroup.Use(middlewares.Auth(db))
		{
			userGroup.POST("", func(c *gin.Context) {
				apps.CreateApp(c, db)
			})
			userGroup.PUT("/:id", func(c *gin.Context) {
				apps.UpdateApp(c, db)
			})
			userGroup.DELETE("/:id", func(c *gin.Context) {
				apps.DeleteApp(c, db)
			})
		}
	}
}
