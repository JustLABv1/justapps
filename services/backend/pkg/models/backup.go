package models

import (
	"time"

	"github.com/google/uuid"
)

type BackupMode string

const (
	BackupModeSafe BackupMode = "safe"
	BackupModeFull BackupMode = "full"
)

type BackupSectionSummary struct {
	Name      string `json:"name"`
	ItemCount int    `json:"itemCount"`
	Sensitive bool   `json:"sensitive"`
}

type BackupAsset struct {
	Filename      string    `json:"filename"`
	RelativePath  string    `json:"relativePath"`
	PublicURL     string    `json:"publicUrl"`
	Size          int64     `json:"size"`
	ModifiedAt    time.Time `json:"modifiedAt"`
	ContentType   string    `json:"contentType"`
	SHA256        string    `json:"sha256"`
	ContentBase64 string    `json:"contentBase64,omitempty"`
}

type BackupUser struct {
	ID             uuid.UUID  `json:"id"`
	Username       string     `json:"username"`
	Email          string     `json:"email"`
	Password       string     `json:"password,omitempty"`
	Role           string     `json:"role"`
	AuthType       string     `json:"authType"`
	CanSubmitApps  bool       `json:"canSubmitApps"`
	Disabled       bool       `json:"disabled"`
	DisabledReason string     `json:"disabledReason"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	LastLoginAt    *time.Time `json:"lastLoginAt,omitempty"`
}

type BackupToken struct {
	ID             uuid.UUID `json:"id"`
	Key            string    `json:"key,omitempty"`
	Description    string    `json:"description"`
	Type           string    `json:"type"`
	Disabled       bool      `json:"disabled"`
	DisabledReason string    `json:"disabledReason"`
	CreatedAt      time.Time `json:"createdAt"`
	ExpiresAt      time.Time `json:"expiresAt"`
	UserID         string    `json:"userId"`
}

type BackupData struct {
	Apps            []Apps                   `json:"apps,omitempty"`
	AppGroups       []AppGroup               `json:"appGroups,omitempty"`
	AppRelations    []AppRelation            `json:"appRelations,omitempty"`
	Users           []BackupUser             `json:"users,omitempty"`
	Settings        *PlatformSettings        `json:"settings,omitempty"`
	GitLabProviders []GitLabProviderSettings `json:"gitLabProviders,omitempty"`
	GitLabAppLinks  []GitLabAppLink          `json:"gitLabAppLinks,omitempty"`
	Tokens          []BackupToken            `json:"tokens,omitempty"`
	Favorites       []UserFavorite           `json:"favorites,omitempty"`
	Ratings         []Rating                 `json:"ratings,omitempty"`
	Audit           []Audit                  `json:"audit,omitempty"`
	Assets          []BackupAsset            `json:"assets,omitempty"`
}

type BackupManifest struct {
	SchemaVersion string                 `json:"schemaVersion"`
	ExportedAt    time.Time              `json:"exportedAt"`
	Mode          BackupMode             `json:"mode"`
	Sections      []string               `json:"sections"`
	Warnings      []string               `json:"warnings,omitempty"`
	Summary       []BackupSectionSummary `json:"summary"`
	Data          BackupData             `json:"data"`
}

type BackupKDFMetadata struct {
	Name        string `json:"name"`
	Salt        string `json:"salt"`
	Iterations  uint32 `json:"iterations"`
	MemoryKiB   uint32 `json:"memoryKiB"`
	Parallelism uint8  `json:"parallelism"`
	KeyLength   uint32 `json:"keyLength"`
}

type BackupCipherMetadata struct {
	Name  string `json:"name"`
	Nonce string `json:"nonce"`
}

type EncryptedBackupContainer struct {
	Format     string               `json:"format"`
	Version    string               `json:"version"`
	Encrypted  bool                 `json:"encrypted"`
	ExportedAt time.Time            `json:"exportedAt"`
	KDF        BackupKDFMetadata    `json:"kdf"`
	Cipher     BackupCipherMetadata `json:"cipher"`
	Payload    string               `json:"payload"`
}
