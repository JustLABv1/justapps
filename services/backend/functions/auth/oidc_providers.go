package auth

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

type OIDCProviderRuntime struct {
	Key              string
	Label            string
	Issuer           string
	ClientID         string
	ClientSecret     string
	AdminGroup       string
	Enabled          bool
	Insecure         bool
	DisableLocalAuth bool
	Scopes           []string
}

func NormalizeOIDCProviderKey(value string) string {
	return strings.TrimSpace(strings.ToLower(value))
}

func NormalizeOIDCScopes(values []string) []string {
	if len(values) == 0 {
		return []string{"openid", "profile", "email"}
	}

	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(strings.ToLower(value))
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return []string{"openid", "profile", "email"}
	}
	return normalized
}

func OIDCProviderHasSecret(record models.OIDCProviderSettings) bool {
	if record.SecretConfigured {
		return true
	}
	return strings.TrimSpace(record.EncryptedSecret) != "" && strings.TrimSpace(record.SecretNonce) != ""
}

func OIDCProviderLabel(record models.OIDCProviderSettings) string {
	label := strings.TrimSpace(record.Label)
	if label != "" {
		return label
	}
	if strings.TrimSpace(record.ProviderKey) != "" {
		return record.ProviderKey
	}
	return "oidc"
}

func LoadOIDCProviderSettings(ctx context.Context, db *bun.DB) ([]models.OIDCProviderSettings, error) {
	settings := make([]models.OIDCProviderSettings, 0)
	if db == nil {
		return settings, nil
	}
	if err := db.NewSelect().Model(&settings).Order("provider_key ASC").Scan(ctx); err != nil {
		return nil, err
	}
	return settings, nil
}

func ListOIDCProviderSummaries(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]models.OIDCProviderSummary, error) {
	_ = conf
	settings, err := LoadOIDCProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]models.OIDCProviderSummary, 0, len(settings))
	for _, record := range settings {
		if !record.Enabled {
			continue
		}
		configured := OIDCProviderHasSecret(record) && strings.TrimSpace(record.Issuer) != "" && strings.TrimSpace(record.ClientID) != ""
		providers = append(providers, models.OIDCProviderSummary{
			Key:              strings.TrimSpace(record.ProviderKey),
			Label:            OIDCProviderLabel(record),
			Issuer:           strings.TrimSpace(record.Issuer),
			ClientID:         strings.TrimSpace(record.ClientID),
			AdminGroup:       strings.TrimSpace(record.AdminGroup),
			Insecure:         record.Insecure,
			DisableLocalAuth: record.DisableLocalAuth,
			Scopes:           append([]string{}, NormalizeOIDCScopes(record.Scopes)...),
			Configured:       configured,
		})
	}

	return providers, nil
}

func ResolveOIDCProvider(ctx context.Context, db *bun.DB, conf *config.RestfulConf, providerKey string) (OIDCProviderRuntime, bool, error) {
	key := NormalizeOIDCProviderKey(providerKey)
	if key == "" {
		return OIDCProviderRuntime{}, false, nil
	}

	var record models.OIDCProviderSettings
	err := db.NewSelect().Model(&record).Where("LOWER(provider_key) = LOWER(?)", key).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return OIDCProviderRuntime{}, false, nil
		}
		return OIDCProviderRuntime{}, false, err
	}

	if !record.Enabled {
		return OIDCProviderRuntime{}, false, nil
	}

	secret, err := DecryptOIDCProviderSecret(conf, record.EncryptedSecret, record.SecretNonce, record.SecretKeyVersion)
	if err != nil {
		return OIDCProviderRuntime{}, false, err
	}

	runtime := OIDCProviderRuntime{
		Key:              strings.TrimSpace(record.ProviderKey),
		Label:            OIDCProviderLabel(record),
		Issuer:           strings.TrimRight(strings.TrimSpace(record.Issuer), "/"),
		ClientID:         strings.TrimSpace(record.ClientID),
		ClientSecret:     strings.TrimSpace(secret),
		AdminGroup:       normalizeOIDCAdminGroup(record.AdminGroup),
		Enabled:          record.Enabled,
		Insecure:         record.Insecure,
		DisableLocalAuth: record.DisableLocalAuth,
		Scopes:           NormalizeOIDCScopes(record.Scopes),
	}

	if runtime.Issuer == "" || runtime.ClientID == "" || runtime.ClientSecret == "" {
		return OIDCProviderRuntime{}, false, nil
	}

	return runtime, true, nil
}

func ListOIDCAdminProviders(ctx context.Context, db *bun.DB, conf *config.RestfulConf) ([]models.OIDCProviderAdminResponse, error) {
	_ = conf
	settings, err := LoadOIDCProviderSettings(ctx, db)
	if err != nil {
		return nil, err
	}

	providers := make([]models.OIDCProviderAdminResponse, 0, len(settings))
	for _, record := range settings {
		configured := OIDCProviderHasSecret(record) && strings.TrimSpace(record.Issuer) != "" && strings.TrimSpace(record.ClientID) != ""
		providers = append(providers, models.OIDCProviderAdminResponse{
			ProviderKey:      strings.TrimSpace(record.ProviderKey),
			Label:            OIDCProviderLabel(record),
			Issuer:           strings.TrimSpace(record.Issuer),
			ClientID:         strings.TrimSpace(record.ClientID),
			AdminGroup:       strings.TrimSpace(record.AdminGroup),
			Enabled:          record.Enabled,
			Insecure:         record.Insecure,
			DisableLocalAuth: record.DisableLocalAuth,
			Scopes:           append([]string{}, NormalizeOIDCScopes(record.Scopes)...),
			Configured:       configured,
			SecretConfigured: OIDCProviderHasSecret(record),
		})
	}

	return providers, nil
}

func normalizeOIDCAdminGroup(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "admin"
	}
	return trimmed
}
