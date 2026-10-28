package apps

import (
	"context"
	"errors"
	"justapps-backend/pkg/appaccess"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"
	"justapps-backend/pkg/permissions"

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
	var spaces []models.PrivateSpace
	if err := db.NewSelect().Model(&spaces).Where("ps.owner_id = ? OR EXISTS (SELECT 1 FROM private_space_members sm WHERE sm.space_id = ps.id AND sm.user_id = ? AND sm.accepted)", userID, userID).Scan(ctx); err != nil {
		return nil, err
	}
	for _, space := range spaces {
		appIDs["space:"+space.ID.String()] = struct{}{}
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
	if app.SpaceID != nil {
		if !hasViewer {
			return false
		}
		if app.OwnerID == viewerID {
			return true
		}
		_, member := editorAppIDs["space:"+app.SpaceID.String()]
		return member
	}
	restricted := app.IsHidden || isDraftApp(app)
	if !restricted || permissions.Has(viewerRole, permissions.ViewAppDrafts) {
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
	if !hasViewer && !permissions.HasAny(viewerRole, permissions.ViewAppDrafts, permissions.EditApps, permissions.DeleteApps) {
		return nil
	}

	isAdmin := viewerRole == "admin"
	canEditAny := permissions.Has(viewerRole, permissions.EditApps)
	canDeleteAny := permissions.Has(viewerRole, permissions.DeleteApps)
	isModerator := permissions.HasAny(viewerRole, permissions.ViewAppDrafts, permissions.EditApps, permissions.DeleteApps, permissions.ViewAppHealth) && !isAdmin
	isOwner := hasViewer && app.OwnerID == viewerID
	accessRole := "viewer"
	if isAdmin {
		accessRole = "admin"
	} else if isModerator {
		accessRole = "moderator"
	} else if isOwner {
		accessRole = "owner"
	} else if isEditor {
		accessRole = "editor"
	}

	canEdit := isAdmin || canEditAny || isOwner || isEditor
	canDelete := isAdmin || canDeleteAny || isOwner
	if app.IsLocked && !isAdmin {
		if !canEditAny {
			canEdit = false
		}
		if !canDeleteAny {
			canDelete = false
		}
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

func ensurePrivateAppAccess(c *gin.Context, db *bun.DB, app models.Apps) bool {
	if app.SpaceID == nil {
		return true
	}
	id, _, hasViewer := getViewerContext(c)
	if hasViewer && app.OwnerID == id {
		return true
	}
	allowed, err := appaccess.HasSpace(c.Request.Context(), db, app.SpaceID.String(), id.String())
	if err != nil {
		httperror.InternalServerError(c, "Space-Zugriff konnte nicht geprüft werden", err)
		return false
	}
	if !hasViewer || !allowed {
		httperror.StatusNotFound(c, "App not found", nil)
		return false
	}
	return true
}

func ensurePrivateAppIDAccess(c *gin.Context, db *bun.DB) bool {
	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("a.id = ?", c.Param("id")).Scan(c); err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return false
	}
	return ensurePrivateAppAccess(c, db, app)
}
