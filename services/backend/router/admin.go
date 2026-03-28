package router

import (
	"justapps-backend/handlers/admins"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func Admin(router *gin.RouterGroup, db *bun.DB) {
	admin := router.Group("/admin").Use(middlewares.Admin(db))
	{
		// users
		admin.GET("/users", func(c *gin.Context) {
			admins.GetUsers(c, db)
		})
		admin.POST("/users", func(c *gin.Context) {
			admins.CreateUser(c, db)
		})
		admin.PUT("/users/:userID", func(c *gin.Context) {
			admins.UpdateUser(c, db)
		})
		admin.PUT("/users/:userID/state", func(c *gin.Context) {
			admins.DisableUser(c, db)
		})
		admin.DELETE("/users/:userID", func(c *gin.Context) {
			admins.DeleteUser(c, db)
		})
		// stats & audit
		admin.GET("/stats", func(c *gin.Context) {
			admins.GetStats(c, db)
		})
		admin.GET("/audit", func(c *gin.Context) {
			admins.GetAudit(c, db)
		})
		// tokens
		admin.GET("/tokens", func(c *gin.Context) {
			admins.GetTokens(c, db)
		})
		admin.PUT("/tokens/:tokenID", func(c *gin.Context) {
			admins.UpdateToken(c, db)
		})
		admin.DELETE("/tokens/:tokenID", func(c *gin.Context) {
			admins.DeleteToken(c, db)
		})
	}
}
