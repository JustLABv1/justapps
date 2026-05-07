package platform

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"justapps-backend/config"
	authfunc "justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type createOIDCProviderRequest struct {
	ProviderKey      string   `json:"providerKey"`
	Label            string   `json:"label"`
	Issuer           string   `json:"issuer"`
	ClientID         string   `json:"clientId"`
	ClientSecret     string   `json:"clientSecret"`
	AdminGroup       string   `json:"adminGroup"`
	Enabled          bool     `json:"enabled"`
	Insecure         bool     `json:"insecure"`
	DisableLocalAuth bool     `json:"disableLocalAuth"`
	Scopes           []string `json:"scopes"`
}

type updateOIDCProviderRequest struct {
	Label            string   `json:"label"`
	Issuer           string   `json:"issuer"`
	ClientID         string   `json:"clientId"`
	ClientSecret     string   `json:"clientSecret"`
	ClearSecret      bool     `json:"clearSecret"`
	AdminGroup       string   `json:"adminGroup"`
	Enabled          bool     `json:"enabled"`
	Insecure         bool     `json:"insecure"`
	DisableLocalAuth bool     `json:"disableLocalAuth"`
	Scopes           []string `json:"scopes"`
}

func ListOIDCProviders(c *gin.Context, db *bun.DB) {
	providers, err := authfunc.ListOIDCAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnten nicht geladen werden", err)
		return
	}

	c.JSON(200, providers)
}

func ListAvailableOIDCProviders(c *gin.Context, db *bun.DB) {
	providers, err := authfunc.ListOIDCProviderSummaries(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnten nicht geladen werden", err)
		return
	}

	c.JSON(200, providers)
}

func CreateOIDCProvider(c *gin.Context, db *bun.DB) {
	var req createOIDCProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige OIDC-Providerdaten", err)
		return
	}

	providerKey := authfunc.NormalizeOIDCProviderKey(req.ProviderKey)
	if providerKey == "" {
		httperror.StatusBadRequest(c, "OIDC-Provider-Schlüssel fehlt", errors.New("missing provider key"))
		return
	}
	issuer := strings.TrimRight(strings.TrimSpace(req.Issuer), "/")
	if issuer == "" {
		httperror.StatusBadRequest(c, "OIDC-Issuer fehlt", errors.New("missing issuer"))
		return
	}
	clientID := strings.TrimSpace(req.ClientID)
	if clientID == "" {
		httperror.StatusBadRequest(c, "OIDC-Client-ID fehlt", errors.New("missing client id"))
		return
	}
	clientSecret := strings.TrimSpace(req.ClientSecret)
	if clientSecret == "" {
		httperror.StatusBadRequest(c, "OIDC-Client-Secret fehlt", errors.New("missing client secret"))
		return
	}

	_, found, err := loadOIDCProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht geladen werden", err)
		return
	}
	if found {
		httperror.StatusConflict(c, "OIDC-Provider existiert bereits", errors.New("provider already exists"))
		return
	}

	encryptedSecret, secretNonce, secretKeyVersion, err := authfunc.EncryptOIDCProviderSecret(config.Config, clientSecret)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Client-Secret konnte nicht verschlüsselt werden", err)
		return
	}

	now := time.Now().UTC()
	settings := models.OIDCProviderSettings{
		ProviderKey:      providerKey,
		Label:            strings.TrimSpace(req.Label),
		Issuer:           issuer,
		ClientID:         clientID,
		AdminGroup:       normalizeOIDCAdminGroup(req.AdminGroup),
		EncryptedSecret:  encryptedSecret,
		SecretNonce:      secretNonce,
		SecretKeyVersion: secretKeyVersion,
		SecretConfigured: true,
		Enabled:          req.Enabled,
		Insecure:         req.Insecure,
		DisableLocalAuth: req.DisableLocalAuth,
		Scopes:           authfunc.NormalizeOIDCScopes(req.Scopes),
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if _, err := db.NewInsert().Model(&settings).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht gespeichert werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.oidc_provider.create", "created oidc provider "+providerKey)
	respondWithOIDCProvider(c, db, providerKey)
}

