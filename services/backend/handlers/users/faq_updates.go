package users

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func ListFAQQuestionNotifications(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var items []models.FAQInboxListItem
	query := db.NewSelect().
		TableExpr("user_faq_inbox_items AS item").
		ColumnExpr("item.id AS id").
		ColumnExpr("item.question_id AS question_id").
		ColumnExpr("item.app_id AS app_id").
		ColumnExpr("app.name AS app_name").
		ColumnExpr("app.icon AS app_icon").
		ColumnExpr("question.username AS questioner").
		ColumnExpr("question.question AS question").
		ColumnExpr("COUNT(answer.id)::int AS answer_count").
		ColumnExpr("item.created_at AS created_at").
		ColumnExpr("item.seen_at AS seen_at").
		Join("JOIN faq_questions AS question ON question.id = item.question_id").
		Join("JOIN apps AS app ON app.id = item.app_id").
		Join("LEFT JOIN faq_answers AS answer ON answer.question_id = question.id").
		Where("item.user_id = ?", userID).
		Where("NOT EXISTS (SELECT 1 FROM faq_answers AS resolved_answer WHERE resolved_answer.question_id = question.id)").
		GroupExpr("item.id, item.question_id, item.app_id, app.name, app.icon, question.username, question.question, item.created_at, item.seen_at").
		OrderExpr("item.created_at DESC")

	if strings.EqualFold(strings.TrimSpace(context.Query("status")), "unread") {
		query = query.Where("item.seen_at IS NULL")
	}

	if err := query.Scan(context.Request.Context(), &items); err != nil {
		httperror.InternalServerError(context, "FAQ-Benachrichtigungen konnten nicht geladen werden", err)
		return
	}

	if items == nil {
		items = make([]models.FAQInboxListItem, 0)
	}
	context.JSON(http.StatusOK, items)
}

func GetFAQQuestionNotificationSummary(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	totalUnread, err := db.NewSelect().
		TableExpr("user_faq_inbox_items AS item").
		Join("JOIN faq_questions AS question ON question.id = item.question_id").
		Where("item.user_id = ?", userID).
		Where("item.seen_at IS NULL").
		Where("NOT EXISTS (SELECT 1 FROM faq_answers AS resolved_answer WHERE resolved_answer.question_id = question.id)").
		Count(context.Request.Context())
	if err != nil {
		httperror.InternalServerError(context, "FAQ-Benachrichtigungen konnten nicht gezählt werden", err)
		return
	}

	type appUnreadCount struct {
		AppID string `bun:"app_id"`
		Count int    `bun:"count"`
	}
	var rows []appUnreadCount
	if err := db.NewSelect().
		TableExpr("user_faq_inbox_items AS item").
		Join("JOIN faq_questions AS question ON question.id = item.question_id").
		ColumnExpr("item.app_id AS app_id").
		ColumnExpr("COUNT(*)::int AS count").
		Where("item.user_id = ?", userID).
		Where("item.seen_at IS NULL").
		Where("NOT EXISTS (SELECT 1 FROM faq_answers AS resolved_answer WHERE resolved_answer.question_id = question.id)").
		GroupExpr("item.app_id").
		Scan(context.Request.Context(), &rows); err != nil {
		httperror.InternalServerError(context, "FAQ-Benachrichtigungen konnten nicht zusammengefasst werden", err)
		return
	}

	appCounts := make(map[string]int, len(rows))
	for _, row := range rows {
		appCounts[row.AppID] = row.Count
	}

	context.JSON(http.StatusOK, gin.H{
		"totalUnread":     totalUnread,
		"appUnreadCounts": appCounts,
	})
}

func MarkFAQQuestionNotificationSeen(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	notificationID, err := uuid.Parse(strings.TrimSpace(context.Param("id")))
	if err != nil {
		httperror.StatusBadRequest(context, "Ungültige FAQ-Benachrichtigungs-ID", err)
		return
	}

	result, err := db.NewUpdate().
		Model((*models.UserFAQInboxItem)(nil)).
		Set("seen_at = COALESCE(seen_at, CURRENT_TIMESTAMP)").
		Where("id = ?", notificationID).
		Where("user_id = ?", userID).
		Exec(context.Request.Context())
	if err != nil {
		httperror.InternalServerError(context, "FAQ-Benachrichtigung konnte nicht als gelesen markiert werden", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		httperror.StatusNotFound(context, "FAQ-Benachrichtigung nicht gefunden", errors.New("FAQ notification not found"))
		return
	}

	context.Status(http.StatusNoContent)
}

func markAllFAQQuestionNotificationsSeen(ctx context.Context, db *bun.DB, userID uuid.UUID) error {
	_, err := db.NewUpdate().
		Model((*models.UserFAQInboxItem)(nil)).
		Set("seen_at = COALESCE(seen_at, CURRENT_TIMESTAMP)").
		Where("user_id = ?", userID).
		Where("seen_at IS NULL").
		Exec(ctx)
	return err
}
