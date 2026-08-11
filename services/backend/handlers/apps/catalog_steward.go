package apps

import (
	"errors"
	"strings"
	"time"

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

// RunCatalogSteward scans the complete admin catalog and returns review-only
// findings. Applying a suggestion remains an explicit editor action.
func RunCatalogSteward(c *gin.Context, db *bun.DB) {
	viewerID, _, hasViewer := getViewerContext(c)
	if !hasViewer || viewerID == uuid.Nil {
		httperror.Unauthorized(c, "A user session is required", errors.New("missing user session"))
		return
	}

	apps := make([]models.Apps, 0)
	if err := db.NewSelect().Model(&apps).Relation("Owner").OrderExpr("LOWER(a.name) ASC").Scan(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Katalog konnte nicht geladen werden", err)
		return
	}

	health, err := apphealth.Load(c.Request.Context(), db, apphealth.Scope{})
	if err != nil {
		httperror.InternalServerError(c, "App-Gesundheitsdaten konnten nicht geladen werden", err)
		return
	}
	healthByAppID := make(map[string]apphealth.AppHealthRow, len(health.Apps))
	for _, row := range health.Apps {
		healthByAppID[row.AppID] = row
	}

	links := make([]models.GitLabAppLink, 0)
	if len(apps) > 0 {
		appIDs := make([]string, 0, len(apps))
		for _, app := range apps {
			appIDs = append(appIDs, app.ID)
		}
		if err := db.NewSelect().Model(&links).Where("app_id IN (?)", bun.In(appIDs)).Scan(c.Request.Context()); err != nil {
			httperror.InternalServerError(c, "Repository-Verknüpfungen konnten nicht geladen werden", err)
			return
		}
	}
	linkedAppIDs := make(map[string]struct{}, len(links))
	for _, link := range links {
		linkedAppIDs[link.AppID] = struct{}{}
	}

	input := aifunc.CatalogStewardInput{Apps: make([]aifunc.CatalogStewardApp, 0, len(apps))}
	for _, app := range apps {
		row := healthByAppID[app.ID]
		ownerName := ""
		if app.Owner != nil {
			ownerName = strings.TrimSpace(app.Owner.Username)
			if ownerName == "" {
				ownerName = strings.TrimSpace(app.Owner.Email)
			}
		}
		_, hasRepository := linkedAppIDs[app.ID]
		input.Apps = append(input.Apps, aifunc.CatalogStewardApp{
			ID:               app.ID,
			Name:             app.Name,
			Description:      app.Description,
			Categories:       app.Categories,
			Tags:             app.Tags,
			TechStack:        app.TechStack,
			License:          app.License,
			Status:           app.Status,
			OwnerName:        ownerName,
			HasDocumentation: strings.TrimSpace(app.MarkdownContent) != "" || strings.TrimSpace(app.DocsUrl) != "",
			HasRepository:    hasRepository || strings.TrimSpace(app.RepoUrl) != "" || len(app.Repositories) > 0,
			HasDeployment:    app.HasDeploymentAssistant || strings.TrimSpace(app.DockerRepo) != "" || strings.TrimSpace(app.HelmRepo) != "" || strings.TrimSpace(app.CustomComposeCommand) != "" || strings.TrimSpace(app.CustomDockerCommand) != "" || strings.TrimSpace(app.CustomHelmCommand) != "",
			Health:           row.Health,
			HealthIssues:     row.Issues,
			UpdatedAt:        app.UpdatedAt,
		})
	}

	report, err := aifunc.GenerateCatalogStewardReport(c.Request.Context(), db, config.Config, input)
	if err != nil {
		switch {
		case errors.Is(err, aifunc.ErrAIDisabled):
			httperror.Forbidden(c, "AI-Funktion ist deaktiviert", err)
		case errors.Is(err, aifunc.ErrAINoProvider):
			httperror.StatusBadRequest(c, "Kein aktiver AI-Provider ist konfiguriert", err)
		case errors.Is(err, aifunc.ErrAIInvalidPayload):
			httperror.InternalServerError(c, "AI-Katalogprüfung war unvollständig", err)
		default:
			httperror.InternalServerError(c, "AI-Katalogprüfung konnte nicht erzeugt werden", err)
		}
		return
	}

	audit.WriteAudit(c.Request.Context(), db, viewerID.String(), "catalog.steward.run", "generated review-only AI catalog steward report")
	c.JSON(200, gin.H{
		"generatedAt": reportGeneratedAt(report),
		"appsScanned": len(input.Apps),
		"summary":     report.Summary,
		"findings":    report.Findings,
	})
}

// reportGeneratedAt is kept separate so the public response has a stable
// timestamp without coupling the AI function's review model to transport.
func reportGeneratedAt(_ aifunc.CatalogStewardReport) string {
	return time.Now().UTC().Format(time.RFC3339)
}
