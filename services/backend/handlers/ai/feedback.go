package ai

import (
	"database/sql"
	"errors"
	"strings"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type messageFeedbackRequest struct {
	Feedback string `json:"feedback"`
}

// SetMessageFeedback stores feedback only for messages belonging to the
// authenticated user's conversation. The message id alone is never enough to
// access another user's chat history.
func SetMessageFeedback(c *gin.Context, db *bun.DB) {
	if !requireAIEnabled(c, db) {
		return
	}

	userID, _, ok := getUserContext(c)
	if !ok {
		httperror.Unauthorized(c, "Benutzer nicht gefunden", errors.New("user not found"))
		return
	}

	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperror.StatusBadRequest(c, "Ungültige Nachricht", err)
		return
	}

	var req messageFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültiges Feedback", err)
		return
	}
	feedback := strings.ToLower(strings.TrimSpace(req.Feedback))
	if feedback != "" && feedback != "positive" && feedback != "negative" {
		httperror.StatusBadRequest(c, "Ungültiges Feedback", errors.New("feedback must be positive, negative, or empty"))
		return
	}

	var message models.AIMessage
	err = db.NewSelect().
		Model(&message).
		Join("JOIN ai_conversations AS aic ON aic.id = aim.conversation_id").
		Where("aim.id = ? AND aic.user_id = ?", messageID, userID).
		Scan(c)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Nachricht nicht gefunden", err)
			return
		}
		httperror.InternalServerError(c, "Feedback konnte nicht geladen werden", err)
		return
	}
	if message.Role != "assistant" {
		httperror.StatusBadRequest(c, "Feedback ist nur für AI-Antworten möglich", errors.New("message is not an assistant response"))
		return
	}

	if _, err := db.NewUpdate().
		Model((*models.AIMessage)(nil)).
		Set("feedback = ?", feedback).
		Where("id = ?", messageID).
		Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Feedback konnte nicht gespeichert werden", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "ai.message.feedback", "updated AI message feedback "+messageID.String())
	c.JSON(200, gin.H{"feedback": feedback})
}
