package router

import (
	"justapps-backend/handlers/platform"
	"justapps-backend/middlewares"

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

		// Auth-only: available providers for app editors (non-sensitive summaries).
		// /gitlab/* paths are kept as legacy aliases; new clients should use /repository-providers/*.
		settings.GET("/gitlab/providers/available", middlewares.Auth(db), func(c *gin.Context) {
			platform.ListAvailableGitLabProviders(c, db)
		})
		settings.GET("/repository-providers/available", middlewares.Auth(db), func(c *gin.Context) {
			platform.ListAvailableGitLabProviders(c, db)
		})

		gitlabProviders := settings.Group("/gitlab/providers")
		gitlabProviders.Use(middlewares.Admin(db))
		{
			gitlabProviders.GET("", func(c *gin.Context) {
				platform.ListGitLabProviders(c, db)
			})
			gitlabProviders.PUT("/:key", func(c *gin.Context) {
				platform.UpdateGitLabProvider(c, db)
			})
		}

		repositoryProviders := settings.Group("/repository-providers")
		repositoryProviders.Use(middlewares.Admin(db))
		{
			repositoryProviders.GET("", func(c *gin.Context) {
				platform.ListGitLabProviders(c, db)
			})
			repositoryProviders.POST("", func(c *gin.Context) {
				platform.CreateGitLabProvider(c, db)
			})
			repositoryProviders.PUT("/:key", func(c *gin.Context) {
				platform.UpdateGitLabProvider(c, db)
			})
			repositoryProviders.DELETE("/:key", func(c *gin.Context) {
				platform.DeleteGitLabProvider(c, db)
			})
		}
	}
}
