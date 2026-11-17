package users

import (
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"justapps-backend/functions/httperror"
	"net/http"
	"strings"
	"time"
)

type requestNotification struct {
	ID        uuid.UUID  `bun:"id" json:"id"`
	RequestID uuid.UUID  `bun:"request_id" json:"requestId"`
	Title     string     `bun:"title" json:"title"`
	Kind      string     `bun:"kind" json:"kind"`
	Response  string     `bun:"response" json:"response"`
	CreatedAt time.Time  `bun:"created_at" json:"createdAt"`
	SeenAt    *time.Time `bun:"seen_at" json:"seenAt"`
}

func ListRequestNotifications(c *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}
	page, pageSize, ok := parseNotificationPagination(c)
	if !ok {
		return
	}
	filter := ""
	if strings.EqualFold(strings.TrimSpace(c.Query("status")), "unread") {
		filter = " AND n.seen_at IS NULL"
	}
	base := ` FROM user_request_notifications n JOIN app_requests r ON r.id = n.request_id WHERE n.user_id = ?` + filter
	var total int64
	if err := db.NewRaw(`SELECT COUNT(*)`+base, userID).Scan(c.Request.Context(), &total); err != nil {
		httperror.InternalServerError(c, "Bedarfsbenachrichtigungen konnten nicht gezählt werden", err)
		return
	}
	items := []requestNotification{}
	if err := db.NewRaw(`SELECT n.id, n.request_id, r.title, n.kind, n.response, n.created_at, n.seen_at`+base+` ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`, userID, pageSize, (page-1)*pageSize).Scan(c.Request.Context(), &items); err != nil {
		httperror.InternalServerError(c, "Bedarfsbenachrichtigungen konnten nicht geladen werden", err)
		return
	}
	c.JSON(http.StatusOK, paginatedResponse(items, page, pageSize, total))
}

func GetRequestNotificationSummary(c *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}
	count, err := db.NewSelect().Table("user_request_notifications").Where("user_id = ? AND seen_at IS NULL", userID).Count(c.Request.Context())
	if err != nil {
		httperror.InternalServerError(c, "Bedarfsbenachrichtigungen konnten nicht gezählt werden", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"totalUnread": count})
}

func MarkRequestNotificationSeen(c *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperror.StatusBadRequest(c, "Ungültige Benachrichtigungs-ID", err)
		return
	}
	result, err := db.NewRaw(`UPDATE user_request_notifications SET seen_at = COALESCE(seen_at, now()) WHERE id = ? AND user_id = ?`, id, userID).Exec(c.Request.Context())
	if err != nil {
		httperror.InternalServerError(c, "Benachrichtigung konnte nicht als gelesen markiert werden", err)
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		httperror.StatusNotFound(c, "Benachrichtigung nicht gefunden", errors.New("notification not found"))
		return
	}
	c.Status(http.StatusNoContent)
}
