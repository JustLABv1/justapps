package gitlab

import (
	"strings"

	"justapps-backend/config"
	"justapps-backend/pkg/models"
)

// Syncer is the interface implemented by every repository provider adapter.
// Implementations should be stateless and create per-call HTTP clients with
// the timeout configured on the provider.
type Syncer interface {
	Sync(link models.GitLabAppLink) (SyncResult, error)
}

// NormalizeProviderType returns the canonical provider type identifier.
// Empty input defaults to "gitlab".
func NormalizeProviderType(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return "gitlab"
	}
	return normalized
}

// SupportedProviderTypes lists every provider type implemented by this package.
func SupportedProviderTypes() []string {
	return []string{"gitlab", "github"}
}

// IsProviderTypeSupported reports whether the given type identifier maps to a
// known adapter implementation.
func IsProviderTypeSupported(value string) bool {
	switch NormalizeProviderType(value) {
	case "gitlab", "github":
		return true
	default:
		return false
	}
}

// NewSyncer returns the adapter that handles the given provider configuration.
func NewSyncer(provider config.RepositoryProviderConf) Syncer {
	switch NormalizeProviderType(provider.Type) {
	case "github":
		return NewGitHubClient(provider)
	default:
		return NewClient(provider)
	}
}

// DefaultBaseURLForType returns the default base URL used when the provider
// configuration does not supply one.
func DefaultBaseURLForType(providerType string) string {
	switch NormalizeProviderType(providerType) {
	case "github":
		return "https://github.com"
	default:
		return "https://gitlab.com"
	}
}

// normalizeProviderBaseURL trims and applies a type-aware default if the
// supplied URL is empty. Trailing slashes are stripped to keep upstream URL
// composition consistent.
func normalizeProviderBaseURL(providerType, baseURL string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return DefaultBaseURLForType(providerType)
	}
	return strings.TrimRight(trimmed, "/")
}
