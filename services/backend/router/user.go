package router

import (
	"justwms-backend/handlers/users"
	"justwms-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func User(router *gin.RouterGroup, db *bun.DB) {
	user := router.Group("/user").Use(middlewares.Auth(db))
	{
		user.GET("/", func(c *gin.Context) {
			users.GetUserDetails(c, db)
		})

		user.PUT("/", func(c *gin.Context) {
			users.ChangeUserDetails(c, db)
		})
		user.PUT("/password", func(c *gin.Context) {
			users.ChangeUserPassword(c, db)
		})
		user.PUT("/disable", func(c *gin.Context) {
			users.DisableUser(c, db)
		})

		user.DELETE("/", func(c *gin.Context) {
			users.DeleteUser(c, db)
		})
	}
}
