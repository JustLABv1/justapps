package ai

import (
	"context"
	"strings"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

const (
	ProviderTypeOpenAI           = "openai"
	ProviderTypeAzureOpenAI      = "azure-openai"
	ProviderTypeAnthropic        = "anthropic"
	ProviderTypeGemini           = "gemini"
	ProviderTypeMistral          = "mistral"
	ProviderTypeCohere           = "cohere"
	ProviderTypeOllama           = "ollama"
	ProviderTypeVLLM             = "vllm"
	ProviderTypeOpenAICompatible = "openai-compatible"
	ProviderTypeOpenRouter       = "openrouter"
	ProviderTypeLMStudio         = "lmstudio"
	ProviderTypeTogether         = "together"
)

func NormalizeProviderType(providerType string) string {
	normalized := strings.ToLower(strings.TrimSpace(providerType))
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = strings.ReplaceAll(normalized, " ", "-")
	switch normalized {
	case "", "custom", "compatible":
		return ProviderTypeOpenAICompatible
	case "azure", "azure-openai", "azure-open-ai":
		return ProviderTypeAzureOpenAI
	case "google", "google-gemini":
		return ProviderTypeGemini
	case "lm-studio", "lmstudio":
		return ProviderTypeLMStudio
	default:
		return normalized
	}
}

func IsProviderTypeSupported(providerType string) bool {
	switch NormalizeProviderType(providerType) {
	case ProviderTypeOpenAI, ProviderTypeAzureOpenAI, ProviderTypeAnthropic, ProviderTypeGemini, ProviderTypeMistral, ProviderTypeCohere, ProviderTypeOllama, ProviderTypeVLLM, ProviderTypeOpenAICompatible, ProviderTypeOpenRouter, ProviderTypeLMStudio, ProviderTypeTogether:
		return true
	default:
		return false
	}
}

func ProviderTypeRequiresToken(providerType string) bool {
	switch NormalizeProviderType(providerType) {
	case ProviderTypeOllama, ProviderTypeVLLM, ProviderTypeLMStudio, ProviderTypeOpenAICompatible:
		return false
	default:
		return true
	}
}

func ProviderTypeIsLocal(providerType string) bool {
	switch NormalizeProviderType(providerType) {
	case ProviderTypeOllama, ProviderTypeVLLM, ProviderTypeLMStudio:
		return true
	default:
		return false
	}
}

func DefaultBaseURL(providerType string) string {
	switch NormalizeProviderType(providerType) {
	case ProviderTypeOpenAI:
		return "https://api.openai.com/v1"
	case ProviderTypeAnthropic:
		return "https://api.anthropic.com"
	case ProviderTypeGemini:
		return "https://generativelanguage.googleapis.com"
	case ProviderTypeMistral:
		return "https://api.mistral.ai/v1"
	case ProviderTypeCohere:
		return "https://api.cohere.com"
	case ProviderTypeOllama:
		return "http://localhost:11434"
	case ProviderTypeVLLM:
		return "http://localhost:8000/v1"
	case ProviderTypeOpenRouter:
		return "https://openrouter.ai/api/v1"
	case ProviderTypeLMStudio:
		return "http://localhost:1234/v1"
	case ProviderTypeTogether:
		return "https://api.together.xyz/v1"
	default:
		return ""
	}
}

func DefaultChatModel(providerType string) string {
	switch NormalizeProviderType(providerType) {
	case ProviderTypeOpenAI, ProviderTypeOpenAICompatible, ProviderTypeOpenRouter, ProviderTypeTogether:
		return "gpt-4o-mini"
	case ProviderTypeAnthropic:
		return "claude-3-5-haiku-latest"
	case ProviderTypeGemini:
		return "gemini-1.5-flash"
	case ProviderTypeMistral:
		return "mistral-small-latest"
	case ProviderTypeCohere:
		return "command-r"
	case ProviderTypeOllama:
		return "llama3.1"
	case ProviderTypeVLLM, ProviderTypeLMStudio:
		return "local-model"
	default:
		return ""
	}
}

func ProviderLabel(record models.AIProviderSettings) string {
	label := strings.TrimSpace(record.Label)
	if label != "" {
		return label
	}
	if strings.TrimSpace(record.ProviderKey) != "" {
		return record.ProviderKey
	}
	return NormalizeProviderType(record.ProviderType)
}

func ListProviderRuntimes(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]ProviderRuntime, error) {
	records, err := loadProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]ProviderRuntime, 0, len(records))
	for _, record := range records {
		provider, ok := buildProviderRuntime(conf, record)
		if !ok {
			continue
		}
		providers = append(providers, provider)
	}
	return providers, nil
}

func ResolveProvider(ctx context.Context, db *bun.DB, conf *config.RestfulConf, key string) (ProviderRuntime, bool, error) {
	providers, err := ListProviderRuntimes(ctx, db, conf)
	if err != nil {
		return ProviderRuntime{}, false, err
	}

	trimmedKey := strings.TrimSpace(key)
	if trimmedKey != "" {
		for _, provider := range providers {
			if provider.Enabled && strings.EqualFold(provider.Key, trimmedKey) {
				return provider, true, nil
			}
		}
		return ProviderRuntime{}, false, nil
	}

	for _, provider := range providers {
		if provider.Enabled && provider.IsDefault {
			return provider, true, nil
		}
	}
	for _, provider := range providers {
		if provider.Enabled {
			return provider, true, nil
		}
	}
	return ProviderRuntime{}, false, nil
}

