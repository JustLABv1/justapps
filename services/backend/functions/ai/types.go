package ai

import (
	"context"

	"justapps-backend/pkg/models"
)

type ProviderRuntime struct {
	Key              string
	Type             string
	Label            string
	BaseURL          string
	APIPath          string
	APIVersion       string
	Region           string
	Organization     string
	Token            string
	ChatModel        string
	EmbeddingModel   string
	Enabled          bool
	IsDefault        bool
	TimeoutSeconds   int
	MaxContextTokens int
	MaxOutputTokens  int
	Temperature      float64
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model           string
	Messages        []ChatMessage
	Temperature     float64
	MaxOutputTokens int
}

type Usage struct {
	PromptTokens   int
	ResponseTokens int
	TotalTokens    int
}

type ChatResponse struct {
	Content      string
	Model        string
	FinishReason string
	Usage        Usage
}

type ChatProvider interface {
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
	Validate(ctx context.Context) error
	Capabilities() ProviderCapabilities
}

type ProviderCapabilities struct {
	Streaming  bool `json:"streaming"`
	Embeddings bool `json:"embeddings"`
	Local      bool `json:"local"`
}

type Viewer struct {
	UserID  string
	Role    string
	HasUser bool
}

type RetrievalQuery struct {
	Text  string
	AppID string
	Limit int
}

type RetrievedContext struct {
	Chunks  []models.AIKnowledgeChunk
	Sources []models.AIMessageSource
}
