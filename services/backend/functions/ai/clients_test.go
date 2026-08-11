package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAICompatibleJSONModeAddsResponseFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		var body struct {
			ResponseFormat map[string]string `json:"response_format"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
			return
		}
		if body.ResponseFormat["type"] != "json_object" {
			t.Errorf("expected JSON response format, got %#v", body.ResponseFormat)
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"choices":[{"message":{"content":"{}"}}]}`))
	}))
	defer server.Close()

	provider := NewChatProvider(ProviderRuntime{
		Key:       "test",
		Type:      ProviderTypeOpenAICompatible,
		BaseURL:   server.URL,
		ChatModel: "test-model",
	})
	if _, err := provider.Chat(context.Background(), ChatRequest{
		Messages: []ChatMessage{{Role: "user", Content: "Return JSON."}},
		JSONMode: true,
	}); err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}
}
