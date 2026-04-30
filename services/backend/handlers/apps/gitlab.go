package apps

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"justapps-backend/config"
	"justapps-backend/functions/httperror"
	gitlabsync "justapps-backend/functions/integrations/gitlab"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type upsertGitLabLinkRequest struct {
	ProviderKey     string `json:"providerKey"`
	ProjectPath     string `json:"projectPath"`
	Branch          string `json:"branch"`
	ReadmePath      string `json:"readmePath"`
	HelmValuesPath  string `json:"helmValuesPath"`
	ComposeFilePath string `json:"composeFilePath"`
}

func GetGitLabIntegration(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	viewerID, viewerRole, hasViewer := getViewerContext(c)

	app, ok := loadGitLabViewableApp(c, db, appID, viewerID, viewerRole, hasViewer)
	if !ok {
		return
	}

	response := models.GitLabIntegrationResponse{
		Linked:             false,
		AvailableProviders: []models.GitLabProviderSummary{},
	}

	providers, providerErr := gitlabsync.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	response.AvailableProviders = providers

	link, err := getGitLabLink(c, db, app.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(200, response)
			return
		}
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht geladen werden", err)
		return
	}

	canManage := hasViewer && (viewerRole == "admin" || app.OwnerID == viewerID)
	response = buildGitLabIntegrationResponse(link, response.AvailableProviders, canManage)
	c.JSON(200, response)
}

func UpsertGitLabIntegration(c *gin.Context, db *bun.DB) {
	app, userID, ok := requireGitLabEditorAccess(c, db, c.Param("id"))
	if !ok {
		return
	}

	var req upsertGitLabLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige GitLab-Eingaben", err)
		return
	}

	provider, found, providerErr := gitlabsync.ResolveProvider(c.Request.Context(), db, config.Config, req.ProviderKey)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	if !found || !provider.Enabled {
		httperror.StatusBadRequest(c, "Der gewählte GitLab-Provider ist nicht konfiguriert", errors.New("provider not configured"))
		return
	}

	projectPath := gitlabsync.NormalizeProjectPath(req.ProjectPath)
	if projectPath == "" {
		httperror.StatusBadRequest(c, "Bitte geben Sie ein GitLab-Projekt an", errors.New("missing project path"))
		return
	}
	if !gitlabsync.IsProjectAllowed(config.RepositoryProviderConf{NamespaceAllowlist: provider.NamespaceAllowlist}, projectPath) {
		httperror.Forbidden(c, "Das GitLab-Projekt liegt außerhalb des erlaubten Namespace", errors.New("project outside allowlist"))
		return
	}

	link, err := getGitLabLink(c, db, app.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht geladen werden", err)
		return
	}

	resetSnapshot := errors.Is(err, sql.ErrNoRows) || link.ProviderKey != provider.Key || link.ProviderType != provider.Type || link.ProjectPath != projectPath || link.Branch != strings.TrimSpace(req.Branch) || link.ReadmePath != strings.TrimSpace(req.ReadmePath) || link.HelmValuesPath != strings.TrimSpace(req.HelmValuesPath) || link.ComposeFilePath != strings.TrimSpace(req.ComposeFilePath)

	now := time.Now().UTC()
	link.AppID = app.ID
	link.ProviderKey = provider.Key
	link.ProviderType = provider.Type
	link.ProjectPath = projectPath
	link.Branch = strings.TrimSpace(req.Branch)
	link.ReadmePath = strings.TrimSpace(req.ReadmePath)
	link.HelmValuesPath = strings.TrimSpace(req.HelmValuesPath)
	link.ComposeFilePath = strings.TrimSpace(req.ComposeFilePath)
	link.UpdatedAt = now
	if link.CreatedAt.IsZero() {
		link.CreatedAt = now
	}
	if resetSnapshot {
		link.ProjectID = 0
		link.ProjectWebURL = ""
		link.LastSyncStatus = "never"
		link.LastSyncError = ""
		link.LastSyncedAt = time.Time{}
		link.Snapshot = models.GitLabSyncSnapshot{}
		link.PendingSnapshot = models.GitLabSyncSnapshot{}
		link.ApprovalRequired = false
		link.LastAppliedAt = time.Time{}
		link.LastManualChangeAt = time.Time{}
	}

	if errors.Is(err, sql.ErrNoRows) {
		_, err = db.NewInsert().Model(&link).Exec(c)
	} else {
		_, err = db.NewUpdate().
			Model(&link).
			Where("app_id = ?", app.ID).
			Column(
				"provider_key", "provider_type", "project_path", "branch", "readme_path",
				"helm_values_path", "compose_file_path", "project_id", "project_web_url",
				"last_sync_status", "last_sync_error", "last_synced_at", "snapshot",
				"pending_snapshot", "approval_required", "last_applied_at", "last_manual_change_at", "updated_at",
			).
			Exec(c)
	}
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht gespeichert werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, userID.String(), "app.gitlab.link", fmt.Sprintf("configured gitlab link for app %s (%s)", app.Name, app.ID))
	providers, providerErr := gitlabsync.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	c.JSON(200, buildGitLabIntegrationResponse(link, providers, true))
}

