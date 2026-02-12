package router

import (
	"justwms-backend/handlers/tokens"
	"justwms-backend/middlewares"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func Token(router *gin.RouterGroup, db *bun.DB) {
	token := router.Group("/token")
	{
		token.GET("/validate", middlewares.Auth(db), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"result": "success"})
		})
		token.POST("/refresh", func(c *gin.Context) {
			tokens.RefreshToken(c, db)
		})
		token.PUT("/:id", func(c *gin.Context) {
			tokens.UpdateToken(c, db)
		})
	}
}
