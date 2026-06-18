package apps

import (
	"net/http"

	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ListReleases(c *gin.Context, db *bun.DB) {
	if !ensureAppStoreAccess(c, db) {
		return
	}

	appID := c.Param("id")
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if _, ok := loadGitLabViewableApp(c, db, appID, viewerID, viewerRole, hasViewer); !ok {
		return
	}

	var releases []models.AppRelease
	if err := db.NewSelect().
		Model(&releases).
		Where("app_id = ?", appID).
		Order("published_at DESC").
		Limit(50).
		Scan(c.Request.Context()); err != nil {
		c.JSON(http.StatusOK, []models.AppRelease{})
		return
	}

	c.JSON(http.StatusOK, releases)
}