func UpdateOIDCProvider(c *gin.Context, db *bun.DB) {
	providerKey := authfunc.NormalizeOIDCProviderKey(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "OIDC-Provider fehlt", errors.New("missing provider key"))
		return
	}

	existing, found, err := loadOIDCProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "OIDC-Provider ist nicht vorhanden", errors.New("provider not found"))
		return
	}

	var req updateOIDCProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige OIDC-Providerdaten", err)
		return
	}
	if req.ClearSecret && strings.TrimSpace(req.ClientSecret) != "" {
		httperror.StatusBadRequest(c, "Client-Secret kann nicht gleichzeitig ersetzt und gelöscht werden", errors.New("conflicting secret mutation"))
		return
	}

	issuer := strings.TrimRight(strings.TrimSpace(req.Issuer), "/")
	if issuer == "" {
		issuer = strings.TrimRight(strings.TrimSpace(existing.Issuer), "/")
	}
	if issuer == "" {
		httperror.StatusBadRequest(c, "OIDC-Issuer fehlt", errors.New("missing issuer"))
		return
	}

	clientID := strings.TrimSpace(req.ClientID)
	if clientID == "" {
		clientID = strings.TrimSpace(existing.ClientID)
	}
	if clientID == "" {
		httperror.StatusBadRequest(c, "OIDC-Client-ID fehlt", errors.New("missing client id"))
		return
	}

	encryptedSecret := existing.EncryptedSecret
	secretNonce := existing.SecretNonce
	secretKeyVersion := existing.SecretKeyVersion
	secretConfigured := existing.SecretConfigured
	if req.ClearSecret {
		encryptedSecret = ""
		secretNonce = ""
		secretKeyVersion = ""
		secretConfigured = false
	} else if strings.TrimSpace(req.ClientSecret) != "" {
		encryptedSecret, secretNonce, secretKeyVersion, err = authfunc.EncryptOIDCProviderSecret(config.Config, strings.TrimSpace(req.ClientSecret))
		if err != nil {
			httperror.InternalServerError(c, "OIDC-Client-Secret konnte nicht verschlüsselt werden", err)
			return
		}
		secretConfigured = true
	}

	settings := models.OIDCProviderSettings{
		ProviderKey:      providerKey,
		Label:            strings.TrimSpace(req.Label),
		Issuer:           issuer,
		ClientID:         clientID,
		AdminGroup:       normalizeOIDCAdminGroup(req.AdminGroup),
		EncryptedSecret:  encryptedSecret,
		SecretNonce:      secretNonce,
		SecretKeyVersion: secretKeyVersion,
		SecretConfigured: secretConfigured,
		Enabled:          req.Enabled,
		Insecure:         req.Insecure,
		DisableLocalAuth: req.DisableLocalAuth,
		Scopes:           authfunc.NormalizeOIDCScopes(req.Scopes),
		CreatedAt:        existing.CreatedAt,
		UpdatedAt:        time.Now().UTC(),
	}

	_, err = db.NewUpdate().
		Model(&settings).
		Where("provider_key = ?", providerKey).
		Column(
			"label", "issuer", "client_id", "admin_group", "encrypted_secret", "secret_nonce", "secret_key_version", "secret_configured",
			"enabled", "insecure", "disable_local_auth", "scopes", "updated_at",
		).
		Exec(c.Request.Context())
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht gespeichert werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.oidc_provider.update", "updated oidc provider "+providerKey)
	respondWithOIDCProvider(c, db, providerKey)
}

func DeleteOIDCProvider(c *gin.Context, db *bun.DB) {
	providerKey := authfunc.NormalizeOIDCProviderKey(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "OIDC-Provider fehlt", errors.New("missing provider key"))
		return
	}

	_, found, err := loadOIDCProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "OIDC-Provider ist nicht vorhanden", errors.New("provider not found"))
		return
	}

	if _, err := db.NewDelete().Model((*models.OIDCProviderSettings)(nil)).Where("provider_key = ?", providerKey).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht gelöscht werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.oidc_provider.delete", "deleted oidc provider "+providerKey)
	c.JSON(200, gin.H{"deleted": true, "providerKey": providerKey})
}

func loadOIDCProviderSettings(ctx context.Context, db *bun.DB, providerKey string) (models.OIDCProviderSettings, bool, error) {
	var settings models.OIDCProviderSettings
	err := db.NewSelect().Model(&settings).Where("LOWER(provider_key) = LOWER(?)", authfunc.NormalizeOIDCProviderKey(providerKey)).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.OIDCProviderSettings{}, false, nil
		}
		return models.OIDCProviderSettings{}, false, err
	}
	return settings, true, nil
}

func respondWithOIDCProvider(c *gin.Context, db *bun.DB, providerKey string) {
	providers, err := authfunc.ListOIDCAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnten nicht geladen werden", err)
		return
	}
	for _, item := range providers {
		if strings.EqualFold(item.ProviderKey, authfunc.NormalizeOIDCProviderKey(providerKey)) {
			c.JSON(200, item)
			return
		}
	}
	httperror.StatusNotFound(c, "OIDC-Provider konnte nach dem Speichern nicht geladen werden", errors.New("provider missing after write"))
}

func normalizeOIDCAdminGroup(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "admin"
	}
	return trimmed
}
