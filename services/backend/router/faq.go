package router

import (
	"justapps-backend/handlers/apps"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterFAQ(router *gin.RouterGroup, db *bun.DB) {
	faq := router.Group("/faq")
	faq.GET("", middlewares.OptionalAuth(db), func(c *gin.Context) { apps.GetGlobalFAQ(c, db) })
	faq.GET("/questions/:questionId/answers", middlewares.OptionalAuth(db), func(c *gin.Context) { apps.GetGlobalFAQAnswers(c, db) })

	questions := faq.Group("/questions")
	questions.Use(middlewares.Auth(db))
	questions.POST("", func(c *gin.Context) { apps.CreateGlobalFAQQuestion(c, db) })
	questions.DELETE("/:questionId", func(c *gin.Context) { apps.DeleteGlobalFAQQuestion(c, db) })
	questions.POST("/:questionId/answers", func(c *gin.Context) { apps.CreateGlobalFAQAnswer(c, db) })
	questions.DELETE("/:questionId/answers/:answerId", func(c *gin.Context) { apps.DeleteGlobalFAQAnswer(c, db) })

	answers := faq.Group("/answers/:answerId")
	answers.Use(middlewares.Auth(db))
	answers.POST("/upvote", func(c *gin.Context) { apps.SetGlobalFAQAnswerUpvote(c, db, true) })
	answers.DELETE("/upvote", func(c *gin.Context) { apps.SetGlobalFAQAnswerUpvote(c, db, false) })
	answers.PATCH("", func(c *gin.Context) { apps.UpdateGlobalFAQAnswerHighlights(c, db) })
}
