package platform

import (
	"context"
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
	Token                  string   `json:"token"`
	ClearToken             bool     `json:"clearToken"`
	NamespaceAllowlist     []string `json:"namespaceAllowlist"`
	Enabled                bool     `json:"enabled"`
	AutoSyncEnabled        bool     `json:"autoSyncEnabled"`
	SyncIntervalMinutes    int      `json:"syncIntervalMinutes"`
	DefaultReadmePath      string   `json:"defaultReadmePath"`
	DefaultHelmValuesPath  string   `json:"defaultHelmValuesPath"`
	DefaultComposeFilePath string   `json:"defaultComposeFilePath"`
}

type createGitLabProviderRequest struct {
	ProviderKey            string   `json:"providerKey"`
	ProviderType           string   `json:"providerType"`
	Label                  string   `json:"label"`
	BaseURL                string   `json:"baseUrl"`
	Token                  string   `json:"token"`
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

// ListAvailableGitLabProviders returns the non-sensitive provider summaries for
// authenticated users (e.g. to populate a dropdown in the app-creation wizard).
func ListAvailableGitLabProviders(c *gin.Context, db *bun.DB) {
	providers, err := gitlabsync.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "GitLab-Provider konnten nicht geladen werden", err)
		return
	}

	c.JSON(200, providers)
}

func CreateGitLabProvider(c *gin.Context, db *bun.DB) {
	var req createGitLabProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Repository-Providerdaten", err)
		return
	}

	providerKey := strings.TrimSpace(req.ProviderKey)
	if providerKey == "" {
		httperror.StatusBadRequest(c, "Repository-Provider-Schlüssel fehlt", errors.New("missing provider key"))
		return
	}
	providerType := gitlabsync.NormalizeProviderType(req.ProviderType)
	if !gitlabsync.IsProviderTypeSupported(providerType) {
		httperror.StatusBadRequest(c, "Repository-Provider-Typ ist nicht unterstützt", errors.New("unsupported provider type"))
		return
	}
	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		httperror.StatusBadRequest(c, "Base URL des Repository-Providers fehlt", errors.New("missing base url"))
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		httperror.StatusBadRequest(c, "Token des Repository-Providers fehlt", errors.New("missing token"))
		return
	}

	_, found, err := loadGitLabProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnte nicht geladen werden", err)
		return
	}
	if found {
		httperror.StatusConflict(c, "Repository-Provider existiert bereits", errors.New("provider already exists"))
		return
	}

	encryptedToken, tokenNonce, tokenKeyVersion, err := gitlabsync.EncryptProviderToken(config.Config, token)
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider-Token konnte nicht verschlüsselt werden", err)
		return
	}

	now := time.Now().UTC()
	settings := models.GitLabProviderSettings{
		ProviderKey:            providerKey,
		ProviderType:           providerType,
		Label:                  strings.TrimSpace(req.Label),
		BaseURL:                baseURL,
		EncryptedToken:         encryptedToken,
		TokenNonce:             tokenNonce,
		TokenKeyVersion:        tokenKeyVersion,
		TokenConfigured:        true,
		NamespaceAllowlist:     normalizeProviderAllowlist(req.NamespaceAllowlist),
		Enabled:                req.Enabled,
		AutoSyncEnabled:        req.AutoSyncEnabled,
		SyncIntervalMinutes:    normalizeProviderSyncInterval(req.SyncIntervalMinutes),
		DefaultReadmePath:      strings.TrimSpace(req.DefaultReadmePath),
		DefaultHelmValuesPath:  strings.TrimSpace(req.DefaultHelmValuesPath),
		DefaultComposeFilePath: strings.TrimSpace(req.DefaultComposeFilePath),
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	if _, err := db.NewInsert().Model(&settings).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnte nicht gespeichert werden", err)
		return
	}

	callerID := c.GetString("user_id")
	audit.WriteAudit(c.Request.Context(), db, callerID, "settings.repository_provider.create", "created repository provider "+providerKey)
	respondWithGitLabProvider(c, db, providerKey)
}

