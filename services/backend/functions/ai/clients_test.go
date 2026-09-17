package ai

import (
	"context"
	"encoding/json"
	"errors"
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

func TestOpenAICompatibleReturnsTypedProviderHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(http.StatusUnauthorized)
		_, _ = response.Write([]byte(`{"error":{"message":"Key is blocked"}}`))
	}))
	defer server.Close()

	provider := NewChatProvider(ProviderRuntime{
		Key:       "test",
		Type:      ProviderTypeOpenAICompatible,
		BaseURL:   server.URL,
		ChatModel: "test-model",
	})
	_, err := provider.Chat(context.Background(), ChatRequest{
		Messages: []ChatMessage{{Role: "user", Content: "Hello"}},
	})

	var providerError *ProviderHTTPError
	if !errors.As(err, &providerError) {
		t.Fatalf("expected ProviderHTTPError, got %v", err)
	}
	if providerError.StatusCode != http.StatusUnauthorized {
		t.Fatalf("got status %d, want %d", providerError.StatusCode, http.StatusUnauthorized)
	}
}
