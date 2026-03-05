package apps

import (
	"app-store-backend/functions/httperror"
	"app-store-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func GetApps(c *gin.Context, db *bun.DB) {
	apps := make([]models.Apps, 0)
	err := db.NewSelect().
		Model(&apps).
		Relation("Owner").
		Order("is_featured DESC", "name ASC").
		Scan(c)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching apps", err)
		return
	}

	c.JSON(200, apps)
}

func GetApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")
	var app models.Apps
	err := db.NewSelect().Model(&app).Where("id = ?", id).Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return
	}

	c.JSON(200, app)
}
