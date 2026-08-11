package apps

import (
	"database/sql"
	"errors"
	"strings"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/functions/apphealth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type healthCopilotResponse struct {
	AppID string `json:"appId"`
	Name  string `json:"name"`
	aifunc.HealthCopilotSuggestion
}

// GenerateHealthCopilot explains the concrete health issues of an app without
// mutating the app or its repository integration.
func GenerateHealthCopilot(c *gin.Context, db *bun.DB) {
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if !hasViewer || viewerID == uuid.Nil {
		httperror.Unauthorized(c, "A user session is required", errors.New("missing user session"))
		return
	}

	appID := strings.TrimSpace(c.Param("id"))
	if appID == "" {
		httperror.StatusBadRequest(c, "App-ID fehlt", errors.New("missing app id"))
		return
	}

	scope := apphealth.Scope{}
	if viewerRole != "admin" {
		scope.EditableBy = &viewerID
	}
	health, err := apphealth.Load(c.Request.Context(), db, scope)
	if err != nil {
		httperror.InternalServerError(c, "Gesundheitsdaten konnten nicht geladen werden", err)
		return
	}

	var healthRow *apphealth.AppHealthRow
	for index := range health.Apps {
		if health.Apps[index].AppID == appID {
			healthRow = &health.Apps[index]
			break
		}
	}
	if healthRow == nil {
		httperror.StatusNotFound(c, "App nicht gefunden", sql.ErrNoRows)
		return
	}

	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("id = ?", appID).Scan(c.Request.Context()); err != nil {
		httperror.StatusNotFound(c, "App nicht gefunden", err)
		return
	}

	suggestion, err := aifunc.GenerateHealthCopilot(c.Request.Context(), db, config.Config, aifunc.HealthCopilotInput{
		AppName:          app.Name,
		Description:      app.Description,
		Status:           app.Status,
		Issues:           healthRow.Issues,
		LinkProbeStatus:  healthRow.LinkProbeStatus,
		SyncStatus:       healthRow.SyncStatus,
		SyncError:        healthRow.SyncError,
		OwnerName:        healthRow.OwnerName,
		DocumentationURL: app.DocsUrl,
		HasMarkdown:      strings.TrimSpace(app.MarkdownContent) != "",
		UpdatedAt:        healthRow.UpdatedAt,
	})
	if err != nil {
		switch {
		case errors.Is(err, aifunc.ErrAIDisabled):
			httperror.Forbidden(c, "AI-Funktion ist deaktiviert", err)
		case errors.Is(err, aifunc.ErrAINoProvider):
			httperror.StatusBadRequest(c, "Kein aktiver AI-Provider ist konfiguriert", err)
		default:
			httperror.InternalServerError(c, "AI-Erklärung konnte nicht erzeugt werden", err)
		}
		return
	}

	audit.WriteAudit(c.Request.Context(), db, viewerID.String(), "app.health.copilot", "generated AI health explanation for app "+appID)
	c.JSON(200, healthCopilotResponse{AppID: appID, Name: app.Name, HealthCopilotSuggestion: suggestion})
}