func SyncGitLabIntegration(c *gin.Context, db *bun.DB) {
	app, userID, ok := requireGitLabEditorAccess(c, db, c.Param("id"))
	if !ok {
		return
	}

	link, err := getGitLabLink(c, db, app.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Für diese App ist noch keine GitLab-Verknüpfung hinterlegt", err)
			return
		}
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht geladen werden", err)
		return
	}

	provider, found, providerErr := gitlabsync.ResolveProvider(c.Request.Context(), db, config.Config, link.ProviderKey)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	if !found || !provider.Enabled {
		httperror.StatusBadRequest(c, "Der konfigurierte GitLab-Provider ist nicht verfügbar", errors.New("provider not configured"))
		return
	}

	err = gitlabsync.SyncAndPersist(c.Request.Context(), db, provider, &link)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Synchronisation fehlgeschlagen", err)
		return
	}

	link, err = getGitLabLink(c, db, app.ID)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Synchronisation konnte nicht geladen werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, userID.String(), "app.gitlab.sync", fmt.Sprintf("synced gitlab data for app %s (%s)", app.Name, app.ID))
	providers, providerErr := gitlabsync.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	c.JSON(200, buildGitLabIntegrationResponse(link, providers, true))
}

func ApproveGitLabIntegration(c *gin.Context, db *bun.DB) {
	app, userID, ok := requireGitLabEditorAccess(c, db, c.Param("id"))
	if !ok {
		return
	}

	link, err := getGitLabLink(c, db, app.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Für diese App ist noch keine GitLab-Verknüpfung hinterlegt", err)
			return
		}
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht geladen werden", err)
		return
	}

	provider, found, providerErr := gitlabsync.ResolveProvider(c.Request.Context(), db, config.Config, link.ProviderKey)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	if !found || !provider.Enabled {
		httperror.StatusBadRequest(c, "Der konfigurierte GitLab-Provider ist nicht verfügbar", errors.New("provider not configured"))
		return
	}

	err = gitlabsync.ApprovePendingSync(c.Request.Context(), db, provider, &link)
	if err != nil {
		httperror.StatusBadRequest(c, "Es liegt keine freizugebende GitLab-Änderung vor", err)
		return
	}

	link, err = getGitLabLink(c, db, app.ID)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht geladen werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, userID.String(), "app.gitlab.approve", fmt.Sprintf("approved pending gitlab sync for app %s (%s)", app.Name, app.ID))
	providers, providerErr := gitlabsync.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	c.JSON(200, buildGitLabIntegrationResponse(link, providers, true))
}

func DeleteGitLabIntegration(c *gin.Context, db *bun.DB) {
	app, userID, ok := requireGitLabEditorAccess(c, db, c.Param("id"))
	if !ok {
		return
	}

	_, err := db.NewDelete().Model((*models.GitLabAppLink)(nil)).Where("app_id = ?", app.ID).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Verknüpfung konnte nicht entfernt werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, userID.String(), "app.gitlab.unlink", fmt.Sprintf("removed gitlab link for app %s (%s)", app.Name, app.ID))
	providers, providerErr := gitlabsync.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if providerErr != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", providerErr)
		return
	}
	c.JSON(200, models.GitLabIntegrationResponse{
		Linked:             false,
		AvailableProviders: providers,
	})
}

