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
		backupGroup.POST("/import/uploads", func(c *gin.Context) {
			backups.CreateBackupUpload(c, dataPath)
		})
		backupGroup.PUT("/import/uploads/:uploadId", backups.AppendBackupUploadChunk)
		backupGroup.POST("/import/uploads/:uploadId/complete", func(c *gin.Context) {
			backups.CompleteBackupUpload(c, db, dataPath)
		})
		backupGroup.DELETE("/import/uploads/:uploadId", backups.DeleteBackupUpload)
		backupGroup.GET("/import/jobs/:jobId", backups.GetBackupImportJob)
	}
}
