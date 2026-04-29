package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type httpChatProvider struct {
	runtime ProviderRuntime
	client  *http.Client
}

type providerTextMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func NewChatProvider(runtime ProviderRuntime) ChatProvider {
	timeout := time.Duration(runtime.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &httpChatProvider{
		runtime: runtime,
		client:  &http.Client{Timeout: timeout},
	}
}

func (provider *httpChatProvider) Capabilities() ProviderCapabilities {
	return ProviderCapabilities{
		Streaming:  false,
		Embeddings: strings.TrimSpace(provider.runtime.EmbeddingModel) != "",
		Local:      ProviderTypeIsLocal(provider.runtime.Type),
	}
}

func (provider *httpChatProvider) Validate(ctx context.Context) error {
	_, err := provider.Chat(ctx, ChatRequest{
		Messages: []ChatMessage{{Role: "user", Content: "Reply with OK."}},
	})
	return err
}

func (provider *httpChatProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	switch NormalizeProviderType(provider.runtime.Type) {
	case ProviderTypeOpenAI, ProviderTypeOpenAICompatible, ProviderTypeVLLM, ProviderTypeOpenRouter, ProviderTypeLMStudio, ProviderTypeTogether:
		return provider.chatOpenAICompatible(ctx, req)
	case ProviderTypeAzureOpenAI:
		return provider.chatAzureOpenAI(ctx, req)
	case ProviderTypeAnthropic:
		return provider.chatAnthropic(ctx, req)
	case ProviderTypeGemini:
		return provider.chatGemini(ctx, req)
	case ProviderTypeMistral:
		return provider.chatOpenAICompatible(ctx, req)
	case ProviderTypeCohere:
		return provider.chatCohere(ctx, req)
	case ProviderTypeOllama:
		return provider.chatOllama(ctx, req)
	default:
		return ChatResponse{}, fmt.Errorf("unsupported ai provider type %q", provider.runtime.Type)
	}
}

func (provider *httpChatProvider) chatOpenAICompatible(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	type openAIRequest struct {
		Model       string                `json:"model"`
		Messages    []providerTextMessage `json:"messages"`
		Temperature float64               `json:"temperature,omitempty"`
		MaxTokens   int                   `json:"max_tokens,omitempty"`
	}
	type openAIResponse struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}

	body := openAIRequest{
		Model:       provider.requestModel(req),
		Messages:    convertOpenAIMessages(req.Messages),
		Temperature: provider.requestTemperature(req),
		MaxTokens:   provider.requestMaxOutputTokens(req),
	}
	endpoint := provider.endpoint("/chat/completions")
	request, err := provider.newJSONRequest(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return ChatResponse{}, err
	}
	provider.setBearerAuth(request)
	if provider.runtime.Organization != "" {
		request.Header.Set("OpenAI-Organization", provider.runtime.Organization)
	}

	var response openAIResponse
	if err := provider.doJSON(request, &response); err != nil {
		return ChatResponse{}, err
	}
	if len(response.Choices) == 0 {
		return ChatResponse{}, errors.New("ai provider returned no choices")
	}
	return ChatResponse{
		Content:      strings.TrimSpace(response.Choices[0].Message.Content),
		Model:        firstNonEmpty(response.Model, body.Model),
		FinishReason: response.Choices[0].FinishReason,
		Usage: Usage{
			PromptTokens:   response.Usage.PromptTokens,
			ResponseTokens: response.Usage.CompletionTokens,
			TotalTokens:    response.Usage.TotalTokens,
		},
	}, nil
}

func (provider *httpChatProvider) chatAzureOpenAI(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	deployment := url.PathEscape(provider.requestModel(req))
	apiVersion := strings.TrimSpace(provider.runtime.APIVersion)
	if apiVersion == "" {
		apiVersion = "2024-10-21"
	}
	endpoint := fmt.Sprintf("/openai/deployments/%s/chat/completions?api-version=%s", deployment, url.QueryEscape(apiVersion))
	request, err := provider.newJSONRequest(ctx, http.MethodPost, provider.endpoint(endpoint), map[string]any{
		"messages":    convertOpenAIMessages(req.Messages),
		"temperature": provider.requestTemperature(req),
		"max_tokens":  provider.requestMaxOutputTokens(req),
	})
	if err != nil {
		return ChatResponse{}, err
	}
	request.Header.Set("api-key", provider.runtime.Token)

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := provider.doJSON(request, &response); err != nil {
		return ChatResponse{}, err
	}
	if len(response.Choices) == 0 {
		return ChatResponse{}, errors.New("azure openai returned no choices")
	}
	return ChatResponse{
		Content:      strings.TrimSpace(response.Choices[0].Message.Content),
		Model:        provider.requestModel(req),
		FinishReason: response.Choices[0].FinishReason,
		Usage:        Usage{PromptTokens: response.Usage.PromptTokens, ResponseTokens: response.Usage.CompletionTokens, TotalTokens: response.Usage.TotalTokens},
	}, nil
}

