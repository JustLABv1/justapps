package apps

import (
	"justapps-backend/pkg/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ExportApps(c *gin.Context, db *bun.DB) {
	var apps []models.Apps
	err := db.NewSelect().Model(&apps).Scan(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch apps"})
		return
	}

	for index := range apps {
		normalizeAppModelStatus(&apps[index])
		normalizeAppDetailFields(&apps[index])
	}

	c.JSON(http.StatusOK, apps)
}

func ImportApps(c *gin.Context, db *bun.DB) {
	var apps []models.Apps
	if err := c.ShouldBindJSON(&apps); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
		return
	}

	if len(apps) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No apps to import"})
		return
	}

	// Use a transaction for safe import
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	importedDrafts := 0

	for _, app := range apps {
		normalizeAppModelStatus(&app)
		normalizeAppDetailFields(&app)
		if IsDraftStatus(app.Status) {
			importedDrafts++
		}

		// Check if app exists
		exists, err := tx.NewSelect().Model((*models.Apps)(nil)).Where("id = ?", app.ID).Exists(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		if exists {
			_, err = tx.NewUpdate().Model(&app).Where("id = ?", app.ID).Exec(c.Request.Context())
		} else {
			_, err = tx.NewInsert().Model(&app).Exec(c.Request.Context())
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to import app: " + app.ID})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Apps wurden erfolgreich importiert",
		"importedCount": len(apps),
		"draftCount":    importedDrafts,
	})
}
