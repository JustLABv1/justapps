package platform

import (
	"errors"

	"app-store-backend/functions/httperror"
	"app-store-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// GetSettings - Fetches the platform settings. Open to all users.
// Note: We use *models.PlatformSettings(nil) in Count/Select to ensure Bun knows the model if struct is empty
func GetSettings(c *gin.Context, db *bun.DB) {
	var settings models.PlatformSettings

	// Check if exists, if not create default
	count, _ := db.NewSelect().Model((*models.PlatformSettings)(nil)).Count(c)
	if count == 0 {
		settings = models.PlatformSettings{ID: "default", AllowAppSubmissions: true}
		db.NewInsert().Model(&settings).Exec(c)
	} else {
		err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c)
		if err != nil {
			httperror.InternalServerError(c, "Failed to retrieve settings", err)
			return
		}
	}

	c.JSON(200, settings)
}

func UpdateSettings(c *gin.Context, db *bun.DB) {
	// Check admin role
	role := c.GetString("role")
	if role != "admin" {
		httperror.Forbidden(c, "Only admins can update platform settings", errors.New("admin role required"))
		return
	}

	type UpdateRequest struct {
		AllowAppSubmissions bool `json:"allowAppSubmissions"`
	}
	var req UpdateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}

	settings := models.PlatformSettings{
		ID:                  "default",
		AllowAppSubmissions: req.AllowAppSubmissions,
	}

	// Use OnConflict to upsert just in case, but really we just update
	_, err := db.NewUpdate().
		Model(&settings).
		Column("allow_app_submissions").
		Where("id = ?", "default").
		Exec(c)

	if err != nil {
		httperror.InternalServerError(c, "Failed to update settings", err)
		return
	}

	c.JSON(200, settings)
}
