package apps

import (
	"errors"
	"strings"
	"unicode/utf8"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/functions/httperror"
	gitlabsync "justapps-backend/functions/integrations/gitlab"
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
	ScanRepository  bool   `json:"scanRepository"`
	Repository      struct {
		ProviderKey        string   `json:"providerKey"`
		ProjectPath        string   `json:"projectPath"`
		Branch             string   `json:"branch"`
		ReadmePath         string   `json:"readmePath"`
		HelmValuesPath     string   `json:"helmValuesPath"`
		ComposeFilePath    string   `json:"composeFilePath"`
		ReadmeContent      string   `json:"readmeContent"`
		Topics             []string `json:"topics"`
		HelmValuesContent  string   `json:"helmValuesContent"`
		ComposeFileContent string   `json:"composeFileContent"`
	} `json:"repository"`
}

type appCreationRepositoryScanResponse struct {
	ProviderKey     string   `json:"providerKey"`
	ProviderType    string   `json:"providerType"`
	ProviderLabel   string   `json:"providerLabel"`
	ProjectPath     string   `json:"projectPath"`
	Branch          string   `json:"branch"`
	ReadmePath      string   `json:"readmePath"`
	HelmValuesPath  string   `json:"helmValuesPath"`
	ComposeFilePath string   `json:"composeFilePath"`
	Status          string   `json:"status"`
	Warnings        []string `json:"warnings"`
}

