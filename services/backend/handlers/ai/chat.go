package ai

import (
	"database/sql"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type createConversationRequest struct {
	Title string `json:"title"`
	AppID string `json:"appId"`
}

type sendMessageRequest struct {
	ConversationID string `json:"conversationId"`
	Message        string `json:"message"`
	AppID          string `json:"appId"`
	ProviderKey    string `json:"providerKey"`
}

func ListProviders(c *gin.Context, db *bun.DB) {
	providers, err := aifunc.ListProviderSummaries(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, providers)
}

func ListConversations(c *gin.Context, db *bun.DB) {
	userID, _, ok := getUserContext(c)
	if !ok {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found"))
		return
	}

	conversations := make([]models.AIConversation, 0)
	if err := db.NewSelect().Model(&conversations).Where("user_id = ?", userID).Order("updated_at DESC").Limit(100).Scan(c); err != nil {
		httperror.InternalServerError(c, "Konversationen konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, conversations)
}

func CreateConversation(c *gin.Context, db *bun.DB) {
	userID, role, ok := getUserContext(c)
	if !ok {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found"))
		return
	}

	var req createConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Konversation", err)
		return
	}
	viewer := aifunc.Viewer{UserID: userID.String(), Role: role, HasUser: true}
	if strings.TrimSpace(req.AppID) != "" {
		viewable, err := aifunc.AppIsViewable(c.Request.Context(), db, req.AppID, viewer)
		if err != nil {
			httperror.InternalServerError(c, "App-Kontext konnte nicht geprüft werden", err)
			return
		}
		if !viewable {
			httperror.StatusNotFound(c, "App nicht gefunden", errors.New("app not found"))
			return
		}
	}

	now := time.Now().UTC()
	conversation := models.AIConversation{
		UserID:    userID,
		Title:     conversationTitle(req.Title),
		ScopeType: scopeType(req.AppID),
		AppID:     strings.TrimSpace(req.AppID),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := db.NewInsert().Model(&conversation).Returning("*").Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Konversation konnte nicht erstellt werden", err)
		return
	}
	c.JSON(201, conversation)
}

func GetConversation(c *gin.Context, db *bun.DB) {
	conversation, ok := loadOwnedConversation(c, db)
	if !ok {
		return
	}
	messages := make([]models.AIMessage, 0)
	if err := db.NewSelect().Model(&messages).Where("conversation_id = ?", conversation.ID).Order("created_at ASC").Scan(c); err != nil {
		httperror.InternalServerError(c, "Nachrichten konnten nicht geladen werden", err)
		return
	}
	conversation.Messages = messages
	c.JSON(200, conversation)
}

func DeleteConversation(c *gin.Context, db *bun.DB) {
	conversation, ok := loadOwnedConversation(c, db)
	if !ok {
		return
	}
	if _, err := db.NewDelete().Model((*models.AIConversation)(nil)).Where("id = ?", conversation.ID).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Konversation konnte nicht gelöscht werden", err)
		return
	}
	c.Status(204)
}

func SendMessage(c *gin.Context, db *bun.DB) {
	userID, role, ok := getUserContext(c)
	if !ok {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found"))
		return
	}
	viewer := aifunc.Viewer{UserID: userID.String(), Role: role, HasUser: true}

	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Chat-Nachricht", err)
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		httperror.StatusBadRequest(c, "Nachricht darf nicht leer sein", errors.New("empty message"))
		return
	}
	if utf8.RuneCountInString(req.Message) > 8000 {
		httperror.StatusBadRequest(c, "Nachricht ist zu lang", errors.New("message too long"))
		return
	}

	provider, found, err := aifunc.ResolveProvider(c.Request.Context(), db, config.Config, req.ProviderKey)
	if err != nil {
		httperror.InternalServerError(c, "AI-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusBadRequest(c, "Kein aktiver AI-Provider ist konfiguriert", errors.New("provider not configured"))
		return
	}

	conversation, history, ok := resolveConversationForMessage(c, db, userID, role, req)
	if !ok {
		return
	}
	appID := firstNonEmpty(req.AppID, conversation.AppID)
	if appID != "" {
		viewable, err := aifunc.AppIsViewable(c.Request.Context(), db, appID, viewer)
		if err != nil {
			httperror.InternalServerError(c, "App-Kontext konnte nicht geprüft werden", err)
			return
		}
		if !viewable {
			httperror.StatusNotFound(c, "App nicht gefunden", errors.New("app not found"))
			return
		}
	}

	retrieved, err := aifunc.RetrieveContext(c.Request.Context(), db, viewer, aifunc.RetrievalQuery{Text: req.Message, AppID: appID, Limit: 8})
	if err != nil {
		httperror.InternalServerError(c, "AI-Kontext konnte nicht geladen werden", err)
		return
	}

	now := time.Now().UTC()
	userMessage := models.AIMessage{
		ConversationID: conversation.ID,
		Role:           "user",
		Content:        req.Message,
		CreatedAt:      now,
		Sources:        []models.AIMessageSource{},
	}
	if _, err := db.NewInsert().Model(&userMessage).Returning("*").Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Nachricht konnte nicht gespeichert werden", err)
		return
	}

	messages := aifunc.BuildPromptMessages(req.Message, history, retrieved.Chunks, provider.MaxContextTokens)
	client := aifunc.NewChatProvider(provider)
	response, err := client.Chat(c.Request.Context(), aifunc.ChatRequest{
		Model:           provider.ChatModel,
		Messages:        messages,
		Temperature:     provider.Temperature,
		MaxOutputTokens: provider.MaxOutputTokens,
	})
	if err != nil {
		errorMessage := models.AIMessage{
			ConversationID: conversation.ID,
			Role:           "assistant",
			Content:        "Die AI-Antwort konnte nicht erzeugt werden: " + err.Error(),
			ProviderKey:    provider.Key,
			ProviderType:   provider.Type,
			Model:          provider.ChatModel,
			Sources:        retrieved.Sources,
			Error:          err.Error(),
			CreatedAt:      time.Now().UTC(),
		}
		_, _ = db.NewInsert().Model(&errorMessage).Exec(c.Request.Context())
		httperror.InternalServerError(c, "Die AI-Antwort konnte nicht erzeugt werden", err)
		return
	}

	assistantMessage := models.AIMessage{
		ConversationID: conversation.ID,
		Role:           "assistant",
		Content:        response.Content,
		ProviderKey:    provider.Key,
		ProviderType:   provider.Type,
		Model:          firstNonEmpty(response.Model, provider.ChatModel),
		PromptTokens:   response.Usage.PromptTokens,
		ResponseTokens: response.Usage.ResponseTokens,
		Sources:        retrieved.Sources,
		CreatedAt:      time.Now().UTC(),
	}
	if _, err := db.NewInsert().Model(&assistantMessage).Returning("*").Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "AI-Antwort konnte nicht gespeichert werden", err)
		return
	}

	conversation.UpdatedAt = time.Now().UTC()
	if conversation.Title == "Neuer Chat" {
		conversation.Title = conversationTitle(req.Message)
	}
	_, _ = db.NewUpdate().Model(&conversation).Where("id = ?", conversation.ID).Column("title", "updated_at").Exec(c.Request.Context())

	c.JSON(200, gin.H{
		"conversation":     conversation,
		"userMessage":      userMessage,
		"assistantMessage": assistantMessage,
		"sources":          retrieved.Sources,
	})
}

