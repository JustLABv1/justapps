package gitlab

import (
	"context"
	"strings"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

type ProviderRuntime struct {
	Key                    string
	Label                  string
	BaseURL                string
	Token                  string
	Enabled                bool
	AutoSyncEnabled        bool
	SyncIntervalMinutes    int
	NamespaceAllowlist     []string
	DefaultReadmePath      string
	DefaultHelmValuesPath  string
	DefaultComposeFilePath string
	TimeoutSeconds         int
}

func ListProviderRuntimes(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]ProviderRuntime, error) {
	providerSettings, err := loadProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]ProviderRuntime, 0, len(conf.GitLab.Providers))
	for _, configuredProvider := range conf.GitLab.Providers {
		key := strings.TrimSpace(configuredProvider.Key)
		if key == "" || strings.TrimSpace(configuredProvider.Token) == "" {
			continue
		}

		provider := ProviderRuntime{
			Key:                 key,
			Label:               providerLabel(configuredProvider),
			BaseURL:             normalizeBaseURL(configuredProvider.BaseURL),
			Token:               configuredProvider.Token,
			Enabled:             configuredProvider.Enabled,
			AutoSyncEnabled:     true,
			SyncIntervalMinutes: 15,
			NamespaceAllowlist:  append([]string{}, configuredProvider.NamespaceAllowlist...),
			TimeoutSeconds:      configuredProvider.TimeoutSeconds,
		}
		if provider.TimeoutSeconds <= 0 {
			provider.TimeoutSeconds = 15
		}

		if settings, ok := providerSettings[key]; ok {
			if strings.TrimSpace(settings.Label) != "" {
				provider.Label = strings.TrimSpace(settings.Label)
			}
			if strings.TrimSpace(settings.BaseURL) != "" {
				provider.BaseURL = normalizeBaseURL(settings.BaseURL)
			}
			if len(settings.NamespaceAllowlist) > 0 {
				provider.NamespaceAllowlist = append([]string{}, settings.NamespaceAllowlist...)
			}
			provider.Enabled = provider.Enabled && settings.Enabled
			provider.AutoSyncEnabled = settings.AutoSyncEnabled
			if settings.SyncIntervalMinutes > 0 {
				provider.SyncIntervalMinutes = settings.SyncIntervalMinutes
			}
			provider.DefaultReadmePath = strings.TrimSpace(settings.DefaultReadmePath)
			provider.DefaultHelmValuesPath = strings.TrimSpace(settings.DefaultHelmValuesPath)
			provider.DefaultComposeFilePath = strings.TrimSpace(settings.DefaultComposeFilePath)
		}

		providers = append(providers, provider)
	}

	return providers, nil
}

func ListProviderSummaries(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]models.GitLabProviderSummary, error) {
	providers, err := ListProviderRuntimes(ctx, db, conf)
	if err != nil {
		return nil, err
	}

	summaries := make([]models.GitLabProviderSummary, 0, len(providers))
	for _, provider := range providers {
		if !provider.Enabled {
			continue
		}
		summaries = append(summaries, models.GitLabProviderSummary{
			Key:                    provider.Key,
			Label:                  provider.Label,
			BaseURL:                provider.BaseURL,
			AutoSyncEnabled:        provider.AutoSyncEnabled,
			SyncIntervalMinutes:    provider.SyncIntervalMinutes,
			DefaultReadmePath:      provider.DefaultReadmePath,
			DefaultHelmValuesPath:  provider.DefaultHelmValuesPath,
			DefaultComposeFilePath: provider.DefaultComposeFilePath,
			NamespaceAllowlist:     append([]string{}, provider.NamespaceAllowlist...),
		})
	}

	return summaries, nil
}

func ResolveProvider(ctx context.Context, db *bun.DB, conf *config.RestfulConf, key string) (ProviderRuntime, bool, error) {
	providers, err := ListProviderRuntimes(ctx, db, conf)
	if err != nil {
		return ProviderRuntime{}, false, err
	}

	for _, provider := range providers {
		if strings.EqualFold(provider.Key, strings.TrimSpace(key)) {
			return provider, true, nil
		}
	}

	return ProviderRuntime{}, false, nil
}

func ListAdminProviders(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]models.GitLabProviderAdminResponse, error) {
	providerSettings, err := loadProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]models.GitLabProviderAdminResponse, 0, len(conf.GitLab.Providers))
	for _, configuredProvider := range conf.GitLab.Providers {
		key := strings.TrimSpace(configuredProvider.Key)
		if key == "" {
			continue
		}

		response := models.GitLabProviderAdminResponse{
			ProviderKey:         key,
			Label:               providerLabel(configuredProvider),
			BaseURL:             normalizeBaseURL(configuredProvider.BaseURL),
			NamespaceAllowlist:  append([]string{}, configuredProvider.NamespaceAllowlist...),
			Enabled:             configuredProvider.Enabled,
			AutoSyncEnabled:     true,
			SyncIntervalMinutes: 15,
			Configured:          configuredProvider.Enabled && strings.TrimSpace(configuredProvider.Token) != "",
			TokenConfigured:     strings.TrimSpace(configuredProvider.Token) != "",
		}

		if configuredProvider.TimeoutSeconds <= 0 {
			configuredProvider.TimeoutSeconds = 15
		}

		if settings, ok := providerSettings[key]; ok {
			if strings.TrimSpace(settings.Label) != "" {
				response.Label = strings.TrimSpace(settings.Label)
			}
			if strings.TrimSpace(settings.BaseURL) != "" {
				response.BaseURL = normalizeBaseURL(settings.BaseURL)
			}
			if len(settings.NamespaceAllowlist) > 0 {
				response.NamespaceAllowlist = append([]string{}, settings.NamespaceAllowlist...)
			}
			response.Enabled = configuredProvider.Enabled && settings.Enabled
			response.AutoSyncEnabled = settings.AutoSyncEnabled
			if settings.SyncIntervalMinutes > 0 {
				response.SyncIntervalMinutes = settings.SyncIntervalMinutes
			}
			response.DefaultReadmePath = strings.TrimSpace(settings.DefaultReadmePath)
			response.DefaultHelmValuesPath = strings.TrimSpace(settings.DefaultHelmValuesPath)
			response.DefaultComposeFilePath = strings.TrimSpace(settings.DefaultComposeFilePath)
		}

		providers = append(providers, response)
	}

	return providers, nil
}

func loadProviderSettings(ctx context.Context, db *bun.DB) (map[string]models.GitLabProviderSettings, error) {
	settingsMap := make(map[string]models.GitLabProviderSettings)
	if db == nil {
		return settingsMap, nil
	}

	settings := make([]models.GitLabProviderSettings, 0)
	if err := db.NewSelect().Model(&settings).Scan(ctx); err != nil {
		return nil, err
	}

	for _, setting := range settings {
		settingsMap[strings.TrimSpace(setting.ProviderKey)] = setting
	}

	return settingsMap, nil
}
