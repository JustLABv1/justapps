package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type AIProviderSettings struct {
	bun.BaseModel `bun:"table:ai_provider_settings,alias:aip"`

	ProviderKey      string    `bun:"provider_key,pk" json:"providerKey"`
	ProviderType     string    `bun:"provider_type,notnull,default:'openai-compatible'" json:"providerType"`
	Label            string    `bun:"label" json:"label"`
	BaseURL          string    `bun:"base_url" json:"baseUrl"`
	APIPath          string    `bun:"api_path" json:"apiPath"`
	APIVersion       string    `bun:"api_version" json:"apiVersion"`
	Region           string    `bun:"region" json:"region"`
	Organization     string    `bun:"organization" json:"organization"`
	ChatModel        string    `bun:"chat_model" json:"chatModel"`
	EmbeddingModel   string    `bun:"embedding_model" json:"embeddingModel"`
	EncryptedToken   string    `bun:"encrypted_token,notnull,default:''" json:"encryptedToken,omitempty"`
	TokenNonce       string    `bun:"token_nonce,notnull,default:''" json:"tokenNonce,omitempty"`
	TokenKeyVersion  string    `bun:"token_key_version,notnull,default:'v1'" json:"tokenKeyVersion,omitempty"`
	TokenConfigured  bool      `bun:"token_configured,notnull,default:false" json:"tokenConfigured"`
	Enabled          bool      `bun:"enabled,notnull,default:true" json:"enabled"`
	IsDefault        bool      `bun:"is_default,notnull,default:false" json:"isDefault"`
	TimeoutSeconds   int       `bun:"timeout_seconds,notnull,default:30" json:"timeoutSeconds"`
	MaxContextTokens int       `bun:"max_context_tokens,notnull,default:6000" json:"maxContextTokens"`
	MaxOutputTokens  int       `bun:"max_output_tokens,notnull,default:1200" json:"maxOutputTokens"`
	Temperature      float64   `bun:"temperature,notnull,default:0.2" json:"temperature"`
	CreatedAt        time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt        time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type AIProviderAdminResponse struct {
	ProviderKey      string  `json:"providerKey"`
	ProviderType     string  `json:"providerType"`
	Label            string  `json:"label"`
	BaseURL          string  `json:"baseUrl"`
	APIPath          string  `json:"apiPath"`
	APIVersion       string  `json:"apiVersion"`
	Region           string  `json:"region"`
	Organization     string  `json:"organization"`
	ChatModel        string  `json:"chatModel"`
	EmbeddingModel   string  `json:"embeddingModel"`
	Enabled          bool    `json:"enabled"`
	IsDefault        bool    `json:"isDefault"`
	Configured       bool    `json:"configured"`
	TokenConfigured  bool    `json:"tokenConfigured"`
	RequiresToken    bool    `json:"requiresToken"`
	TimeoutSeconds   int     `json:"timeoutSeconds"`
	MaxContextTokens int     `json:"maxContextTokens"`
	MaxOutputTokens  int     `json:"maxOutputTokens"`
	Temperature      float64 `json:"temperature"`
}

type AIProviderSummary struct {
	Key             string `json:"key"`
	Type            string `json:"type"`
	Label           string `json:"label"`
	ChatModel       string `json:"chatModel"`
	BaseURL         string `json:"baseUrl,omitempty"`
	Default         bool   `json:"default"`
	TokenConfigured bool   `json:"tokenConfigured"`
}

type AIConversation struct {
	bun.BaseModel `bun:"table:ai_conversations,alias:aic"`

	ID        uuid.UUID   `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID   `bun:"user_id,type:uuid,notnull" json:"userId"`
	Title     string      `bun:"title,notnull,default:''" json:"title"`
	ScopeType string      `bun:"scope_type,notnull,default:''" json:"scopeType"`
	AppID     string      `bun:"app_id,nullzero" json:"appId"`
	CreatedAt time.Time   `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time   `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
	Messages  []AIMessage `bun:"rel:has-many,join:id=conversation_id" json:"messages,omitempty"`
}

type AIMessageSource struct {
	AppID      string  `json:"appId"`
	AppName    string  `json:"appName"`
	ChunkID    string  `json:"chunkId"`
	SourceType string  `json:"sourceType"`
	SourceID   string  `json:"sourceId"`
	Title      string  `json:"title"`
	Snippet    string  `json:"snippet"`
	Score      float64 `json:"score,omitempty"`
}

type AIMessage struct {
	bun.BaseModel `bun:"table:ai_messages,alias:aim"`

	ID             uuid.UUID         `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	ConversationID uuid.UUID         `bun:"conversation_id,type:uuid,notnull" json:"conversationId"`
	Role           string            `bun:"role,notnull" json:"role"`
	Content        string            `bun:"content,notnull" json:"content"`
	ProviderKey    string            `bun:"provider_key" json:"providerKey"`
	ProviderType   string            `bun:"provider_type" json:"providerType"`
	Model          string            `bun:"model" json:"model"`
	PromptTokens   int               `bun:"prompt_tokens,notnull,default:0" json:"promptTokens"`
	ResponseTokens int               `bun:"response_tokens,notnull,default:0" json:"responseTokens"`
	Sources        []AIMessageSource `bun:"sources,type:jsonb,notnull,default:'[]'" json:"sources"`
	Error          string            `bun:"error,notnull,default:''" json:"error"`
	CreatedAt      time.Time         `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
}

type AIKnowledgeChunk struct {
	bun.BaseModel `bun:"table:ai_knowledge_chunks,alias:aikc"`

	ID              uuid.UUID         `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	AppID           string            `bun:"app_id,notnull" json:"appId"`
	AppName         string            `bun:"app_name,notnull,default:''" json:"appName"`
	SourceType      string            `bun:"source_type,notnull" json:"sourceType"`
	SourceID        string            `bun:"source_id,notnull" json:"sourceId"`
	Title           string            `bun:"title,notnull,default:''" json:"title"`
	Content         string            `bun:"content,notnull" json:"content"`
	SearchText      string            `bun:"search_text,notnull,default:''" json:"searchText"`
	Metadata        map[string]string `bun:"metadata,type:jsonb,notnull,default:'{}'" json:"metadata"`
	ContentHash     string            `bun:"content_hash,notnull" json:"contentHash"`
	SourceUpdatedAt time.Time         `bun:"source_updated_at,nullzero" json:"sourceUpdatedAt"`
	IndexedAt       time.Time         `bun:"indexed_at,notnull,default:current_timestamp" json:"indexedAt"`
}
