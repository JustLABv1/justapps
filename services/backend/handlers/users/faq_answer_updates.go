package users

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func ListFAQAnswerNotifications(c *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}
	page, pageSize, ok := parseNotificationPagination(c)
	if !ok {
		return
	}

	unreadOnly := strings.EqualFold(strings.TrimSpace(c.Query("status")), "unread")
	seenFilter := ""
	if unreadOnly {
		seenFilter = " WHERE notification.seen_at IS NULL"
	}

	baseQuery := `
		SELECT * FROM (
			SELECT n.id, n.app_question_id AS question_id, n.app_answer_id AS answer_id,
				'app'::text AS scope, n.app_id, app.name AS app_name,
				question.question, answer.answer, answer.username AS answerer,
				n.created_at, n.seen_at
			FROM user_faq_answer_notifications AS n
			JOIN faq_questions AS question ON question.id = n.app_question_id
			JOIN faq_answers AS answer ON answer.id = n.app_answer_id
			JOIN apps AS app ON app.id = n.app_id
			WHERE n.user_id = ? AND n.app_answer_id IS NOT NULL
			UNION ALL
			SELECT n.id, n.global_question_id AS question_id, n.global_answer_id AS answer_id,
				'global'::text AS scope, NULL::text AS app_id, ''::text AS app_name,
				question.question, answer.answer, answer.username AS answerer,
				n.created_at, n.seen_at
			FROM user_faq_answer_notifications AS n
			JOIN global_faq_questions AS question ON question.id = n.global_question_id
			JOIN global_faq_answers AS answer ON answer.id = n.global_answer_id
			WHERE n.user_id = ? AND n.global_answer_id IS NOT NULL
		) AS notification` + seenFilter
	countQuery := `SELECT COUNT(*) FROM (` + baseQuery + `) AS counted_notifications`
	var total int
	if err := db.NewRaw(countQuery, userID, userID).Scan(c.Request.Context(), &total); err != nil {
		httperror.InternalServerError(c, "Antwort-Benachrichtigungen konnten nicht gezählt werden", err)
		return
	}
	query := baseQuery + ` ORDER BY notification.created_at DESC LIMIT ? OFFSET ?`

	items := make([]models.FAQAnswerNotificationListItem, 0)
	if err := db.NewRaw(query, userID, userID, pageSize, (page-1)*pageSize).Scan(c.Request.Context(), &items); err != nil {
		httperror.InternalServerError(c, "Antwort-Benachrichtigungen konnten nicht geladen werden", err)
		return
	}
	c.JSON(http.StatusOK, paginatedResponse(items, page, pageSize, total))
}

func MarkFAQAnswerNotificationSeen(c *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}
	notificationID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		httperror.StatusBadRequest(c, "Ungültige Antwort-Benachrichtigungs-ID", err)
		return
	}

	result, err := db.NewUpdate().Model((*models.UserFAQAnswerNotification)(nil)).
		Set("seen_at = COALESCE(seen_at, ?)", time.Now().UTC()).
		Where("id = ?", notificationID).
		Where("user_id = ?", userID).
		Exec(c.Request.Context())
	if err != nil {
		httperror.InternalServerError(c, "Antwort-Benachrichtigung konnte nicht als gelesen markiert werden", err)
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		httperror.StatusNotFound(c, "Antwort-Benachrichtigung nicht gefunden", errors.New("FAQ answer notification not found"))
		return
	}
	c.Status(http.StatusNoContent)
}

func markAllFAQAnswerNotificationsSeen(ctx context.Context, db *bun.DB, userID uuid.UUID) error {
	_, err := db.NewUpdate().Model((*models.UserFAQAnswerNotification)(nil)).
		Set("seen_at = COALESCE(seen_at, ?)", time.Now().UTC()).
		Where("user_id = ?", userID).
		Where("seen_at IS NULL").
		Exec(ctx)
	return err
}
