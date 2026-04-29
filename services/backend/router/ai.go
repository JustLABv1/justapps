package router

import (
	aihandlers "justapps-backend/handlers/ai"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterAI(group *gin.RouterGroup, db *bun.DB) {
	aiGroup := group.Group("/ai")
	aiGroup.Use(middlewares.Auth(db))
	{
		aiGroup.GET("/providers", func(c *gin.Context) {
			aihandlers.ListProviders(c, db)
		})
		aiGroup.GET("/conversations", func(c *gin.Context) {
			aihandlers.ListConversations(c, db)
		})
		aiGroup.POST("/conversations", func(c *gin.Context) {
			aihandlers.CreateConversation(c, db)
		})
		aiGroup.GET("/conversations/:id", func(c *gin.Context) {
			aihandlers.GetConversation(c, db)
		})
		aiGroup.DELETE("/conversations/:id", func(c *gin.Context) {
			aihandlers.DeleteConversation(c, db)
		})
		aiGroup.POST("/chat", func(c *gin.Context) {
			aihandlers.SendMessage(c, db)
		})
		aiGroup.POST("/conversations/:conversationId/messages", func(c *gin.Context) {
			aihandlers.SendMessage(c, db)
		})
	}

	publicAIGroup := group.Group("/ai/public")
	{
		publicAIGroup.GET("/providers", func(c *gin.Context) {
			aihandlers.ListPublicProviders(c, db)
		})
		publicAIGroup.POST("/chat", middlewares.AnonymousAIChatRateLimit(), func(c *gin.Context) {
			aihandlers.SendPublicMessage(c, db)
		})
	}

	aiAdminGroup := group.Group("/ai")
	aiAdminGroup.Use(middlewares.Admin(db))
	{
		aiAdminGroup.POST("/knowledge/reindex", func(c *gin.Context) {
			aihandlers.ReindexKnowledge(c, db)
		})
	}
}
