package apps

import (
	"app-store-backend/functions/httperror"
	"app-store-backend/pkg/models"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func CreateApp(c *gin.Context, db *bun.DB) {
	var app models.Apps
	if err := c.ShouldBindJSON(&app); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}
	app.UpdatedAt = time.Now()

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
	app.UpdatedAt = time.Now()

	_, err := db.NewUpdate().
		Model(&app).
		Where("id = ?", id).
		Column(
			"name", "description", "categories", "live_url", "repo_url",
			"repositories", "custom_links",
			"helm_repo", "docker_repo", "docs_url", "icon", "tech_stack",
			"license", "markdown_content", "focus", "app_type", "use_case",
			"visualization", "deployment", "infrastructure", "database",
			"additional_info", "status", "transferability", "contact_person",
			"custom_docker_command", "custom_compose_command", "custom_helm_command",
			"custom_docker_note", "custom_compose_note", "custom_helm_note",
			"has_deployment_assistant", "show_docker", "show_compose", "show_helm",
			"tags", "collections", "is_featured", "live_demos", "updated_at",
		).
		Exec(c)
	if err != nil {
		log.Errorf("Database error during app update (ID: %s): %v", id, err)
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
