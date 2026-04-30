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
		appsGroup.GET("/:id/gitlab", middlewares.OptionalAuth(db), func(c *gin.Context) {
			apps.GetGitLabIntegration(c, db)
		})
		appsGroup.GET("/:id/repository", middlewares.OptionalAuth(db), func(c *gin.Context) {
			apps.GetGitLabIntegration(c, db)
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

		// Create, Update, Delete -> available for standard users with ownership checks inside handlers.
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
			userGroup.GET("/:id/editors", func(c *gin.Context) {
				apps.ListAppEditors(c, db)
			})
			userGroup.PUT("/:id/editors", func(c *gin.Context) {
				apps.ReplaceAppEditors(c, db)
			})
		}

		gitlabGroup := appsGroup.Group("/:id/gitlab")
		gitlabGroup.Use(middlewares.Auth(db))
		{
			gitlabGroup.PUT("", func(c *gin.Context) {
				apps.UpsertGitLabIntegration(c, db)
			})
			gitlabGroup.POST("/sync", func(c *gin.Context) {
				apps.SyncGitLabIntegration(c, db)
			})
			gitlabGroup.POST("/approve", func(c *gin.Context) {
				apps.ApproveGitLabIntegration(c, db)
			})
			gitlabGroup.DELETE("", func(c *gin.Context) {
				apps.DeleteGitLabIntegration(c, db)
			})
		}

		repositoryGroup := appsGroup.Group("/:id/repository")
		repositoryGroup.Use(middlewares.Auth(db))
		{
			repositoryGroup.PUT("", func(c *gin.Context) {
				apps.UpsertGitLabIntegration(c, db)
			})
			repositoryGroup.POST("/sync", func(c *gin.Context) {
				apps.SyncGitLabIntegration(c, db)
			})
			repositoryGroup.POST("/approve", func(c *gin.Context) {
				apps.ApproveGitLabIntegration(c, db)
			})
			repositoryGroup.DELETE("", func(c *gin.Context) {
				apps.DeleteGitLabIntegration(c, db)
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

		// Favorites — requires auth
		favGroup := appsGroup.Group("/:id/favorite")
		favGroup.Use(middlewares.Auth(db))
		{
			favGroup.POST("", func(c *gin.Context) {
				apps.AddFavorite(c, db)
			})
			favGroup.DELETE("", func(c *gin.Context) {
				apps.RemoveFavorite(c, db)
			})
		}

		// Related apps — read is public, write requires auth
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