func ListProviderSummaries(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]models.AIProviderSummary, error) {
	providers, err := ListProviderRuntimes(ctx, db, conf)
	if err != nil {
		return nil, err
	}

	summaries := make([]models.AIProviderSummary, 0, len(providers))
	for _, provider := range providers {
		if !provider.Enabled {
			continue
		}
		summaries = append(summaries, models.AIProviderSummary{
			Key:             provider.Key,
			Type:            provider.Type,
			Label:           provider.Label,
			ChatModel:       provider.ChatModel,
			BaseURL:         provider.BaseURL,
			Default:         provider.IsDefault,
			TokenConfigured: strings.TrimSpace(provider.Token) != "",
		})
	}
	return summaries, nil
}

func ListAdminProviders(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]models.AIProviderAdminResponse, error) {
	records, err := loadProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]models.AIProviderAdminResponse, 0, len(records))
	for _, record := range records {
		providerType := NormalizeProviderType(record.ProviderType)
		requiresToken := ProviderTypeRequiresToken(providerType)
		tokenConfigured := providerHasToken(record)
		providers = append(providers, models.AIProviderAdminResponse{
			ProviderKey:      strings.TrimSpace(record.ProviderKey),
			ProviderType:     providerType,
			Label:            ProviderLabel(record),
			BaseURL:          normalizeProviderBaseURL(providerType, record.BaseURL),
			APIPath:          strings.TrimSpace(record.APIPath),
			APIVersion:       strings.TrimSpace(record.APIVersion),
			Region:           strings.TrimSpace(record.Region),
			Organization:     strings.TrimSpace(record.Organization),
			ChatModel:        providerChatModel(providerType, record.ChatModel),
			EmbeddingModel:   strings.TrimSpace(record.EmbeddingModel),
			Enabled:          record.Enabled,
			IsDefault:        record.IsDefault,
			Configured:       record.Enabled && (!requiresToken || tokenConfigured),
			TokenConfigured:  tokenConfigured,
			RequiresToken:    requiresToken,
			TimeoutSeconds:   providerTimeout(record.TimeoutSeconds),
			MaxContextTokens: providerMaxContextTokens(record.MaxContextTokens),
			MaxOutputTokens:  providerMaxOutputTokens(record.MaxOutputTokens),
			Temperature:      providerTemperature(record.Temperature),
		})
	}
	return providers, nil
}

func loadProviderSettings(ctx context.Context, db *bun.DB) ([]models.AIProviderSettings, error) {
	settings := make([]models.AIProviderSettings, 0)
	if db == nil {
		return settings, nil
	}
	if err := db.NewSelect().Model(&settings).Order("provider_key ASC").Scan(ctx); err != nil {
		return nil, err
	}
	return settings, nil
}

func buildProviderRuntime(conf *config.RestfulConf, record models.AIProviderSettings) (ProviderRuntime, bool) {
	key := strings.TrimSpace(record.ProviderKey)
	providerType := NormalizeProviderType(record.ProviderType)
	if key == "" || !IsProviderTypeSupported(providerType) {
		return ProviderRuntime{}, false
	}

	token := ""
	if providerHasToken(record) {
		decryptedToken, err := DecryptProviderToken(conf, record.EncryptedToken, record.TokenNonce, record.TokenKeyVersion)
		if err != nil {
			log.WithError(err).WithField("providerKey", key).Error("AI provider token decryption failed")
			return ProviderRuntime{}, false
		}
		token = strings.TrimSpace(decryptedToken)
	}
	if ProviderTypeRequiresToken(providerType) && token == "" {
		return ProviderRuntime{}, false
	}

	return ProviderRuntime{
		Key:              key,
		Type:             providerType,
		Label:            ProviderLabel(record),
		BaseURL:          normalizeProviderBaseURL(providerType, record.BaseURL),
		APIPath:          strings.TrimSpace(record.APIPath),
		APIVersion:       strings.TrimSpace(record.APIVersion),
		Region:           strings.TrimSpace(record.Region),
		Organization:     strings.TrimSpace(record.Organization),
		Token:            token,
		ChatModel:        providerChatModel(providerType, record.ChatModel),
		EmbeddingModel:   strings.TrimSpace(record.EmbeddingModel),
		Enabled:          record.Enabled,
		IsDefault:        record.IsDefault,
		TimeoutSeconds:   providerTimeout(record.TimeoutSeconds),
		MaxContextTokens: providerMaxContextTokens(record.MaxContextTokens),
		MaxOutputTokens:  providerMaxOutputTokens(record.MaxOutputTokens),
		Temperature:      providerTemperature(record.Temperature),
	}, true
}

func providerHasToken(record models.AIProviderSettings) bool {
	if record.TokenConfigured {
		return true
	}
	return strings.TrimSpace(record.EncryptedToken) != "" && strings.TrimSpace(record.TokenNonce) != ""
}

func normalizeProviderBaseURL(providerType, value string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(value), "/")
	if baseURL != "" {
		return baseURL
	}
	return DefaultBaseURL(providerType)
}

func providerChatModel(providerType, value string) string {
	chatModel := strings.TrimSpace(value)
	if chatModel != "" {
		return chatModel
	}
	return DefaultChatModel(providerType)
}

func providerTimeout(value int) int {
	if value <= 0 {
		return 30
	}
	return value
}

func providerMaxContextTokens(value int) int {
	if value <= 0 {
		return 6000
	}
	return value
}

func providerMaxOutputTokens(value int) int {
	if value <= 0 {
		return 1200
	}
	return value
}

func providerTemperature(value float64) float64 {
	if value < 0 {
		return 0.2
	}
	if value > 2 {
		return 2
	}
	if value == 0 {
		return 0.2
	}
	return value
}
