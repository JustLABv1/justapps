package router

import (
	"justapps-backend/handlers/apps"
	"justapps-backend/middlewares"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterFAQ(router *gin.RouterGroup, db *bun.DB) {
	// Bedarfsmeldungen: what people are looking for.
	requests := router.Group("/requests")
	requests.GET("", middlewares.OptionalAuth(db), func(c *gin.Context) { apps.ListRequests(c, db) })
	requests.GET("/:id", middlewares.OptionalAuth(db), func(c *gin.Context) { apps.GetRequest(c, db) })
	requests.POST("", middlewares.Auth(db), func(c *gin.Context) { apps.CreateRequest(c, db) })
	requests.PATCH("/:id", middlewares.Auth(db), func(c *gin.Context) { apps.UpdateRequest(c, db) })
	requests.DELETE("/:id", middlewares.Auth(db), func(c *gin.Context) { apps.DeleteRequest(c, db) })
	requests.POST("/:id/vote", middlewares.Auth(db), func(c *gin.Context) { apps.SetRequestVote(c, db, true) })
	requests.DELETE("/:id/vote", middlewares.Auth(db), func(c *gin.Context) { apps.SetRequestVote(c, db, false) })

	faq := router.Group("/faq")
	faq.GET("", middlewares.OptionalAuth(db), func(c *gin.Context) { apps.GetGlobalFAQ(c, db) })
	faq.GET("/insights", middlewares.Auth(db), middlewares.RequirePermission(permissions.ViewFAQInsights), func(c *gin.Context) { apps.GetFAQInsights(c, db) })
	faq.GET("/questions/:questionId/answers", middlewares.OptionalAuth(db), func(c *gin.Context) { apps.GetGlobalFAQAnswers(c, db) })

	questions := faq.Group("/questions")
	questions.Use(middlewares.Auth(db))
	questions.POST("", func(c *gin.Context) { apps.CreateGlobalFAQQuestion(c, db) })
	questions.DELETE("/:questionId", func(c *gin.Context) { apps.DeleteGlobalFAQQuestion(c, db) })
	questions.POST("/:questionId/answers", func(c *gin.Context) { apps.CreateGlobalFAQAnswer(c, db) })
	questions.DELETE("/:questionId/answers/:answerId", func(c *gin.Context) { apps.DeleteGlobalFAQAnswer(c, db) })

	answers := faq.Group("/answers/:answerId")
	answers.Use(middlewares.Auth(db))
	answers.PATCH("/acceptance", func(c *gin.Context) { apps.SetFAQAnswerAcceptance(c, db, true) })
	answers.POST("/upvote", func(c *gin.Context) { apps.SetGlobalFAQAnswerUpvote(c, db, true) })
	answers.DELETE("/upvote", func(c *gin.Context) { apps.SetGlobalFAQAnswerUpvote(c, db, false) })
	answers.PATCH("", func(c *gin.Context) { apps.UpdateGlobalFAQAnswerHighlights(c, db) })
}
