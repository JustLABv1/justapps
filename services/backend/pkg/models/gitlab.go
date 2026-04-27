package models

import (
	"time"

	"github.com/uptrace/bun"
)

type GitLabSyncSnapshot struct {
	ProjectID          int64    `json:"projectId"`
	ProjectName        string   `json:"projectName"`
	ProjectPath        string   `json:"projectPath"`
	ProjectWebURL      string   `json:"projectWebUrl"`
	DefaultBranch      string   `json:"defaultBranch"`
	Description        string   `json:"description"`
	Topics             []string `json:"topics"`
	License            string   `json:"license"`
	LastActivityAt     string   `json:"lastActivityAt"`
	ReadmePath         string   `json:"readmePath"`
	ReadmeContent      string   `json:"readmeContent"`
	HelmValuesPath     string   `json:"helmValuesPath"`
	HelmValuesContent  string   `json:"helmValuesContent"`
	ComposeFilePath    string   `json:"composeFilePath"`
	ComposeFileContent string   `json:"composeFileContent"`
	Warnings           []string `json:"warnings"`
	SyncedAt           string   `json:"syncedAt"`
}

type GitLabAppLink struct {
	bun.BaseModel `bun:"table:gitlab_app_links,alias:gal"`

	AppID              string             `bun:"app_id,pk" json:"appId"`
	ProviderType       string             `bun:"provider_type,notnull,default:'gitlab'" json:"providerType"`
	ProviderKey        string             `bun:"provider_key,notnull" json:"providerKey"`
	ProjectID          int64              `bun:"project_id,notnull,default:0" json:"projectId"`
	ProjectPath        string             `bun:"project_path,notnull" json:"projectPath"`
	ProjectWebURL      string             `bun:"project_web_url" json:"projectWebUrl"`
	Branch             string             `bun:"branch" json:"branch"`
	ReadmePath         string             `bun:"readme_path" json:"readmePath"`
	HelmValuesPath     string             `bun:"helm_values_path" json:"helmValuesPath"`
	ComposeFilePath    string             `bun:"compose_file_path" json:"composeFilePath"`
	LastSyncStatus     string             `bun:"last_sync_status,notnull,default:'never'" json:"lastSyncStatus"`
	LastSyncError      string             `bun:"last_sync_error" json:"lastSyncError"`
	LastSyncedAt       time.Time          `bun:"last_synced_at,nullzero" json:"lastSyncedAt"`
	Snapshot           GitLabSyncSnapshot `bun:"snapshot,type:jsonb,notnull,default:'{}'" json:"snapshot"`
	PendingSnapshot    GitLabSyncSnapshot `bun:"pending_snapshot,type:jsonb,notnull,default:'{}'" json:"pendingSnapshot"`
	ApprovalRequired   bool               `bun:"approval_required,notnull,default:false" json:"approvalRequired"`
	LastAppliedAt      time.Time          `bun:"last_applied_at,nullzero" json:"lastAppliedAt"`
	LastManualChangeAt time.Time          `bun:"last_manual_change_at,nullzero" json:"lastManualChangeAt"`
	CreatedAt          time.Time          `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt          time.Time          `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type GitLabProviderSettings struct {
	bun.BaseModel `bun:"table:gitlab_provider_settings,alias:gps"`

	ProviderKey            string    `bun:"provider_key,pk" json:"providerKey"`
	ProviderType           string    `bun:"provider_type,notnull,default:'gitlab'" json:"providerType"`
	Label                  string    `bun:"label" json:"label"`
	BaseURL                string    `bun:"base_url" json:"baseUrl"`
	NamespaceAllowlist     []string  `bun:"namespace_allowlist,type:jsonb,notnull,default:'[]'" json:"namespaceAllowlist"`
	Enabled                bool      `bun:"enabled,notnull,default:true" json:"enabled"`
	AutoSyncEnabled        bool      `bun:"auto_sync_enabled,notnull,default:true" json:"autoSyncEnabled"`
	SyncIntervalMinutes    int       `bun:"sync_interval_minutes,notnull,default:15" json:"syncIntervalMinutes"`
	DefaultReadmePath      string    `bun:"default_readme_path" json:"defaultReadmePath"`
	DefaultHelmValuesPath  string    `bun:"default_helm_values_path" json:"defaultHelmValuesPath"`
	DefaultComposeFilePath string    `bun:"default_compose_file_path" json:"defaultComposeFilePath"`
	CreatedAt              time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt              time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type GitLabProviderAdminResponse struct {
	ProviderKey            string   `json:"providerKey"`
	ProviderType           string   `json:"providerType"`
	Label                  string   `json:"label"`
	BaseURL                string   `json:"baseUrl"`
	NamespaceAllowlist     []string `json:"namespaceAllowlist"`
	Enabled                bool     `json:"enabled"`
	AutoSyncEnabled        bool     `json:"autoSyncEnabled"`
	SyncIntervalMinutes    int      `json:"syncIntervalMinutes"`
	DefaultReadmePath      string   `json:"defaultReadmePath"`
	DefaultHelmValuesPath  string   `json:"defaultHelmValuesPath"`
	DefaultComposeFilePath string   `json:"defaultComposeFilePath"`
	Configured             bool     `json:"configured"`
	TokenConfigured        bool     `json:"tokenConfigured"`
}

type GitLabProviderSummary struct {
	Key                    string   `json:"key"`
	Type                   string   `json:"type"`
	Label                  string   `json:"label"`
	BaseURL                string   `json:"baseUrl"`
	AutoSyncEnabled        bool     `json:"autoSyncEnabled"`
	SyncIntervalMinutes    int      `json:"syncIntervalMinutes"`
	DefaultReadmePath      string   `json:"defaultReadmePath"`
	DefaultHelmValuesPath  string   `json:"defaultHelmValuesPath"`
	DefaultComposeFilePath string   `json:"defaultComposeFilePath"`
	NamespaceAllowlist     []string `json:"namespaceAllowlist"`
}

type GitLabIntegrationResponse struct {
	Linked             bool                    `json:"linked"`
	AvailableProviders []GitLabProviderSummary `json:"availableProviders"`
	ProviderKey        string                  `json:"providerKey,omitempty"`
	ProviderType       string                  `json:"providerType,omitempty"`
	ProviderLabel      string                  `json:"providerLabel,omitempty"`
	BaseURL            string                  `json:"baseUrl,omitempty"`
	ProjectPath        string                  `json:"projectPath,omitempty"`
	ProjectWebURL      string                  `json:"projectWebUrl,omitempty"`
	Branch             string                  `json:"branch,omitempty"`
	ReadmePath         string                  `json:"readmePath,omitempty"`
	HelmValuesPath     string                  `json:"helmValuesPath,omitempty"`
	ComposeFilePath    string                  `json:"composeFilePath,omitempty"`
	LastSyncStatus     string                  `json:"lastSyncStatus,omitempty"`
	LastSyncError      string                  `json:"lastSyncError,omitempty"`
	ApprovalRequired   bool                    `json:"approvalRequired,omitempty"`
	LastSyncedAt       *time.Time              `json:"lastSyncedAt,omitempty"`
	LastAppliedAt      *time.Time              `json:"lastAppliedAt,omitempty"`
	LastManualChangeAt *time.Time              `json:"lastManualChangeAt,omitempty"`
	Snapshot           *GitLabSyncSnapshot     `json:"snapshot,omitempty"`
	PendingSnapshot    *GitLabSyncSnapshot     `json:"pendingSnapshot,omitempty"`
}

type GitLabSyncSummary struct {
	Linked           bool       `json:"linked"`
	ProviderKey      string     `json:"providerKey,omitempty"`
	ProviderType     string     `json:"providerType,omitempty"`
	ProjectPath      string     `json:"projectPath,omitempty"`
	LastSyncStatus   string     `json:"lastSyncStatus,omitempty"`
	LastSyncError    string     `json:"lastSyncError,omitempty"`
	ApprovalRequired bool       `json:"approvalRequired"`
	LastSyncedAt     *time.Time `json:"lastSyncedAt,omitempty"`
}
