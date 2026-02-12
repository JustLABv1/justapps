package apps

import (
	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func CreateApp(c *gin.Context, db *bun.DB) {
	var app models.Apps
	if err := c.ShouldBindJSON(&app); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}

	_, err := db.NewInsert().Model(&app).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error creating app", err)
		return
	}

	c.JSON(201, app)
}

func UpdateApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")
	var app models.Apps
	if err := c.ShouldBindJSON(&app); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}
	app.ID = id

	_, err := db.NewUpdate().Model(&app).Where("id = ?", id).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error updating app", err)
		return
	}

	c.JSON(200, app)
}

func DeleteApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")
	_, err := db.NewDelete().Model((*models.Apps)(nil)).Where("id = ?", id).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error deleting app", err)
		return
	}

	c.Status(204)
}
