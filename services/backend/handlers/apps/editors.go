package apps

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type appEditorUserResponse struct {
	ID            uuid.UUID `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	AuthType      string    `json:"authType"`
	CanSubmitApps bool      `json:"canSubmitApps"`
	Disabled      bool      `json:"disabled"`
}

func ListAppEditors(c *gin.Context, db *bun.DB) {
	app, ok := loadAppForEditorManagement(c, db)
	if !ok {
		return
	}

	viewerID, viewerRole, hasViewer := getRequiredViewerContext(c)
	if !hasViewer {
		return
	}

	isEditor, err := isEditorForApp(c.Request.Context(), db, app.ID, viewerID)
	if err != nil {
		httperror.InternalServerError(c, "Error checking editor permissions", err)
		return
	}
	if !canManageAppEditors(app, viewerID, viewerRole) && !isEditor {
		httperror.Forbidden(c, "You do not have permission to view app editors", errors.New("not allowed"))
		return
	}

	editors, err := loadEditorUsers(c.Request.Context(), db, app.ID)
	if err != nil {
		httperror.InternalServerError(c, "Error loading app editors", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"editors": editors})
}

func ReplaceAppEditors(c *gin.Context, db *bun.DB) {
	app, ok := loadAppForEditorManagement(c, db)
	if !ok {
		return
	}

	viewerID, viewerRole, hasViewer := getRequiredViewerContext(c)
	if !hasViewer {
		return
	}
	if !canManageAppEditors(app, viewerID, viewerRole) {
		httperror.Forbidden(c, "You do not have permission to manage app editors", errors.New("not owner"))
		return
	}

	var body struct {
		UserIDs []string `json:"userIds"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "Request body is invalid", err)
		return
	}

	userIDs, err := parseEditorUserIDs(body.UserIDs)
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}

	if len(userIDs) > 0 {
		validUsers := make([]models.Users, 0, len(userIDs))
		if err := db.NewSelect().Model(&validUsers).
			Column("id").
			Where("id IN (?)", bun.In(userIDs)).
			Where("disabled = FALSE").
			Scan(c.Request.Context()); err != nil {
			httperror.InternalServerError(c, "Error validating users", err)
			return
		}
		if len(validUsers) != len(userIDs) {
			httperror.StatusBadRequest(c, "One or more users do not exist or are disabled", errors.New("invalid editor users"))
			return
		}
		for _, userID := range userIDs {
			if userID == app.OwnerID {
				httperror.StatusBadRequest(c, "The app owner cannot also be an editor", errors.New("owner editor"))
				return
			}
		}
	}

	err = db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().Model((*models.AppEditor)(nil)).Where("app_id = ?", app.ID).Exec(ctx); err != nil {
			return err
		}
		if len(userIDs) == 0 {
			return nil
		}

		now := time.Now().UTC()
		createdBy := viewerID
		editors := make([]models.AppEditor, 0, len(userIDs))
		for _, userID := range userIDs {
			editors = append(editors, models.AppEditor{
				AppID:     app.ID,
				UserID:    userID,
				CreatedBy: &createdBy,
				CreatedAt: now,
			})
		}
		_, err := tx.NewInsert().Model(&editors).Exec(ctx)
		return err
	})
	if err != nil {
		httperror.InternalServerError(c, "Error saving app editors", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, viewerID.String(), "app.editors.update", fmt.Sprintf("updated editors for app %s (%s)", app.Name, app.ID))

	editors, err := loadEditorUsers(c.Request.Context(), db, app.ID)
	if err != nil {
		httperror.InternalServerError(c, "Error loading app editors", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"editors": editors})
}

func loadAppForEditorManagement(c *gin.Context, db *bun.DB) (models.Apps, bool) {
	id := c.Param("id")
	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("id = ?", id).Scan(c.Request.Context()); err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return models.Apps{}, false
	}
	return app, true
}

func parseEditorUserIDs(values []string) ([]uuid.UUID, error) {
	seen := make(map[uuid.UUID]struct{}, len(values))
	userIDs := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		userID, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, fmt.Errorf("Invalid user ID: %s", trimmed)
		}
		if userID == uuid.Nil {
			return nil, errors.New("Invalid empty user ID")
		}
		if _, exists := seen[userID]; exists {
			continue
		}
		seen[userID] = struct{}{}
		userIDs = append(userIDs, userID)
	}
	return userIDs, nil
}

func loadEditorUsers(ctx context.Context, db *bun.DB, appID string) ([]appEditorUserResponse, error) {
	var rows []struct {
		ID            uuid.UUID `bun:"id"`
		Username      string    `bun:"username"`
		Email         string    `bun:"email"`
		Role          string    `bun:"role"`
		AuthType      string    `bun:"auth_type"`
		CanSubmitApps bool      `bun:"can_submit_apps"`
		Disabled      bool      `bun:"disabled"`
	}

	err := db.NewSelect().TableExpr("app_editors AS ae").
		ColumnExpr("u.id, u.username, u.email, u.role, u.auth_type, u.can_submit_apps, u.disabled").
		Join("JOIN users AS u ON u.id = ae.user_id").
		Where("ae.app_id = ?", appID).
		OrderExpr("LOWER(u.username) ASC, LOWER(u.email) ASC").
		Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}

	editors := make([]appEditorUserResponse, 0, len(rows))
	for _, row := range rows {
		editors = append(editors, appEditorUserResponse{
			ID:            row.ID,
			Username:      row.Username,
			Email:         row.Email,
			Role:          row.Role,
			AuthType:      row.AuthType,
			CanSubmitApps: row.CanSubmitApps,
			Disabled:      row.Disabled,
		})
	}
	return editors, nil
}