func (provider *httpChatProvider) chatAnthropic(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	type anthropicContent struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}

	systemPrompt, messages := splitSystemMessage(req.Messages)
	body := map[string]any{
		"model":       provider.requestModel(req),
		"max_tokens":  provider.requestMaxOutputTokens(req),
		"temperature": provider.requestTemperature(req),
		"messages":    convertAnthropicMessages(messages),
	}
	if systemPrompt != "" {
		body["system"] = systemPrompt
	}
	request, err := provider.newJSONRequest(ctx, http.MethodPost, provider.endpoint("/v1/messages"), body)
	if err != nil {
		return ChatResponse{}, err
	}
	request.Header.Set("x-api-key", provider.runtime.Token)
	request.Header.Set("anthropic-version", firstNonEmpty(provider.runtime.APIVersion, "2023-06-01"))

	var response struct {
		Model      string             `json:"model"`
		StopReason string             `json:"stop_reason"`
		Content    []anthropicContent `json:"content"`
		Usage      struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
		Message string `json:"message"`
	}
	if err := provider.doJSON(request, &response); err != nil {
		return ChatResponse{}, err
	}
	parts := make([]string, 0, len(response.Content))
	for _, part := range response.Content {
		if strings.TrimSpace(part.Text) != "" {
			parts = append(parts, part.Text)
		}
	}
	if len(parts) == 0 {
		return ChatResponse{}, errors.New("anthropic returned no text content")
	}
	return ChatResponse{
		Content:      strings.TrimSpace(strings.Join(parts, "\n")),
		Model:        firstNonEmpty(response.Model, provider.requestModel(req)),
		FinishReason: response.StopReason,
		Usage:        Usage{PromptTokens: response.Usage.InputTokens, ResponseTokens: response.Usage.OutputTokens, TotalTokens: response.Usage.InputTokens + response.Usage.OutputTokens},
	}, nil
}

