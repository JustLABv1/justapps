package router

import (
	"just-apps-backend/handlers/upload"
	"just-apps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func RegisterUploads(v1 *gin.RouterGroup, db *bun.DB, dataPath string) {
	// Admin-only upload endpoint (requires auth)
	v1.POST("/upload/logo", middlewares.Auth(db), func(c *gin.Context) {
		upload.UploadLogo(c, dataPath)
	})

	// Public static file serving for uploaded assets
	v1.GET("/uploads/:filename", func(c *gin.Context) {
		upload.ServeUpload(c, dataPath)
	})
}
