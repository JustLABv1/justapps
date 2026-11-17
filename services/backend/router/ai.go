package router

import (
	aihandlers "justapps-backend/handlers/ai"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterAI(group *gin.RouterGroup, db *bun.DB) {
	aiAdminGroup := group.Group("/ai")
	aiAdminGroup.Use(middlewares.Admin(db))
	{
		aiAdminGroup.POST("/knowledge/reindex", func(c *gin.Context) {
			aihandlers.ReindexKnowledge(c, db)
		})
	}
}
