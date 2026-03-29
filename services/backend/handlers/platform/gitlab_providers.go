package platform

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"justapps-backend/config"
	"justapps-backend/functions/httperror"
	gitlabsync "justapps-backend/functions/integrations/gitlab"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type updateGitLabProviderRequest struct {
	Label                  string   `json:"label"`
	BaseURL                string   `json:"baseUrl"`
	NamespaceAllowlist     []string `json:"namespaceAllowlist"`
	Enabled                bool     `json:"enabled"`
	AutoSyncEnabled        bool     `json:"autoSyncEnabled"`
	SyncIntervalMinutes    int      `json:"syncIntervalMinutes"`
	DefaultReadmePath      string   `json:"defaultReadmePath"`
	DefaultHelmValuesPath  string   `json:"defaultHelmValuesPath"`
	DefaultComposeFilePath string   `json:"defaultComposeFilePath"`
}

func ListGitLabProviders(c *gin.Context, db *bun.DB) {
	providers, err := gitlabsync.ListAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", err)
		return
	}

	c.JSON(200, providers)
}

func UpdateGitLabProvider(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "GitLab-Provider fehlt", errors.New("missing provider key"))
		return
	}

	provider, found, err := gitlabsync.ResolveProvider(c.Request.Context(), db, config.Config, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "GitLab-Provider ist nicht im Backend konfiguriert", errors.New("provider not configured"))
		return
	}

	var req updateGitLabProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige GitLab-Providerdaten", err)
		return
	}

	if req.SyncIntervalMinutes <= 0 {
		req.SyncIntervalMinutes = provider.SyncIntervalMinutes
		if req.SyncIntervalMinutes <= 0 {
			req.SyncIntervalMinutes = 15
		}
	}

	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = provider.BaseURL
	}

	settings := models.GitLabProviderSettings{
		ProviderKey:            providerKey,
		Label:                  strings.TrimSpace(req.Label),
		BaseURL:                baseURL,
		NamespaceAllowlist:     normalizeProviderAllowlist(req.NamespaceAllowlist),
		Enabled:                req.Enabled,
		AutoSyncEnabled:        req.AutoSyncEnabled,
		SyncIntervalMinutes:    req.SyncIntervalMinutes,
		DefaultReadmePath:      strings.TrimSpace(req.DefaultReadmePath),
		DefaultHelmValuesPath:  strings.TrimSpace(req.DefaultHelmValuesPath),
		DefaultComposeFilePath: strings.TrimSpace(req.DefaultComposeFilePath),
		UpdatedAt:              time.Now().UTC(),
	}

	var existing models.GitLabProviderSettings
	lookupErr := db.NewSelect().Model(&existing).Where("provider_key = ?", providerKey).Scan(c)
	if lookupErr != nil {
		if errors.Is(lookupErr, sql.ErrNoRows) {
			settings.CreatedAt = settings.UpdatedAt
			_, err = db.NewInsert().Model(&settings).Exec(c)
		} else {
			httperror.InternalServerError(c, "GitLab-Provider konnte nicht geladen werden", lookupErr)
			return
		}
	} else {
		settings.CreatedAt = existing.CreatedAt
		_, err = db.NewUpdate().
			Model(&settings).
			Where("provider_key = ?", providerKey).
			Column(
				"label", "base_url", "namespace_allowlist", "enabled", "auto_sync_enabled",
				"sync_interval_minutes", "default_readme_path", "default_helm_values_path", "default_compose_file_path", "updated_at",
			).
			Exec(c)
	}
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnte nicht gespeichert werden", err)
		return
	}

	callerID := c.GetString("user_id")
	audit.WriteAudit(c.Request.Context(), db, callerID, "settings.gitlab_provider.update", "updated gitlab provider settings for "+providerKey)

	providers, err := gitlabsync.ListAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", err)
		return
	}

	for _, item := range providers {
		if item.ProviderKey == providerKey {
			c.JSON(200, item)
			return
		}
	}

	httperror.StatusNotFound(c, "GitLab-Provider konnte nach dem Speichern nicht geladen werden", errors.New("provider missing after update"))
}

func normalizeProviderAllowlist(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.Trim(strings.TrimSpace(value), "/")
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}
