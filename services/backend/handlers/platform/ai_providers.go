package platform

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type createAIProviderRequest struct {
	ProviderKey      string  `json:"providerKey"`
	ProviderType     string  `json:"providerType"`
	Label            string  `json:"label"`
	BaseURL          string  `json:"baseUrl"`
	APIPath          string  `json:"apiPath"`
	APIVersion       string  `json:"apiVersion"`
	Region           string  `json:"region"`
	Organization     string  `json:"organization"`
	Token            string  `json:"token"`
	ChatModel        string  `json:"chatModel"`
	EmbeddingModel   string  `json:"embeddingModel"`
	Enabled          bool    `json:"enabled"`
	IsDefault        bool    `json:"isDefault"`
	TimeoutSeconds   int     `json:"timeoutSeconds"`
	MaxContextTokens int     `json:"maxContextTokens"`
	MaxOutputTokens  int     `json:"maxOutputTokens"`
	Temperature      float64 `json:"temperature"`
}

type updateAIProviderRequest struct {
	Label            string  `json:"label"`
	BaseURL          string  `json:"baseUrl"`
	APIPath          string  `json:"apiPath"`
	APIVersion       string  `json:"apiVersion"`
	Region           string  `json:"region"`
	Organization     string  `json:"organization"`
	Token            string  `json:"token"`
	ClearToken       bool    `json:"clearToken"`
	ChatModel        string  `json:"chatModel"`
	EmbeddingModel   string  `json:"embeddingModel"`
	Enabled          bool    `json:"enabled"`
	IsDefault        bool    `json:"isDefault"`
	TimeoutSeconds   int     `json:"timeoutSeconds"`
	MaxContextTokens int     `json:"maxContextTokens"`
	MaxOutputTokens  int     `json:"maxOutputTokens"`
	Temperature      float64 `json:"temperature"`
}

func ListAIProviders(c *gin.Context, db *bun.DB) {
	providers, err := aifunc.ListAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, providers)
}

func ListAvailableAIProviders(c *gin.Context, db *bun.DB) {
	providers, err := aifunc.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, providers)
}

func CreateAIProvider(c *gin.Context, db *bun.DB) {
	var req createAIProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige AI-Providerdaten", err)
		return
	}

	providerKey := strings.TrimSpace(req.ProviderKey)
	if providerKey == "" {
		httperror.StatusBadRequest(c, "AI-Provider-Schlüssel fehlt", errors.New("missing provider key"))
		return
	}
	providerType := aifunc.NormalizeProviderType(req.ProviderType)
	if !aifunc.IsProviderTypeSupported(providerType) {
		httperror.StatusBadRequest(c, "AI-Provider-Typ ist nicht unterstützt", errors.New("unsupported provider type"))
		return
	}
	if aifunc.ProviderTypeRequiresToken(providerType) && strings.TrimSpace(req.Token) == "" {
		httperror.StatusBadRequest(c, "API-Key des AI-Providers fehlt", errors.New("missing token"))
		return
	}

	_, found, err := loadAIProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht geladen werden", err)
		return
	}
	if found {
		httperror.StatusConflict(c, "AI-Provider existiert bereits", errors.New("provider already exists"))
		return
	}

	encryptedToken, tokenNonce, tokenKeyVersion := "", "", ""
	tokenConfigured := false
	if strings.TrimSpace(req.Token) != "" {
		var err error
		encryptedToken, tokenNonce, tokenKeyVersion, err = aifunc.EncryptProviderToken(config.Config, strings.TrimSpace(req.Token))
		if err != nil {
			httperror.InternalServerError(c, "AI-Provider-Token konnte nicht verschlüsselt werden", err)
			return
		}
		tokenConfigured = true
	}

	now := time.Now().UTC()
	settings := models.AIProviderSettings{
		ProviderKey:      providerKey,
		ProviderType:     providerType,
		Label:            strings.TrimSpace(req.Label),
		BaseURL:          normalizeAIProviderBaseURL(providerType, req.BaseURL),
		APIPath:          strings.TrimSpace(req.APIPath),
		APIVersion:       strings.TrimSpace(req.APIVersion),
		Region:           strings.TrimSpace(req.Region),
		Organization:     strings.TrimSpace(req.Organization),
		ChatModel:        normalizeAIProviderChatModel(providerType, req.ChatModel),
		EmbeddingModel:   strings.TrimSpace(req.EmbeddingModel),
		EncryptedToken:   encryptedToken,
		TokenNonce:       tokenNonce,
		TokenKeyVersion:  tokenKeyVersion,
		TokenConfigured:  tokenConfigured,
		Enabled:          req.Enabled,
		IsDefault:        req.IsDefault,
		TimeoutSeconds:   normalizeAIProviderTimeout(req.TimeoutSeconds),
		MaxContextTokens: normalizeAIProviderMaxContext(req.MaxContextTokens),
		MaxOutputTokens:  normalizeAIProviderMaxOutput(req.MaxOutputTokens),
		Temperature:      normalizeAIProviderTemperature(req.Temperature),
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	err = db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if settings.IsDefault {
			if _, err := tx.NewUpdate().Model((*models.AIProviderSettings)(nil)).Set("is_default = false").Where("is_default = true").Exec(ctx); err != nil {
				return err
			}
		}
		_, err := tx.NewInsert().Model(&settings).Exec(ctx)
		return err
	})
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht gespeichert werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.ai_provider.create", "created AI provider "+providerKey)
	respondWithAIProvider(c, db, providerKey)
}

