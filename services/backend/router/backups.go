package router

import (
	"justapps-backend/handlers/backups"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterBackups(router *gin.RouterGroup, db *bun.DB, dataPath string) {
	backupGroup := router.Group("/admin/backups")
	backupGroup.Use(middlewares.Admin(db))
	{
		backupGroup.POST("/export", func(c *gin.Context) {
			backups.ExportBackup(c, db, dataPath)
		})
		backupGroup.POST("/import", func(c *gin.Context) {
			backups.ImportBackup(c, db, dataPath)
		})
	}
}