type appCreationSuggestionResponse struct {
	aifunc.AppCreationSuggestion
	RepositorySnapshot *models.GitLabSyncSnapshot         `json:"repositorySnapshot,omitempty"`
	RepositoryScan     *appCreationRepositoryScanResponse `json:"repositoryScan,omitempty"`
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
	if req.Brief == "" && !req.ScanRepository {
		httperror.StatusBadRequest(c, "Bitte beschreiben Sie die App-Idee", errors.New("missing app brief"))
		return
	}
	if utf8.RuneCountInString(req.Brief) > 6000 {
		httperror.StatusBadRequest(c, "Die App-Idee ist zu lang", errors.New("app brief too long"))
		return
	}

	repository := aifunc.AppCreationRepositoryInput{
		ProviderKey:        strings.TrimSpace(req.Repository.ProviderKey),
		ProjectPath:        strings.TrimSpace(req.Repository.ProjectPath),
		Branch:             strings.TrimSpace(req.Repository.Branch),
		ReadmePath:         strings.TrimSpace(req.Repository.ReadmePath),
		HelmValuesPath:     strings.TrimSpace(req.Repository.HelmValuesPath),
		ComposeFilePath:    strings.TrimSpace(req.Repository.ComposeFilePath),
		ReadmeContent:      strings.TrimSpace(req.Repository.ReadmeContent),
		Topics:             req.Repository.Topics,
		HelmValuesContent:  strings.TrimSpace(req.Repository.HelmValuesContent),
		ComposeFileContent: strings.TrimSpace(req.Repository.ComposeFileContent),
		ScanRepository:     req.ScanRepository,
	}
	var repositorySnapshot *models.GitLabSyncSnapshot
	var repositoryScan *appCreationRepositoryScanResponse
	if req.ScanRepository {
		snapshot, scan, scanErr := scanRepositoryForCreation(c, db, repository)
		if scanErr != nil {
			httperror.StatusBadRequest(c, "Repository konnte nicht analysiert werden", scanErr)
			return
		}
		repositorySnapshot = &snapshot
		repositoryScan = &scan
		if snapshot.ProjectPath != "" {
			repository.ProjectPath = snapshot.ProjectPath
		}
		if repository.Branch == "" {
			repository.Branch = snapshot.DefaultBranch
		}
		if snapshot.ReadmePath != "" {
			repository.ReadmePath = snapshot.ReadmePath
		}
		if snapshot.HelmValuesPath != "" {
			repository.HelmValuesPath = snapshot.HelmValuesPath
		}
		if snapshot.ComposeFilePath != "" {
			repository.ComposeFilePath = snapshot.ComposeFilePath
		}
		if strings.TrimSpace(snapshot.ReadmeContent) != "" {
			repository.ReadmeContent = snapshot.ReadmeContent
		}
		if len(snapshot.Topics) > 0 {
			repository.Topics = snapshot.Topics
		}
		if strings.TrimSpace(snapshot.HelmValuesContent) != "" {
			repository.HelmValuesContent = snapshot.HelmValuesContent
		}
		if strings.TrimSpace(snapshot.ComposeFileContent) != "" {
			repository.ComposeFileContent = snapshot.ComposeFileContent
		}
	}

	suggestion, err := aifunc.GenerateAppCreationSuggestion(c.Request.Context(), db, config.Config, aifunc.AppCreationAssistantInput{
		Brief:           req.Brief,
		Name:            strings.TrimSpace(req.Name),
		Description:     strings.TrimSpace(req.Description),
		MarkdownContent: strings.TrimSpace(req.MarkdownContent),
		Repository:      repository,
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

	auditAction := "app.creation.suggest"
	auditDetails := "generated AI app creation suggestion"
	if req.ScanRepository {
		auditAction = "app.creation.suggest.repository_scan"
		auditDetails = "generated AI app creation suggestion from repository scan"
	}
	audit.WriteAudit(c.Request.Context(), db, viewerID.String(), auditAction, auditDetails)
	c.JSON(200, appCreationSuggestionResponse{
		AppCreationSuggestion: suggestion,
		RepositorySnapshot:    repositorySnapshot,
		RepositoryScan:        repositoryScan,
	})
}

func scanRepositoryForCreation(c *gin.Context, db *bun.DB, input aifunc.AppCreationRepositoryInput) (models.GitLabSyncSnapshot, appCreationRepositoryScanResponse, error) {
	provider, found, err := gitlabsync.ResolveProvider(c.Request.Context(), db, config.Config, input.ProviderKey)
	if err != nil {
		return models.GitLabSyncSnapshot{}, appCreationRepositoryScanResponse{}, err
	}
	if !found || !provider.Enabled {
		return models.GitLabSyncSnapshot{}, appCreationRepositoryScanResponse{}, errors.New("repository provider is not configured")
	}

	projectPath := gitlabsync.NormalizeProjectPath(input.ProjectPath)
	if projectPath == "" {
		return models.GitLabSyncSnapshot{}, appCreationRepositoryScanResponse{}, errors.New("missing repository project path")
	}
	if !gitlabsync.IsProjectAllowed(config.RepositoryProviderConf{NamespaceAllowlist: provider.NamespaceAllowlist}, projectPath) {
		return models.GitLabSyncSnapshot{}, appCreationRepositoryScanResponse{}, errors.New("repository project is outside the configured namespace allowlist")
	}

	readmePath := strings.TrimSpace(input.ReadmePath)
	helmValuesPath := strings.TrimSpace(input.HelmValuesPath)
	composeFilePath := strings.TrimSpace(input.ComposeFilePath)
	if helmValuesPath == "" {
		helmValuesPath = provider.DefaultHelmValuesPath
	}
	if composeFilePath == "" {
		composeFilePath = provider.DefaultComposeFilePath
	}

	syncer := gitlabsync.NewSyncer(config.RepositoryProviderConf{
		Key:                provider.Key,
		Label:              provider.Label,
		Type:               provider.Type,
		BaseURL:            provider.BaseURL,
		Token:              provider.Token,
		NamespaceAllowlist: provider.NamespaceAllowlist,
		TimeoutSeconds:     provider.TimeoutSeconds,
	})
	result, err := syncer.Sync(models.GitLabAppLink{
		ProviderKey:     provider.Key,
		ProviderType:    provider.Type,
		ProjectPath:     projectPath,
		Branch:          strings.TrimSpace(input.Branch),
		ReadmePath:      readmePath,
		HelmValuesPath:  helmValuesPath,
		ComposeFilePath: composeFilePath,
	})
	if err != nil {
		return models.GitLabSyncSnapshot{}, appCreationRepositoryScanResponse{}, err
	}

	branch := strings.TrimSpace(input.Branch)
	if branch == "" {
		branch = result.Snapshot.DefaultBranch
	}
	return result.Snapshot, appCreationRepositoryScanResponse{
		ProviderKey:     provider.Key,
		ProviderType:    provider.Type,
		ProviderLabel:   provider.Label,
		ProjectPath:     result.Snapshot.ProjectPath,
		Branch:          branch,
		ReadmePath:      result.Snapshot.ReadmePath,
		HelmValuesPath:  result.Snapshot.HelmValuesPath,
		ComposeFilePath: result.Snapshot.ComposeFilePath,
		Status:          result.Status,
		Warnings:        result.Snapshot.Warnings,
	}, nil
}
