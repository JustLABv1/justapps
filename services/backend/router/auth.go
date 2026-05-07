package router

import (
	"justapps-backend/handlers/auths"
	"justapps-backend/handlers/tokens"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func Auth(router *gin.RouterGroup, db *bun.DB) {
	auth := router.Group("/auth")
	{
		auth.POST("/login", func(c *gin.Context) {
			tokens.GenerateTokenUser(db, c)
		})
		auth.POST("/register", func(c *gin.Context) {
			auths.RegisterUser(c, db)
		})
		auth.POST("/user/taken", func(c *gin.Context) {
			auths.CheckUserTaken(c, db)
		})
		auth.POST("/oidc/exchange", func(c *gin.Context) {
			auths.OIDCExchange(c, db)
		})
		auth.GET("/oidc/providers", func(c *gin.Context) {
			auths.ListOIDCProviders(c, db)
		})
		auth.GET("/oidc/:key/start", func(c *gin.Context) {
			auths.StartOIDCLogin(c, db)
		})
		auth.GET("/oidc/:key/callback", func(c *gin.Context) {
			auths.HandleOIDCCallback(c, db)
		})
	}
}