func UpdateAIProvider(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "AI-Provider fehlt", errors.New("missing provider key"))
		return
	}

	existing, found, err := loadAIProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "AI-Provider ist nicht vorhanden", errors.New("provider not found"))
		return
	}

	var req updateAIProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige AI-Providerdaten", err)
		return
	}
	if req.ClearToken && strings.TrimSpace(req.Token) != "" {
		httperror.StatusBadRequest(c, "Token kann nicht gleichzeitig ersetzt und gelöscht werden", errors.New("conflicting token mutation"))
		return
	}
	providerType := aifunc.NormalizeProviderType(existing.ProviderType)

	encryptedToken := existing.EncryptedToken
	tokenNonce := existing.TokenNonce
	tokenKeyVersion := existing.TokenKeyVersion
	tokenConfigured := existing.TokenConfigured
	if req.ClearToken {
		if aifunc.ProviderTypeRequiresToken(providerType) {
			httperror.StatusBadRequest(c, "Dieser AI-Provider benötigt einen API-Key", errors.New("token required"))
			return
		}
		encryptedToken = ""
		tokenNonce = ""
		tokenKeyVersion = ""
		tokenConfigured = false
	} else if strings.TrimSpace(req.Token) != "" {
		encryptedToken, tokenNonce, tokenKeyVersion, err = aifunc.EncryptProviderToken(config.Config, strings.TrimSpace(req.Token))
		if err != nil {
			httperror.InternalServerError(c, "AI-Provider-Token konnte nicht verschlüsselt werden", err)
			return
		}
		tokenConfigured = true
	}
	if aifunc.ProviderTypeRequiresToken(providerType) && !tokenConfigured {
		httperror.StatusBadRequest(c, "Dieser AI-Provider benötigt einen API-Key", errors.New("token required"))
		return
	}

	settings := models.AIProviderSettings{
		ProviderKey:      providerKey,
		ProviderType:     providerType,
		Label:            strings.TrimSpace(req.Label),
		BaseURL:          normalizeAIProviderBaseURL(providerType, req.BaseURL),
		APIPath:          strings.TrimSpace(req.APIPath),
		APIVersion:       strings.TrimSpace(req.APIVersion),
		Region:           strings.TrimSpace(req.Region),
		Organization:     strings.TrimSpace(req.Organization),
		ChatModel:        normalizeAIProviderChatModel(providerType, req.ChatModel),
		EmbeddingModel:   strings.TrimSpace(req.EmbeddingModel),
		EncryptedToken:   encryptedToken,
		TokenNonce:       tokenNonce,
		TokenKeyVersion:  tokenKeyVersion,
		TokenConfigured:  tokenConfigured,
		Enabled:          req.Enabled,
		IsDefault:        req.IsDefault,
		TimeoutSeconds:   normalizeAIProviderTimeout(req.TimeoutSeconds),
		MaxContextTokens: normalizeAIProviderMaxContext(req.MaxContextTokens),
		MaxOutputTokens:  normalizeAIProviderMaxOutput(req.MaxOutputTokens),
		Temperature:      normalizeAIProviderTemperature(req.Temperature),
		CreatedAt:        existing.CreatedAt,
		UpdatedAt:        time.Now().UTC(),
	}

	err = db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if settings.IsDefault {
			if _, err := tx.NewUpdate().Model((*models.AIProviderSettings)(nil)).Set("is_default = false").Where("provider_key <> ?", providerKey).Exec(ctx); err != nil {
				return err
			}
		}
		_, err := tx.NewUpdate().
			Model(&settings).
			Where("provider_key = ?", providerKey).
			Column(
				"provider_type", "label", "base_url", "api_path", "api_version", "region", "organization", "chat_model", "embedding_model",
				"encrypted_token", "token_nonce", "token_key_version", "token_configured", "enabled", "is_default", "timeout_seconds",
				"max_context_tokens", "max_output_tokens", "temperature", "updated_at",
			).
			Exec(ctx)
		return err
	})
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht gespeichert werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.ai_provider.update", "updated AI provider "+providerKey)
	respondWithAIProvider(c, db, providerKey)
}

