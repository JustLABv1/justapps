package gitlab

import (
	"context"
	"strings"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

type ProviderRuntime struct {
	Key                    string
	Type                   string
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
	providerRecords, err := loadProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]ProviderRuntime, 0, len(providerRecords))
	for _, providerRecord := range providerRecords {
		provider, ok := buildProviderRuntime(conf, providerRecord)
		if !ok {
			continue
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
			Type:                   provider.Type,
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
	providerRecords, err := loadProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}
	linkedCounts, err := loadLinkedAppCounts(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]models.GitLabProviderAdminResponse, 0, len(providerRecords))
	for _, providerRecord := range providerRecords {
		key := strings.TrimSpace(providerRecord.ProviderKey)
		if key == "" {
			continue
		}

		response := models.GitLabProviderAdminResponse{
			ProviderKey:            key,
			ProviderType:           NormalizeProviderType(providerRecord.ProviderType),
			Label:                  providerLabel(config.RepositoryProviderConf{Key: providerRecord.ProviderKey, Label: providerRecord.Label}),
			BaseURL:                normalizeProviderBaseURL(providerRecord.ProviderType, providerRecord.BaseURL),
			LinkedAppsCount:        linkedCounts[key],
			NamespaceAllowlist:     append([]string{}, providerRecord.NamespaceAllowlist...),
			Enabled:                providerRecord.Enabled,
			AutoSyncEnabled:        providerRecord.AutoSyncEnabled,
			SyncIntervalMinutes:    providerSyncInterval(providerRecord.SyncIntervalMinutes),
			DefaultReadmePath:      strings.TrimSpace(providerRecord.DefaultReadmePath),
			DefaultHelmValuesPath:  strings.TrimSpace(providerRecord.DefaultHelmValuesPath),
			DefaultComposeFilePath: strings.TrimSpace(providerRecord.DefaultComposeFilePath),
			Configured:             providerRecord.Enabled && providerHasToken(providerRecord),
			TokenConfigured:        providerHasToken(providerRecord),
		}

		providers = append(providers, response)
	}

	return providers, nil
}

func loadProviderSettings(ctx context.Context, db *bun.DB) ([]models.GitLabProviderSettings, error) {
	settings := make([]models.GitLabProviderSettings, 0)
	if db == nil {
		return settings, nil
	}

	if err := db.NewSelect().Model(&settings).Order("provider_key ASC").Scan(ctx); err != nil {
		return nil, err
	}
	return settings, nil
}

func buildProviderRuntime(conf *config.RestfulConf, providerRecord models.GitLabProviderSettings) (ProviderRuntime, bool) {
	key := strings.TrimSpace(providerRecord.ProviderKey)
	if key == "" || !providerHasToken(providerRecord) {
		return ProviderRuntime{}, false
	}

	token, err := DecryptProviderToken(conf, providerRecord.EncryptedToken, providerRecord.TokenNonce, providerRecord.TokenKeyVersion)
	if err != nil {
		log.WithError(err).WithField("providerKey", key).Error("Repository provider token decryption failed")
		return ProviderRuntime{}, false
	}
	if strings.TrimSpace(token) == "" {
		return ProviderRuntime{}, false
	}

	providerType := NormalizeProviderType(providerRecord.ProviderType)
	provider := ProviderRuntime{
		Key:                    key,
		Type:                   providerType,
		Label:                  providerLabel(config.RepositoryProviderConf{Key: providerRecord.ProviderKey, Label: providerRecord.Label}),
		BaseURL:                normalizeProviderBaseURL(providerType, providerRecord.BaseURL),
		Token:                  token,
		Enabled:                providerRecord.Enabled,
		AutoSyncEnabled:        providerRecord.AutoSyncEnabled,
		SyncIntervalMinutes:    providerSyncInterval(providerRecord.SyncIntervalMinutes),
		NamespaceAllowlist:     append([]string{}, providerRecord.NamespaceAllowlist...),
		DefaultReadmePath:      strings.TrimSpace(providerRecord.DefaultReadmePath),
		DefaultHelmValuesPath:  strings.TrimSpace(providerRecord.DefaultHelmValuesPath),
		DefaultComposeFilePath: strings.TrimSpace(providerRecord.DefaultComposeFilePath),
		TimeoutSeconds:         15,
	}
	return provider, true
}

func providerHasToken(providerRecord models.GitLabProviderSettings) bool {
	if providerRecord.TokenConfigured {
		return true
	}
	return strings.TrimSpace(providerRecord.EncryptedToken) != "" && strings.TrimSpace(providerRecord.TokenNonce) != ""
}

func providerSyncInterval(value int) int {
	if value <= 0 {
		return 15
	}
	return value
}

func loadLinkedAppCounts(ctx context.Context, db *bun.DB) (map[string]int, error) {
	counts := make(map[string]int)
	if db == nil {
		return counts, nil
	}

	type linkedAppCountRow struct {
		ProviderKey string `bun:"provider_key"`
		Count       int    `bun:"count"`
	}
	rows := make([]linkedAppCountRow, 0)
	if err := db.NewSelect().
		Model((*models.GitLabAppLink)(nil)).
		Column("provider_key").
		ColumnExpr("COUNT(*) AS count").
		Group("provider_key").
		Scan(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[strings.TrimSpace(row.ProviderKey)] = row.Count
	}
	return counts, nil
}