func UpdateGitLabProvider(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "Repository-Provider fehlt", errors.New("missing provider key"))
		return
	}

	existing, found, err := loadGitLabProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnten nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "Repository-Provider ist nicht vorhanden", errors.New("provider not found"))
		return
	}

	var req updateGitLabProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Repository-Providerdaten", err)
		return
	}
	if req.ClearToken && strings.TrimSpace(req.Token) != "" {
		httperror.StatusBadRequest(c, "Token kann nicht gleichzeitig ersetzt und gelöscht werden", errors.New("conflicting token mutation"))
		return
	}

	if req.SyncIntervalMinutes <= 0 {
		req.SyncIntervalMinutes = existing.SyncIntervalMinutes
		if req.SyncIntervalMinutes <= 0 {
			req.SyncIntervalMinutes = 15
		}
	}

	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = existing.BaseURL
	}

	encryptedToken := existing.EncryptedToken
	tokenNonce := existing.TokenNonce
	tokenKeyVersion := existing.TokenKeyVersion
	tokenConfigured := existing.TokenConfigured
	if req.ClearToken {
		encryptedToken = ""
		tokenNonce = ""
		tokenKeyVersion = ""
		tokenConfigured = false
	} else if strings.TrimSpace(req.Token) != "" {
		var err error
		encryptedToken, tokenNonce, tokenKeyVersion, err = gitlabsync.EncryptProviderToken(config.Config, strings.TrimSpace(req.Token))
		if err != nil {
			httperror.InternalServerError(c, "Repository-Provider-Token konnte nicht verschlüsselt werden", err)
			return
		}
		tokenConfigured = true
	}

	settings := models.GitLabProviderSettings{
		ProviderKey:            providerKey,
		ProviderType:           existing.ProviderType,
		Label:                  strings.TrimSpace(req.Label),
		BaseURL:                baseURL,
		EncryptedToken:         encryptedToken,
		TokenNonce:             tokenNonce,
		TokenKeyVersion:        tokenKeyVersion,
		TokenConfigured:        tokenConfigured,
		NamespaceAllowlist:     normalizeProviderAllowlist(req.NamespaceAllowlist),
		Enabled:                req.Enabled,
		AutoSyncEnabled:        req.AutoSyncEnabled,
		SyncIntervalMinutes:    normalizeProviderSyncInterval(req.SyncIntervalMinutes),
		DefaultReadmePath:      strings.TrimSpace(req.DefaultReadmePath),
		DefaultHelmValuesPath:  strings.TrimSpace(req.DefaultHelmValuesPath),
		DefaultComposeFilePath: strings.TrimSpace(req.DefaultComposeFilePath),
		CreatedAt:              existing.CreatedAt,
		UpdatedAt:              time.Now().UTC(),
	}

	_, err = db.NewUpdate().
		Model(&settings).
		Where("provider_key = ?", providerKey).
		Column(
			"provider_type", "label", "base_url", "encrypted_token", "token_nonce", "token_key_version", "token_configured", "namespace_allowlist", "enabled", "auto_sync_enabled",
			"sync_interval_minutes", "default_readme_path", "default_helm_values_path", "default_compose_file_path", "updated_at",
		).
		Exec(c.Request.Context())
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnte nicht gespeichert werden", err)
		return
	}

	callerID := c.GetString("user_id")
	audit.WriteAudit(c.Request.Context(), db, callerID, "settings.repository_provider.update", "updated repository provider settings for "+providerKey)
	respondWithGitLabProvider(c, db, providerKey)
}

func DeleteGitLabProvider(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "Repository-Provider fehlt", errors.New("missing provider key"))
		return
	}

	_, found, err := loadGitLabProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "Repository-Provider ist nicht vorhanden", errors.New("provider not found"))
		return
	}

	linkedAppsCount, err := countGitLabProviderLinks(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider-Verknüpfungen konnten nicht geladen werden", err)
		return
	}
	if linkedAppsCount > 0 {
		httperror.StatusConflict(c, "Repository-Provider kann nicht gelöscht werden, solange Apps damit verknüpft sind", errors.New("provider still linked to apps"))
		return
	}

	if _, err := db.NewDelete().Model((*models.GitLabProviderSettings)(nil)).Where("provider_key = ?", providerKey).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnte nicht gelöscht werden", err)
		return
	}

	callerID := c.GetString("user_id")
	audit.WriteAudit(c.Request.Context(), db, callerID, "settings.repository_provider.delete", "deleted repository provider "+providerKey)
	c.JSON(200, gin.H{"deleted": true, "providerKey": providerKey})
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

func normalizeProviderSyncInterval(value int) int {
	if value <= 0 {
		return 15
	}
	return value
}

func loadGitLabProviderSettings(ctx context.Context, db *bun.DB, providerKey string) (models.GitLabProviderSettings, bool, error) {
	var settings models.GitLabProviderSettings
	err := db.NewSelect().Model(&settings).Where("LOWER(provider_key) = LOWER(?)", strings.TrimSpace(providerKey)).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.GitLabProviderSettings{}, false, nil
		}
		return models.GitLabProviderSettings{}, false, err
	}
	return settings, true, nil
}

func countGitLabProviderLinks(ctx context.Context, db *bun.DB, providerKey string) (int, error) {
	count, err := db.NewSelect().Model((*models.GitLabAppLink)(nil)).Where("provider_key = ?", strings.TrimSpace(providerKey)).Count(ctx)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func respondWithGitLabProvider(c *gin.Context, db *bun.DB, providerKey string) {
	providers, err := gitlabsync.ListAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "Repository-Provider konnten nicht geladen werden", err)
		return
	}
	for _, item := range providers {
		if strings.EqualFold(item.ProviderKey, strings.TrimSpace(providerKey)) {
			c.JSON(200, item)
			return
		}
	}
	if providerKey == "" {
		c.JSON(200, providers)
		return
	}
	httperror.StatusNotFound(c, "Repository-Provider konnte nach dem Speichern nicht geladen werden", errors.New("provider missing after write"))
}
