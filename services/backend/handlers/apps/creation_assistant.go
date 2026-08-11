package apps

import (
	"errors"
	"strings"
	"unicode/utf8"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type appCreationSuggestionRequest struct {
	Brief           string `json:"brief"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	MarkdownContent string `json:"markdownContent"`
	Repository      struct {
		ProjectPath        string   `json:"projectPath"`
		Branch             string   `json:"branch"`
		ReadmeContent      string   `json:"readmeContent"`
		Topics             []string `json:"topics"`
		HelmValuesContent  string   `json:"helmValuesContent"`
		ComposeFileContent string   `json:"composeFileContent"`
	} `json:"repository"`
}

func SuggestAppCreation(c *gin.Context, db *bun.DB) {
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if !hasViewer || viewerID == uuid.Nil {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found in context"))
		return
	}

	var user models.Users
	if err := db.NewSelect().Model(&user).Where("id = ?", viewerID).Scan(c.Request.Context()); err != nil {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", err)
		return
	}
	if viewerRole != "admin" && user.Role != "admin" && !user.CanSubmitApps {
		httperror.Forbidden(c, "Sie dürfen keine Apps anlegen", errors.New("app submission disabled for user"))
		return
	}

	var req appCreationSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige AI-App-Daten", err)
		return
	}
	req.Brief = strings.TrimSpace(req.Brief)
	if req.Brief == "" {
		httperror.StatusBadRequest(c, "Bitte beschreiben Sie die App-Idee", errors.New("missing app brief"))
		return
	}
	if utf8.RuneCountInString(req.Brief) > 6000 {
		httperror.StatusBadRequest(c, "Die App-Idee ist zu lang", errors.New("app brief too long"))
		return
	}

	suggestion, err := aifunc.GenerateAppCreationSuggestion(c.Request.Context(), db, config.Config, aifunc.AppCreationAssistantInput{
		Brief:           req.Brief,
		Name:            strings.TrimSpace(req.Name),
		Description:     strings.TrimSpace(req.Description),
		MarkdownContent: strings.TrimSpace(req.MarkdownContent),
		Repository: aifunc.AppCreationRepositoryInput{
			ProjectPath:        strings.TrimSpace(req.Repository.ProjectPath),
			Branch:             strings.TrimSpace(req.Repository.Branch),
			ReadmeContent:      strings.TrimSpace(req.Repository.ReadmeContent),
			Topics:             req.Repository.Topics,
			HelmValuesContent:  strings.TrimSpace(req.Repository.HelmValuesContent),
			ComposeFileContent: strings.TrimSpace(req.Repository.ComposeFileContent),
		},
	})
	if err != nil {
		switch {
		case errors.Is(err, aifunc.ErrAIDisabled):
			httperror.Forbidden(c, "AI-Funktion ist deaktiviert", err)
		case errors.Is(err, aifunc.ErrAINoProvider):
			httperror.StatusBadRequest(c, "Kein aktiver AI-Provider ist konfiguriert", err)
		case errors.Is(err, aifunc.ErrAIInvalidPayload):
			httperror.InternalServerError(c, "AI-App-Vorschlag war unvollständig", err)
		default:
			httperror.InternalServerError(c, "AI-App-Vorschlag konnte nicht erzeugt werden", err)
		}
		return
	}

	audit.WriteAudit(c.Request.Context(), db, viewerID.String(), "app.creation.suggest", "generated AI app creation suggestion")
	c.JSON(200, suggestion)
}
