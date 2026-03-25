package router

import (
	"justapps-backend/handlers/apps"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterApps(router *gin.RouterGroup, db *bun.DB) {
	appsGroup := router.Group("/apps")
	{
		appsGroup.GET("", middlewares.OptionalAuth(db), func(c *gin.Context) {
			apps.GetApps(c, db)
		})
		appsGroup.GET("/:id", middlewares.OptionalAuth(db), func(c *gin.Context) {
			apps.GetApp(c, db)
		})
		appsGroup.GET("/:id/ratings", func(c *gin.Context) {
			apps.GetRatings(c, db)
		})

		// Rating modifications require Auth
		ratingAuthGroup := appsGroup.Group("/:id/ratings")
		ratingAuthGroup.Use(middlewares.Auth(db))
		{
			ratingAuthGroup.POST("", func(c *gin.Context) {
				apps.AddRating(c, db)
			})
			ratingAuthGroup.DELETE("/:ratingId", func(c *gin.Context) {
				apps.DeleteRating(c, db)
			})
		}

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

		// Transfer ownership — admin only
		transferGroup := appsGroup.Group("/:id/transfer")
		transferGroup.Use(middlewares.Admin(db))
		{
			transferGroup.PUT("", func(c *gin.Context) {
				apps.TransferApp(c, db)
			})
		}

		// 3. Related apps — read is public, write requires auth
		appsGroup.GET("/:id/related", middlewares.OptionalAuth(db), func(c *gin.Context) {
			apps.GetRelatedApps(c, db)
		})
		relatedAuthGroup := appsGroup.Group("/:id/related")
		relatedAuthGroup.Use(middlewares.Auth(db))
		{
			relatedAuthGroup.POST("", func(c *gin.Context) {
				apps.AddRelatedApp(c, db)
			})
			relatedAuthGroup.DELETE("/:relatedId", func(c *gin.Context) {
				apps.RemoveRelatedApp(c, db)
			})
		}
	}

	// App groups — read is public, write requires admin
	groupsGroup := router.Group("/app-groups")
	{
		groupsGroup.GET("", func(c *gin.Context) {
			apps.ListGroups(c, db)
		})
		groupsGroup.GET("/:groupId/members", middlewares.OptionalAuth(db), func(c *gin.Context) {
			apps.GetGroupMembers(c, db)
		})

		groupsAdminGroup := groupsGroup.Group("")
		groupsAdminGroup.Use(middlewares.Admin(db))
		{
			groupsAdminGroup.POST("", func(c *gin.Context) {
				apps.CreateGroup(c, db)
			})
			groupsAdminGroup.PUT("/:groupId", func(c *gin.Context) {
				apps.UpdateGroup(c, db)
			})
			groupsAdminGroup.DELETE("/:groupId", func(c *gin.Context) {
				apps.DeleteGroup(c, db)
			})
			groupsAdminGroup.POST("/:groupId/members", func(c *gin.Context) {
				apps.AddGroupMember(c, db)
			})
			groupsAdminGroup.DELETE("/:groupId/members/:appId", func(c *gin.Context) {
				apps.RemoveGroupMember(c, db)
			})
		}
	}
}
