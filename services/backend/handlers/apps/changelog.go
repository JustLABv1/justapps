package apps

import (
	"errors"
	"strings"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	appupdates "justapps-backend/functions/appupdates"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type changelogSuggestionRequest struct {
	AppID            string            `json:"appId"`
	Name             string            `json:"name"`
	Version          string            `json:"version"`
	CurrentChangelog string            `json:"currentChangelog"`
	Description      *string           `json:"description"`
	License          *string           `json:"license"`
	MarkdownContent  *string           `json:"markdownContent"`
	CustomHelmValues *string           `json:"customHelmValues"`
	CustomCompose    *string           `json:"customComposeCommand"`
	Tags             *[]string         `json:"tags"`
	Repositories     *[]models.AppLink `json:"repositories"`
}

// SuggestChangelog creates a reviewable AI proposal from the current editor
// draft. It intentionally does not persist the proposal.
func SuggestChangelog(c *gin.Context, db *bun.DB) {
	var req changelogSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Changelog-Daten", err)
		return
	}

	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if !hasViewer {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found in context"))
		return
	}

	enabled, err := aifunc.IsEnabled(c.Request.Context(), db)
	if err != nil {
		httperror.InternalServerError(c, "AI-Funktion konnte nicht geprüft werden", err)
		return
	}
	if !enabled {
		httperror.Forbidden(c, "AI-Funktion ist deaktiviert", aifunc.ErrAIDisabled)
		return
	}

	appID := strings.TrimSpace(req.AppID)
	baseline := models.Apps{}
	draft := models.Apps{}
	storedChangelog := ""
	if appID != "" {
		if err := db.NewSelect().Model(&baseline).Where("id = ?", appID).Scan(c.Request.Context()); err != nil {
			httperror.StatusNotFound(c, "App nicht gefunden", err)
			return
		}

		if viewerRole != "admin" && baseline.OwnerID != viewerID {
			isEditor, editorErr := isEditorForApp(c.Request.Context(), db, appID, viewerID)
			if editorErr != nil {
				httperror.InternalServerError(c, "App-Berechtigungen konnten nicht geprüft werden", editorErr)
				return
			}
			if !isEditor {
				httperror.Forbidden(c, "Sie dürfen diese App nicht bearbeiten", errors.New("not owner or editor"))
				return
			}
		}
		if viewerRole != "admin" && baseline.IsLocked {
			httperror.Forbidden(c, "Diese App ist gesperrt und kann nicht bearbeitet werden", errors.New("app locked"))
			return
		}

		draft = baseline
		storedChangelog = baseline.Changelog
	}

	applyChangelogDraft(&draft, req)
	if strings.TrimSpace(draft.Name) == "" {
		httperror.StatusBadRequest(c, "Bitte geben Sie zuerst einen App-Namen an", errors.New("missing app name"))
		return
	}

	changedAreas := appupdates.ClassifyChangedAreas(baseline, draft)
	changes := appupdates.BuildChangeDetails(baseline, draft)
	if len(changes) == 0 {
		// A user may intentionally generate a first/current changelog without
		// making another edit in the form. Treat the current app as the new
		// release baseline for that explicit action.
		baseline = models.Apps{}
		changedAreas = appupdates.ClassifyChangedAreas(baseline, draft)
		changes = appupdates.BuildChangeDetails(baseline, draft)
	}
	if len(changes) == 0 {
		httperror.StatusBadRequest(c, "Für einen Changelog-Vorschlag fehlen noch inhaltliche App-Daten", errors.New("no changelog content"))
		return
	}

	existingChangelog := strings.TrimSpace(req.CurrentChangelog)
	if existingChangelog == "" && appID != "" {
		existingChangelog = storedChangelog
	}
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version = strings.TrimSpace(draft.Version)
	}

	suggestion, err := aifunc.GenerateChangelog(c.Request.Context(), db, config.Config, aifunc.ChangelogGenerationInput{
		AppName:           draft.Name,
		Version:           version,
		ExistingChangelog: existingChangelog,
		ChangedAreas:      changedAreas,
		Changes:           changes,
		Language:          "Deutsch",
	})
	if err != nil {
		switch {
		case errors.Is(err, aifunc.ErrAIDisabled):
			httperror.Forbidden(c, "AI-Funktion ist deaktiviert", err)
		case errors.Is(err, aifunc.ErrAINoProvider):
			httperror.StatusBadRequest(c, "Kein aktiver AI-Provider ist konfiguriert", err)
		default:
			httperror.InternalServerError(c, "AI-Changelog konnte nicht erzeugt werden", err)
		}
		return
	}

	audit.WriteAudit(c.Request.Context(), db, viewerID.String(), "app.changelog.suggest", "generated AI changelog suggestion for app "+appID)
	c.JSON(200, suggestion)
}

func applyChangelogDraft(draft *models.Apps, req changelogSuggestionRequest) {
	if draft == nil {
		return
	}
	if strings.TrimSpace(req.Name) != "" {
		draft.Name = strings.TrimSpace(req.Name)
	}
	if req.Description != nil {
		draft.Description = *req.Description
	}
	if req.License != nil {
		draft.License = *req.License
	}
	if req.MarkdownContent != nil {
		draft.MarkdownContent = *req.MarkdownContent
	}
	if req.CustomHelmValues != nil {
		draft.CustomHelmValues = *req.CustomHelmValues
	}
	if req.CustomCompose != nil {
		draft.CustomComposeCommand = *req.CustomCompose
	}
	if req.Tags != nil {
		draft.Tags = append([]string(nil), (*req.Tags)...)
	}
	if req.Repositories != nil {
		draft.Repositories = append([]models.AppLink(nil), (*req.Repositories)...)
	}
}