func loadGitLabViewableApp(c *gin.Context, db *bun.DB, appID string, viewerID uuid.UUID, viewerRole string, hasViewer bool) (models.Apps, bool) {
	var app models.Apps
	err := db.NewSelect().Model(&app).Where("id = ?", appID).Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "App nicht gefunden", err)
		return models.Apps{}, false
	}
	normalizeAppModelStatus(&app)
	editorAppIDs := map[string]struct{}{}
	if hasViewer {
		var editorErr error
		editorAppIDs, editorErr = loadEditorAppIDs(c.Request.Context(), db, viewerID)
		if editorErr != nil {
			httperror.InternalServerError(c, "App-Berechtigungen konnten nicht geladen werden", editorErr)
			return models.Apps{}, false
		}
	}
	if !canViewApp(app, viewerID, viewerRole, hasViewer, editorAppIDs) {
		httperror.StatusNotFound(c, "App nicht gefunden", nil)
		return models.Apps{}, false
	}
	return app, true
}

func requireGitLabEditorAccess(c *gin.Context, db *bun.DB, appID string) (models.Apps, uuid.UUID, bool) {
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if !hasViewer {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found in context"))
		return models.Apps{}, uuid.Nil, false
	}

	app, ok := loadGitLabViewableApp(c, db, appID, viewerID, viewerRole, true)
	if !ok {
		return models.Apps{}, uuid.Nil, false
	}

	if viewerRole != "admin" && app.OwnerID != viewerID {
		httperror.Forbidden(c, "Sie dürfen diese GitLab-Verknüpfung nicht bearbeiten", errors.New("not owner"))
		return models.Apps{}, uuid.Nil, false
	}
	if viewerRole != "admin" && app.IsLocked {
		httperror.Forbidden(c, "Diese App ist gesperrt und kann nicht mit GitLab verknüpft werden", errors.New("app locked"))
		return models.Apps{}, uuid.Nil, false
	}

	return app, viewerID, true
}

func getGitLabLink(c *gin.Context, db *bun.DB, appID string) (models.GitLabAppLink, error) {
	var link models.GitLabAppLink
	err := db.NewSelect().Model(&link).Where("app_id = ?", appID).Scan(c)
	return link, err
}

func buildGitLabIntegrationResponse(link models.GitLabAppLink, providers []models.GitLabProviderSummary, includeSnapshot bool) models.GitLabIntegrationResponse {
	response := models.GitLabIntegrationResponse{
		Linked:             true,
		AvailableProviders: providers,
		ProviderKey:        link.ProviderKey,
		ProviderType:       link.ProviderType,
		ProjectPath:        link.ProjectPath,
		ProjectWebURL:      link.ProjectWebURL,
		Branch:             link.Branch,
		ReadmePath:         link.ReadmePath,
		HelmValuesPath:     link.HelmValuesPath,
		ComposeFilePath:    link.ComposeFilePath,
		LastSyncStatus:     link.LastSyncStatus,
		ApprovalRequired:   link.ApprovalRequired,
		LastSyncedAt:       nil,
		LastAppliedAt:      nil,
		LastManualChangeAt: nil,
	}
	if !link.LastSyncedAt.IsZero() {
		response.LastSyncedAt = &link.LastSyncedAt
	}
	if !link.LastAppliedAt.IsZero() {
		response.LastAppliedAt = &link.LastAppliedAt
	}
	if !link.LastManualChangeAt.IsZero() {
		response.LastManualChangeAt = &link.LastManualChangeAt
	}
	for _, provider := range providers {
		if provider.Key == link.ProviderKey {
			response.ProviderLabel = provider.Label
			response.BaseURL = provider.BaseURL
			if response.ProviderType == "" {
				response.ProviderType = provider.Type
			}
			break
		}
	}
	if response.ProviderLabel == "" {
		response.ProviderLabel = link.ProviderKey
	}
	if includeSnapshot {
		response.LastSyncError = link.LastSyncError
		response.Snapshot = &link.Snapshot
		if link.ApprovalRequired {
			response.PendingSnapshot = &link.PendingSnapshot
		}
	}
	return response
}