func DeleteAIProvider(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "AI-Provider fehlt", errors.New("missing provider key"))
		return
	}
	_, found, err := loadAIProviderSettings(c.Request.Context(), db, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "AI-Provider ist nicht vorhanden", errors.New("provider not found"))
		return
	}
	if _, err := db.NewDelete().Model((*models.AIProviderSettings)(nil)).Where("provider_key = ?", providerKey).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht gelöscht werden", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.ai_provider.delete", "deleted AI provider "+providerKey)
	c.JSON(200, gin.H{"deleted": true, "providerKey": providerKey})
}

func TestAIProvider(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	provider, found, err := aifunc.ResolveProvider(c.Request.Context(), db, config.Config, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "AI-Provider ist nicht verfügbar", errors.New("provider not found"))
		return
	}

	testCtx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(provider.TimeoutSeconds)*time.Second)
	defer cancel()
	client := aifunc.NewChatProvider(provider)
	if err := client.Validate(testCtx); err != nil {
		audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.ai_provider.test", "tested AI provider "+providerKey+" with error")
		c.JSON(200, gin.H{"ok": false, "providerKey": providerKey, "message": err.Error()})
		return
	}
	audit.WriteAudit(c.Request.Context(), db, c.GetString("user_id"), "settings.ai_provider.test", "tested AI provider "+providerKey)
	c.JSON(200, gin.H{"ok": true, "providerKey": providerKey})
}

func loadAIProviderSettings(ctx context.Context, db *bun.DB, providerKey string) (models.AIProviderSettings, bool, error) {
	var settings models.AIProviderSettings
	err := db.NewSelect().Model(&settings).Where("LOWER(provider_key) = LOWER(?)", strings.TrimSpace(providerKey)).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.AIProviderSettings{}, false, nil
		}
		return models.AIProviderSettings{}, false, err
	}
	return settings, true, nil
}

func respondWithAIProvider(c *gin.Context, db *bun.DB, providerKey string) {
	providers, err := aifunc.ListAdminProviders(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht geladen werden", err)
		return
	}
	for _, provider := range providers {
		if strings.EqualFold(provider.ProviderKey, providerKey) {
			c.JSON(200, provider)
			return
		}
	}
	httperror.StatusNotFound(c, "AI-Provider ist nicht vorhanden", errors.New("provider not found"))
}

func normalizeAIProviderBaseURL(providerType, value string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(value), "/")
	if baseURL != "" {
		return baseURL
	}
	return aifunc.DefaultBaseURL(providerType)
}

func normalizeAIProviderChatModel(providerType, value string) string {
	chatModel := strings.TrimSpace(value)
	if chatModel != "" {
		return chatModel
	}
	return aifunc.DefaultChatModel(providerType)
}

func normalizeAIProviderTimeout(value int) int {
	if value <= 0 {
		return 30
	}
	return value
}

func normalizeAIProviderMaxContext(value int) int {
	if value <= 0 {
		return 6000
	}
	return value
}

func normalizeAIProviderMaxOutput(value int) int {
	if value <= 0 {
		return 1200
	}
	return value
}

func normalizeAIProviderTemperature(value float64) float64 {
	if value <= 0 {
		return 0.2
	}
	if value > 2 {
		return 2
	}
	return value
}
