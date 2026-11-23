package apps

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/appaccess"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"
)

// MoveApp moves an app between the public catalog and private spaces, in any direction.
//
// Only the app's owner or an administrator may move it. The owner has to belong to a target space,
// so an app never ends up somewhere its own owner cannot reach. The app keeps its status and
// visibility: a draft moved into the catalog stays a draft until it is published.
func MoveApp(c *gin.Context, db *bun.DB) {
	viewerID, role, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}

	var body struct {
		// The target space, or null/empty for the public catalog.
		SpaceID *string `json:"spaceId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Anfrage", err)
		return
	}

	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("a.id = ?", c.Param("id")).Scan(c); err != nil {
		httperror.StatusNotFound(c, "App nicht gefunden", err)
		return
	}
	if role != "admin" && app.OwnerID != viewerID {
		httperror.Forbidden(c, "Nur der Eigentümer der App kann sie verschieben", errors.New("owner or admin required"))
		return
	}
	if app.IsLocked {
		httperror.Forbidden(c, "Diese App ist gesperrt", errors.New("app is locked"))
		return
	}

	var target *uuid.UUID
	if body.SpaceID != nil && strings.TrimSpace(*body.SpaceID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*body.SpaceID))
		if err != nil {
			httperror.StatusBadRequest(c, "Ungültiger Space", err)
			return
		}
		target = &parsed
	}

	if (target == nil && app.SpaceID == nil) || (target != nil && app.SpaceID != nil && *target == *app.SpaceID) {
		httperror.StatusBadRequest(c, "Die App befindet sich bereits dort", errors.New("app already in target"))
		return
	}

	if target != nil {
		allowed, err := appaccess.HasSpace(c, db, target.String(), app.OwnerID.String())
		if err != nil {
			httperror.InternalServerError(c, "Space-Zugriff konnte nicht geprüft werden", err)
			return
		}
		if !allowed {
			httperror.Forbidden(c, "Der Eigentümer der App ist kein Mitglied dieses Space", errors.New("owner is not a member of the target space"))
			return
		}
	} else if !isDraftApp(app) && (strings.TrimSpace(app.Description) == "" || len(app.Categories) == 0) {
		// A published app shows up in the catalog straight away, so it needs what every catalog app has.
		httperror.StatusBadRequest(c, "Bitte vor dem Verschieben in den Katalog Beschreibung und Kategorie ergänzen", errors.New("description and category required"))
		return
	}

	update := db.NewUpdate().Model((*models.Apps)(nil)).Set("updated_at = ?", time.Now()).Where("id = ?", app.ID)
	if target == nil {
		update = update.Set("space_id = NULL")
	} else {
		update = update.Set("space_id = ?", *target)
	}
	if _, err := update.Exec(c); err != nil {
		httperror.InternalServerError(c, "Die App konnte nicht verschoben werden", err)
		return
	}

	audit.WriteAudit(c, db, viewerID.String(), "app.move", fmt.Sprintf("moved app %s from %s to %s", app.ID, describeSpace(app.SpaceID), describeSpace(target)))
	c.Status(204)
}

func describeSpace(id *uuid.UUID) string {
	if id == nil {
		return "public catalog"
	}
	return "space " + id.String()
}