func ReindexKnowledge(c *gin.Context, db *bun.DB) {
	count, err := aifunc.ReindexAll(c.Request.Context(), db)
	if err != nil {
		httperror.InternalServerError(c, "AI-Wissensindex konnte nicht aufgebaut werden", err)
		return
	}
	c.JSON(200, gin.H{"indexedApps": count})
}

func resolveConversationForMessage(c *gin.Context, db *bun.DB, userID uuid.UUID, role string, req sendMessageRequest) (models.AIConversation, []models.AIMessage, bool) {
	conversationID := strings.TrimSpace(firstNonEmpty(req.ConversationID, c.Param("conversationId")))
	if conversationID == "" {
		now := time.Now().UTC()
		conversation := models.AIConversation{
			UserID:    userID,
			Title:     conversationTitle(req.Message),
			ScopeType: scopeType(req.AppID),
			AppID:     strings.TrimSpace(req.AppID),
			CreatedAt: now,
			UpdatedAt: now,
		}
		if _, err := db.NewInsert().Model(&conversation).Returning("*").Exec(c.Request.Context()); err != nil {
			httperror.InternalServerError(c, "Konversation konnte nicht erstellt werden", err)
			return models.AIConversation{}, nil, false
		}
		return conversation, []models.AIMessage{}, true
	}

	parsedID, err := uuid.Parse(conversationID)
	if err != nil {
		httperror.StatusBadRequest(c, "Ungültige Konversation", err)
		return models.AIConversation{}, nil, false
	}
	var conversation models.AIConversation
	if err := db.NewSelect().Model(&conversation).Where("id = ? AND user_id = ?", parsedID, userID).Scan(c); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Konversation nicht gefunden", err)
			return models.AIConversation{}, nil, false
		}
		httperror.InternalServerError(c, "Konversation konnte nicht geladen werden", err)
		return models.AIConversation{}, nil, false
	}
	if role != "admin" && conversation.AppID != "" && strings.TrimSpace(req.AppID) != "" && conversation.AppID != strings.TrimSpace(req.AppID) {
		httperror.StatusBadRequest(c, "Konversation gehört zu einem anderen App-Kontext", errors.New("app scope mismatch"))
		return models.AIConversation{}, nil, false
	}
	history := make([]models.AIMessage, 0)
	if err := db.NewSelect().Model(&history).Where("conversation_id = ?", conversation.ID).Order("created_at ASC").Limit(24).Scan(c); err != nil {
		httperror.InternalServerError(c, "Chat-Verlauf konnte nicht geladen werden", err)
		return models.AIConversation{}, nil, false
	}
	return conversation, history, true
}

func loadOwnedConversation(c *gin.Context, db *bun.DB) (models.AIConversation, bool) {
	userID, _, ok := getUserContext(c)
	if !ok {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found"))
		return models.AIConversation{}, false
	}
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperror.StatusBadRequest(c, "Ungültige Konversation", err)
		return models.AIConversation{}, false
	}
	var conversation models.AIConversation
	if err := db.NewSelect().Model(&conversation).Where("id = ? AND user_id = ?", conversationID, userID).Scan(c); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Konversation nicht gefunden", err)
			return models.AIConversation{}, false
		}
		httperror.InternalServerError(c, "Konversation konnte nicht geladen werden", err)
		return models.AIConversation{}, false
	}
	return conversation, true
}

func getUserContext(c *gin.Context) (uuid.UUID, string, bool) {
	role := c.GetString("role")
	userIDVal, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, role, false
	}
	switch value := userIDVal.(type) {
	case uuid.UUID:
		return value, role, true
	case string:
		parsed, err := uuid.Parse(value)
		if err == nil {
			return parsed, role, true
		}
	}
	return uuid.Nil, role, false
}

func conversationTitle(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "Neuer Chat"
	}
	runes := []rune(trimmed)
	if len(runes) > 80 {
		return strings.TrimSpace(string(runes[:80])) + "..."
	}
	return trimmed
}

func scopeType(appID string) string {
	if strings.TrimSpace(appID) != "" {
		return "app"
	}
	return "global"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
