package apps

import (
	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func GetApps(c *gin.Context, db *bun.DB) {
	var apps []models.Apps
	err := db.NewSelect().Model(&apps).Scan(c)
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
