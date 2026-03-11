package apps

import (
	"errors"
	"time"

	"just-apps-backend/functions/httperror"
	"just-apps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func CreateApp(c *gin.Context, db *bun.DB) {
	// 1. Get User ID from Context (set by Auth middleware)
	userIDVal, exists := c.Get("user_id")
	if !exists {
		httperror.Unauthorized(c, "User ID not found in context", errors.New("unauthorized"))
		return
	}

	var userID uuid.UUID
	var ok bool

	// Handle both string and uuid.UUID types
	if userID, ok = userIDVal.(uuid.UUID); !ok {
		// Try string
		if idStr, okStr := userIDVal.(string); okStr {
			var err error
			userID, err = uuid.Parse(idStr)
			if err != nil {
				httperror.InternalServerError(c, "Invalid User ID format", err)
				return
			}
		} else {
			httperror.InternalServerError(c, "Invalid User ID type in context", errors.New("invalid type"))
			return
		}
	}

	// 2. Check user permissions from DB (Source of Truth)
	var user models.Users
	var err error
	err = db.NewSelect().Model(&user).Where("id = ?", userID).Scan(c)
	if err != nil {
		httperror.InternalServerError(c, "Error checking user permissions", err)
		return
	}

	// 3. Verify Submission Rights
	// - Admins can always submit
	// - Users can submit if CanSubmitApps is true
	if user.Role != "admin" && !user.CanSubmitApps {
		httperror.Forbidden(c, "You are not allowed to submit apps", errors.New("submission disabled for user"))
		return
	}

	var app models.Apps
	if err := c.ShouldBindJSON(&app); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}

	// 4. Set Metadata
	// If ID is provided, we use it (after validation/sanitization could be added),
	// otherwise generate a new one.
	if app.ID == "" {
		app.ID = uuid.New().String()
	}
	app.UpdatedAt = time.Now()
	app.OwnerID = userID // Assign ownership

	// Default status for new apps
	if user.Role != "admin" {
		app.IsLocked = false // Or true if approval is needed? Currently false.
	}

	_, err = db.NewInsert().Model(&app).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error creating app", err)
		return
	}

	c.JSON(201, app)
}

func UpdateApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")

	// Get User ID
	userIDVal, exists := c.Get("user_id")
	if !exists {
		httperror.Unauthorized(c, "User ID not found", nil)
		return
	}

	var userID uuid.UUID
	var ok bool

	// Handle both string and uuid.UUID types
	if userID, ok = userIDVal.(uuid.UUID); !ok {
		// Try string
		if idStr, okStr := userIDVal.(string); okStr {
			var err error
			userID, err = uuid.Parse(idStr)
			if err != nil {
				httperror.InternalServerError(c, "Invalid User ID format", err)
				return
			}
		} else {
			httperror.InternalServerError(c, "Invalid User ID type in context", errors.New("invalid type"))
			return
		}
	}

	userRole := c.GetString("role") // Auth middleware sets this

	// Verify App Existence
	var existingApp models.Apps
	err := db.NewSelect().Model(&existingApp).Where("id = ?", id).Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return
	}

	// Verify Ownership / Permissions
	isOwner := existingApp.OwnerID == userID
	isAdmin := userRole == "admin"

	if !isAdmin {
		if !isOwner {
			httperror.Forbidden(c, "You do not have permission to edit this app", errors.New("not owner"))
			return
		}
		if existingApp.IsLocked {
			httperror.Forbidden(c, "This app is locked and cannot be edited", errors.New("app locked"))
			return
		}
	}

	var app models.Apps
	if err := c.ShouldBindJSON(&app); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}
	app.ID = id
	app.UpdatedAt = time.Now()

	// Update query
	query := db.NewUpdate().
		Model(&app).
		Where("id = ?", id).
		Column(
			"name", "description", "categories", "live_url", "repo_url",
			"repositories", "custom_links",
			"helm_repo", "docker_repo", "docs_url", "icon", "tech_stack",
			"license", "markdown_content", "custom_fields", "status",
			"custom_docker_command", "custom_compose_command", "custom_helm_command",
			"custom_docker_note", "custom_compose_note", "custom_helm_note", "custom_helm_values",
			"has_deployment_assistant", "show_docker", "show_compose", "show_helm",
			"tags", "collections", "live_demos", "updated_at",
			"is_reuse", "reuse_requirements", "known_issue",
		)

	// Admin can also update admin-only fields if they are sent?
	// For now, let's keep it consistent. If we want admins to change ownership or lock status, we'd need to add those columns.
	// But `app` from BindJSON might contain them if we aren't careful?
	// The struct tags control JSON binding.
	// If the frontend sends `isLocked`, and we add it to the column list, it would update.
	// Let's allow admins to update `isLocked` and users to ONLY update content.

	if isAdmin {
		query.Column("is_locked", "is_featured")
	}

	_, err = query.Exec(c)
	if err != nil {
		log.Errorf("Database error during app update (ID: %s): %v", id, err)
		httperror.InternalServerError(c, "Error updating app", err)
		return
	}

	c.JSON(200, app)
}

func DeleteApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")

	userIDVal, exists := c.Get("user_id")
	if !exists {
		httperror.Unauthorized(c, "User ID not found in context", errors.New("unauthorized"))
		return
	}

	var userID uuid.UUID
	var ok bool

	// Handle both string and uuid.UUID types
	if userID, ok = userIDVal.(uuid.UUID); !ok {
		// Try string
		if idStr, okStr := userIDVal.(string); okStr {
			var err error
			userID, err = uuid.Parse(idStr)
			if err != nil {
				httperror.InternalServerError(c, "Invalid User ID format", err)
				return
			}
		} else {
			httperror.InternalServerError(c, "Invalid User ID type in context", errors.New("invalid type"))
			return
		}
	}

	userRole := c.GetString("role")

	// Check permissions
	var existingApp models.Apps
	err := db.NewSelect().Model(&existingApp).Where("id = ?", id).Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return
	}

	isOwner := existingApp.OwnerID == userID
	isAdmin := userRole == "admin"

	if !isAdmin {
		if !isOwner {
			httperror.Forbidden(c, "You do not have permission to delete this app", errors.New("not owner"))
			return
		}
		if existingApp.IsLocked {
			httperror.Forbidden(c, "This app is locked and cannot be deleted", errors.New("app locked"))
			return
		}
	}

	_, err = db.NewDelete().Model((*models.Apps)(nil)).Where("id = ?", id).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error deleting app", err)
		return
	}

	c.Status(204)
}