func (provider *httpChatProvider) chatGemini(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	model := provider.requestModel(req)
	endpoint := fmt.Sprintf("/v1beta/models/%s:generateContent", url.PathEscape(model))
	requestURL := provider.endpoint(endpoint)
	if provider.runtime.Token != "" {
		separator := "?"
		if strings.Contains(requestURL, "?") {
			separator = "&"
		}
		requestURL += separator + "key=" + url.QueryEscape(provider.runtime.Token)
	}
	body := map[string]any{
		"contents": convertGeminiMessages(req.Messages),
		"generationConfig": map[string]any{
			"temperature":     provider.requestTemperature(req),
			"maxOutputTokens": provider.requestMaxOutputTokens(req),
		},
	}
	request, err := provider.newJSONRequest(ctx, http.MethodPost, requestURL, body)
	if err != nil {
		return ChatResponse{}, err
	}
	if provider.runtime.Token != "" {
		request.Header.Set("x-goog-api-key", provider.runtime.Token)
	}

	var response struct {
		Candidates []struct {
			FinishReason string `json:"finishReason"`
			Content      struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := provider.doJSON(request, &response); err != nil {
		return ChatResponse{}, err
	}
	if len(response.Candidates) == 0 {
		return ChatResponse{}, errors.New("gemini returned no candidates")
	}
	parts := make([]string, 0, len(response.Candidates[0].Content.Parts))
	for _, part := range response.Candidates[0].Content.Parts {
		if strings.TrimSpace(part.Text) != "" {
			parts = append(parts, part.Text)
		}
	}
	if len(parts) == 0 {
		return ChatResponse{}, errors.New("gemini returned no text content")
	}
	return ChatResponse{
		Content:      strings.TrimSpace(strings.Join(parts, "\n")),
		Model:        model,
		FinishReason: response.Candidates[0].FinishReason,
		Usage: Usage{
			PromptTokens:   response.UsageMetadata.PromptTokenCount,
			ResponseTokens: response.UsageMetadata.CandidatesTokenCount,
			TotalTokens:    response.UsageMetadata.TotalTokenCount,
		},
	}, nil
}

func (provider *httpChatProvider) chatCohere(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	request, err := provider.newJSONRequest(ctx, http.MethodPost, provider.endpoint("/v2/chat"), map[string]any{
		"model":       provider.requestModel(req),
		"messages":    convertCohereMessages(req.Messages),
		"temperature": provider.requestTemperature(req),
		"max_tokens":  provider.requestMaxOutputTokens(req),
	})
	if err != nil {
		return ChatResponse{}, err
	}
	provider.setBearerAuth(request)

	var response struct {
		ID      string `json:"id"`
		Message struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
		Usage        struct {
			Tokens struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"tokens"`
		} `json:"usage"`
	}
	if err := provider.doJSON(request, &response); err != nil {
		return ChatResponse{}, err
	}
	parts := make([]string, 0, len(response.Message.Content))
	for _, part := range response.Message.Content {
		if strings.TrimSpace(part.Text) != "" {
			parts = append(parts, part.Text)
		}
	}
	if len(parts) == 0 {
		return ChatResponse{}, errors.New("cohere returned no text content")
	}
	return ChatResponse{
		Content:      strings.TrimSpace(strings.Join(parts, "\n")),
		Model:        provider.requestModel(req),
		FinishReason: response.FinishReason,
		Usage: Usage{
			PromptTokens:   response.Usage.Tokens.InputTokens,
			ResponseTokens: response.Usage.Tokens.OutputTokens,
			TotalTokens:    response.Usage.Tokens.InputTokens + response.Usage.Tokens.OutputTokens,
		},
	}, nil
}

func (provider *httpChatProvider) chatOllama(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	request, err := provider.newJSONRequest(ctx, http.MethodPost, provider.endpoint("/api/chat"), map[string]any{
		"model":    provider.requestModel(req),
		"messages": convertOpenAIMessages(req.Messages),
		"stream":   false,
		"options": map[string]any{
			"temperature": provider.requestTemperature(req),
			"num_predict": provider.requestMaxOutputTokens(req),
		},
	})
	if err != nil {
		return ChatResponse{}, err
	}
	if provider.runtime.Token != "" {
		provider.setBearerAuth(request)
	}

	var response struct {
		Model   string `json:"model"`
		Done    bool   `json:"done"`
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		PromptEvalCount int `json:"prompt_eval_count"`
		EvalCount       int `json:"eval_count"`
	}
	if err := provider.doJSON(request, &response); err != nil {
		return ChatResponse{}, err
	}
	if strings.TrimSpace(response.Message.Content) == "" {
		return ChatResponse{}, errors.New("ollama returned no text content")
	}
	return ChatResponse{
		Content: strings.TrimSpace(response.Message.Content),
		Model:   firstNonEmpty(response.Model, provider.requestModel(req)),
		Usage:   Usage{PromptTokens: response.PromptEvalCount, ResponseTokens: response.EvalCount, TotalTokens: response.PromptEvalCount + response.EvalCount},
	}, nil
}

func (provider *httpChatProvider) requestModel(req ChatRequest) string {
	return firstNonEmpty(req.Model, provider.runtime.ChatModel)
}

func (provider *httpChatProvider) requestTemperature(req ChatRequest) float64 {
	if req.Temperature > 0 {
		return req.Temperature
	}
	return provider.runtime.Temperature
}

func (provider *httpChatProvider) requestMaxOutputTokens(req ChatRequest) int {
	if req.MaxOutputTokens > 0 {
		return req.MaxOutputTokens
	}
	return provider.runtime.MaxOutputTokens
}

func (provider *httpChatProvider) endpoint(defaultPath string) string {
	if strings.TrimSpace(provider.runtime.APIPath) != "" {
		return joinURL(provider.runtime.BaseURL, provider.runtime.APIPath)
	}
	return joinURL(provider.runtime.BaseURL, defaultPath)
}

func (provider *httpChatProvider) newJSONRequest(ctx context.Context, method, endpoint string, body any) (*http.Request, error) {
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	return request, nil
}

func (provider *httpChatProvider) setBearerAuth(request *http.Request) {
	if strings.TrimSpace(provider.runtime.Token) != "" {
		request.Header.Set("Authorization", "Bearer "+provider.runtime.Token)
	}
}

func (provider *httpChatProvider) doJSON(request *http.Request, target any) error {
	response, err := provider.client.Do(request)
	if err != nil {
		return fmt.Errorf("ai provider %q (%s) request failed: %w", provider.runtime.Key, provider.runtime.Type, err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("ai provider %q response read failed: %w", provider.runtime.Key, err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("ai provider %q (%s) returned %s for %s: %s", provider.runtime.Key, provider.runtime.Type, response.Status, request.URL.Redacted(), redactProviderError(body))
	}
	contentType := strings.ToLower(response.Header.Get("Content-Type"))
	if !looksLikeJSON(contentType, body) {
		return fmt.Errorf("ai provider %q (%s) returned non-JSON response (Content-Type %q) from %s. Prüfen Sie die Base-URL, den API-Pfad und ob ein Auth-Proxy (z. B. OpenShift OAuth) den Endpunkt abschirmt. Antwort: %s",
			provider.runtime.Key, provider.runtime.Type, response.Header.Get("Content-Type"), request.URL.Redacted(), redactProviderError(body))
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("decode ai provider %q response from %s: %w (body: %s)", provider.runtime.Key, request.URL.Redacted(), err, redactProviderError(body))
	}
	return nil
}

func looksLikeJSON(contentType string, body []byte) bool {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return false
	}
	if strings.Contains(contentType, "json") {
		return true
	}
	if strings.Contains(contentType, "html") || strings.Contains(contentType, "xml") || strings.Contains(contentType, "text/plain") {
		return false
	}
	first := trimmed[0]
	return first == '{' || first == '['
}

func convertOpenAIMessages(messages []ChatMessage) []providerTextMessage {
	converted := make([]providerTextMessage, 0, len(messages))
	for _, message := range messages {
		role := normalizeOpenAIRole(message.Role)
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		converted = append(converted, providerTextMessage{Role: role, Content: content})
	}
	return converted
}

func convertAnthropicMessages(messages []ChatMessage) []map[string]any {
	converted := make([]map[string]any, 0, len(messages))
	for _, message := range messages {
		role := normalizeAnthropicRole(message.Role)
		content := strings.TrimSpace(message.Content)
		if role == "system" || content == "" {
			continue
		}
		converted = append(converted, map[string]any{
			"role": role,
			"content": []map[string]string{{
				"type": "text",
				"text": content,
			}},
		})
	}
	return converted
}

func convertGeminiMessages(messages []ChatMessage) []map[string]any {
	converted := make([]map[string]any, 0, len(messages))
	for _, message := range messages {
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		role := "user"
		if message.Role == "assistant" || message.Role == "model" {
			role = "model"
		}
		converted = append(converted, map[string]any{
			"role":  role,
			"parts": []map[string]string{{"text": content}},
		})
	}
	return converted
}

func convertCohereMessages(messages []ChatMessage) []map[string]string {
	converted := make([]map[string]string, 0, len(messages))
	for _, message := range messages {
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		role := strings.ToLower(strings.TrimSpace(message.Role))
		switch role {
		case "assistant", "system", "user":
		default:
			role = "user"
		}
		converted = append(converted, map[string]string{"role": role, "content": content})
	}
	return converted
}

func splitSystemMessage(messages []ChatMessage) (string, []ChatMessage) {
	parts := make([]string, 0)
	remaining := make([]ChatMessage, 0, len(messages))
	for _, message := range messages {
		if strings.EqualFold(message.Role, "system") {
			if strings.TrimSpace(message.Content) != "" {
				parts = append(parts, strings.TrimSpace(message.Content))
			}
			continue
		}
		remaining = append(remaining, message)
	}
	return strings.Join(parts, "\n\n"), remaining
}

func normalizeOpenAIRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "system", "assistant", "tool":
		return strings.ToLower(strings.TrimSpace(role))
	default:
		return "user"
	}
}

func normalizeAnthropicRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "assistant":
		return "assistant"
	case "system":
		return "system"
	default:
		return "user"
	}
}

func joinURL(baseURL, pathValue string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	pathValue = strings.TrimSpace(pathValue)
	if strings.HasPrefix(pathValue, "http://") || strings.HasPrefix(pathValue, "https://") {
		return pathValue
	}
	if baseURL == "" {
		return pathValue
	}
	if pathValue == "" {
		return baseURL
	}
	if !strings.HasPrefix(pathValue, "/") {
		pathValue = "/" + pathValue
	}
	return baseURL + pathValue
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func redactProviderError(body []byte) string {
	message := strings.TrimSpace(string(body))
	if len(message) > 600 {
		message = message[:600] + "..."
	}
	return message
}
