package apps

import (
	"context"
	"errors"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func getRequiredViewerContext(c *gin.Context) (uuid.UUID, string, bool) {
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if !hasViewer || viewerID == uuid.Nil {
		httperror.Unauthorized(c, "User ID not found", errors.New("unauthorized"))
		return uuid.Nil, viewerRole, false
	}
	return viewerID, viewerRole, true
}

func loadEditorAppIDs(ctx context.Context, db *bun.DB, userID uuid.UUID) (map[string]struct{}, error) {
	if userID == uuid.Nil {
		return map[string]struct{}{}, nil
	}

	var editors []models.AppEditor
	if err := db.NewSelect().Model(&editors).Column("app_id").Where("user_id = ?", userID).Scan(ctx); err != nil {
		return nil, err
	}

	appIDs := make(map[string]struct{}, len(editors))
	for _, editor := range editors {
		appIDs[editor.AppID] = struct{}{}
	}
	return appIDs, nil
}

func isEditorForApp(ctx context.Context, db *bun.DB, appID string, userID uuid.UUID) (bool, error) {
	if appID == "" || userID == uuid.Nil {
		return false, nil
	}
	return db.NewSelect().Model((*models.AppEditor)(nil)).
		Where("app_id = ?", appID).
		Where("user_id = ?", userID).
		Exists(ctx)
}

func canViewApp(app models.Apps, viewerID uuid.UUID, viewerRole string, hasViewer bool, editorAppIDs map[string]struct{}) bool {
	if !isDraftApp(app) {
		return true
	}

	if viewerRole == "admin" {
		return true
	}

	if !hasViewer {
		return false
	}

	if app.OwnerID == viewerID {
		return true
	}

	_, isEditor := editorAppIDs[app.ID]
	return isEditor
}

func appViewerPermissions(app models.Apps, viewerID uuid.UUID, viewerRole string, hasViewer bool, isEditor bool) *models.AppViewerPermissions {
	if !hasViewer && viewerRole != "admin" {
		return nil
	}

	isAdmin := viewerRole == "admin"
	isOwner := hasViewer && app.OwnerID == viewerID
	accessRole := "viewer"
	if isAdmin {
		accessRole = "admin"
	} else if isOwner {
		accessRole = "owner"
	} else if isEditor {
		accessRole = "editor"
	}

	canEdit := isAdmin || isOwner || isEditor
	canDelete := isAdmin || isOwner
	if app.IsLocked && !isAdmin {
		canEdit = false
		canDelete = false
	}

	return &models.AppViewerPermissions{
		CanEdit:          canEdit,
		CanDelete:        canDelete,
		CanManageEditors: isAdmin || isOwner,
		AccessRole:       accessRole,
	}
}

func applyViewerPermissions(app *models.Apps, viewerID uuid.UUID, viewerRole string, hasViewer bool, editorAppIDs map[string]struct{}) {
	_, isEditor := editorAppIDs[app.ID]
	app.ViewerPermissions = appViewerPermissions(*app, viewerID, viewerRole, hasViewer, isEditor)
}

func canManageAppEditors(app models.Apps, viewerID uuid.UUID, viewerRole string) bool {
	return viewerRole == "admin" || app.OwnerID == viewerID
}
