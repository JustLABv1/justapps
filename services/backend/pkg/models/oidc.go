package models

import (
	"time"

	"github.com/uptrace/bun"
)

type OIDCProviderSettings struct {
	bun.BaseModel `bun:"table:oidc_provider_settings,alias:ops"`

	ProviderKey      string    `bun:"provider_key,pk" json:"providerKey"`
	Label            string    `bun:"label,notnull,default:''" json:"label"`
	Issuer           string    `bun:"issuer,notnull,default:''" json:"issuer"`
	ClientID         string    `bun:"client_id,notnull,default:''" json:"clientId"`
	AdminGroup       string    `bun:"admin_group,notnull,default:'admin'" json:"adminGroup"`
	EncryptedSecret  string    `bun:"encrypted_secret,notnull,default:''" json:"encryptedSecret,omitempty"`
	SecretNonce      string    `bun:"secret_nonce,notnull,default:''" json:"secretNonce,omitempty"`
	SecretKeyVersion string    `bun:"secret_key_version,notnull,default:'v1'" json:"secretKeyVersion,omitempty"`
	SecretConfigured bool      `bun:"secret_configured,notnull,default:false" json:"secretConfigured"`
	Enabled          bool      `bun:"enabled,notnull,default:true" json:"enabled"`
	Insecure         bool      `bun:"insecure,notnull,default:false" json:"insecure"`
	DisableLocalAuth bool      `bun:"disable_local_auth,notnull,default:false" json:"disableLocalAuth"`
	Scopes           []string  `bun:"scopes,type:jsonb,notnull" json:"scopes"`
	CreatedAt        time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt        time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type OIDCProviderAdminResponse struct {
	ProviderKey      string   `json:"providerKey"`
	Label            string   `json:"label"`
	Issuer           string   `json:"issuer"`
	ClientID         string   `json:"clientId"`
	AdminGroup       string   `json:"adminGroup"`
	Enabled          bool     `json:"enabled"`
	Insecure         bool     `json:"insecure"`
	DisableLocalAuth bool     `json:"disableLocalAuth"`
	Scopes           []string `json:"scopes"`
	Configured       bool     `json:"configured"`
	SecretConfigured bool     `json:"secretConfigured"`
}

type OIDCProviderSummary struct {
	Key              string   `json:"key"`
	Label            string   `json:"label"`
	Issuer           string   `json:"issuer"`
	ClientID         string   `json:"clientId"`
	AdminGroup       string   `json:"adminGroup"`
	Insecure         bool     `json:"insecure"`
	DisableLocalAuth bool     `json:"disableLocalAuth"`
	Scopes           []string `json:"scopes"`
	Configured       bool     `json:"configured"`
}
