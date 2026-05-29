package users

import (
	"context"
	"database/sql"
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

func GetUpdatePreferences(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	preferences, err := loadOrCreatePreferences(context.Request.Context(), db, userID)
	if err != nil {
		httperror.InternalServerError(context, "Benachrichtigungseinstellungen konnten nicht geladen werden", err)
		return
	}

	context.JSON(http.StatusOK, preferences)
}

func UpdateUpdatePreferences(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var req struct {
		NotifyFavoritedApps    bool `json:"notifyFavoritedApps"`
		NotifyRecentlyViewed   bool `json:"notifyRecentlyViewedApps"`
		NotifyOwnedManagedApps bool `json:"notifyOwnedManagedApps"`
	}
	if err := context.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(context, "Ungültige Benachrichtigungseinstellungen", err)
		return
	}

	now := time.Now().UTC()
	preferences := models.UserUpdatePreferences{
		UserID:                 userID,
		NotifyFavoritedApps:    req.NotifyFavoritedApps,
		NotifyRecentlyViewed:   req.NotifyRecentlyViewed,
		NotifyOwnedManagedApps: req.NotifyOwnedManagedApps,
		UpdatedAt:              now,
	}
	if _, err := db.NewInsert().
		Model(&preferences).
		On("CONFLICT (user_id) DO UPDATE").
		Set("notify_favorited_apps = EXCLUDED.notify_favorited_apps").
		Set("notify_recently_viewed_apps = EXCLUDED.notify_recently_viewed_apps").
		Set("notify_owned_managed_apps = EXCLUDED.notify_owned_managed_apps").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(context.Request.Context()); err != nil {
		httperror.InternalServerError(context, "Benachrichtigungseinstellungen konnten nicht gespeichert werden", err)
		return
	}

	preferences, err := loadOrCreatePreferences(context.Request.Context(), db, userID)
	if err != nil {
		httperror.InternalServerError(context, "Benachrichtigungseinstellungen konnten nicht geladen werden", err)
		return
	}

	context.JSON(http.StatusOK, preferences)
}

func RecordRecentlyViewedApp(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var req struct {
		AppID string `json:"appId"`
	}
	if err := context.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(context, "Ungültige Anfrage für zuletzt angesehene App", err)
		return
	}

	appID := strings.TrimSpace(req.AppID)
	if appID == "" {
		httperror.StatusBadRequest(context, "App-ID fehlt", errors.New("missing app id"))
		return
	}

	exists, err := db.NewSelect().Model((*models.Apps)(nil)).Where("id = ?", appID).Exists(context.Request.Context())
	if err != nil {
		httperror.InternalServerError(context, "App konnte nicht geprüft werden", err)
		return
	}
	if !exists {
		httperror.StatusNotFound(context, "App nicht gefunden", errors.New("app not found"))
		return
	}

	now := time.Now().UTC()
	entry := models.UserRecentlyViewedApp{
		UserID:    userID,
		AppID:     appID,
		ViewedAt:  now,
		UpdatedAt: now,
	}
	if _, err := db.NewInsert().
		Model(&entry).
		On("CONFLICT (user_id, app_id) DO UPDATE").
		Set("viewed_at = EXCLUDED.viewed_at").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(context.Request.Context()); err != nil {
		httperror.InternalServerError(context, "Zuletzt angesehene App konnte nicht gespeichert werden", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"appId": appID, "viewedAt": now})
}

func ListReleaseUpdates(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	status := strings.ToLower(strings.TrimSpace(context.Query("status")))
	var items []models.ReleaseInboxListItem
	query := db.NewSelect().
		TableExpr("user_release_inbox_items AS item").
		ColumnExpr("item.id AS id").
		ColumnExpr("item.release_id AS release_id").
		ColumnExpr("item.app_id AS app_id").
		ColumnExpr("a.name AS app_name").
		ColumnExpr("a.icon AS app_icon").
		ColumnExpr("ar.version AS version").
		ColumnExpr("ar.release_type AS release_type").
		ColumnExpr("ar.title AS title").
		ColumnExpr("ar.summary AS summary").
		ColumnExpr("ar.changed_areas AS changed_areas").
		ColumnExpr("ar.change_details AS change_details").
		ColumnExpr("ar.diff_preview AS diff_preview").
		ColumnExpr("item.reason AS reason").
		ColumnExpr("ar.published_at AS published_at").
		ColumnExpr("item.seen_at AS seen_at").
		Join("JOIN app_releases AS ar ON ar.id = item.release_id").
		Join("JOIN apps AS a ON a.id = item.app_id").
		Where("item.user_id = ?", userID).
		OrderExpr("ar.published_at DESC")
	if status == "unread" {
		query = query.Where("item.seen_at IS NULL")
	}

	if err := query.Scan(context.Request.Context(), &items); err != nil {
		httperror.InternalServerError(context, "Updates konnten nicht geladen werden", err)
		return
	}

	context.JSON(http.StatusOK, items)
}

func GetReleaseUpdateSummary(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	type appUnreadCount struct {
		AppID string `bun:"app_id"`
		Count int    `bun:"count"`
	}

	var totalUnread int
	totalUnread, _ = db.NewSelect().
		TableExpr("user_release_inbox_items").
		Where("user_id = ?", userID).
		Where("seen_at IS NULL").
		Count(context.Request.Context())

	var rows []appUnreadCount
	if err := db.NewSelect().
		TableExpr("user_release_inbox_items").
		ColumnExpr("app_id").
		ColumnExpr("COUNT(*)::int AS count").
		Where("user_id = ?", userID).
		Where("seen_at IS NULL").
		GroupExpr("app_id").
		Scan(context.Request.Context(), &rows); err != nil {
		httperror.InternalServerError(context, "Update-Zusammenfassung konnte nicht geladen werden", err)
		return
	}

	appCounts := make(map[string]int, len(rows))
	for _, row := range rows {
		appCounts[row.AppID] = row.Count
	}

	context.JSON(http.StatusOK, gin.H{
		"totalUnread":    totalUnread,
		"appUnreadCounts": appCounts,
	})
}

func MarkReleaseUpdateSeen(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	itemID, err := uuid.Parse(strings.TrimSpace(context.Param("id")))
	if err != nil {
		httperror.StatusBadRequest(context, "Ungültige Update-ID", err)
		return
	}

	now := time.Now().UTC()
	result, err := db.NewUpdate().
		Model((*models.UserReleaseInboxItem)(nil)).
		Set("seen_at = COALESCE(seen_at, ?)", now).
		Where("id = ?", itemID).
		Where("user_id = ?", userID).
		Exec(context.Request.Context())
	if err != nil {
		httperror.InternalServerError(context, "Update konnte nicht als gelesen markiert werden", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		httperror.StatusNotFound(context, "Update nicht gefunden", errors.New("update not found"))
		return
	}

	context.Status(http.StatusNoContent)
}

func loadOrCreatePreferences(ctx context.Context, db *bun.DB, userID uuid.UUID) (models.UserUpdatePreferences, error) {
	var preferences models.UserUpdatePreferences
	err := db.NewSelect().Model(&preferences).Where("user_id = ?", userID).Scan(ctx)
	if err == nil {
		return preferences, nil
	}
	if err != sql.ErrNoRows {
		return models.UserUpdatePreferences{}, err
	}

	now := time.Now().UTC()
	preferences = models.UserUpdatePreferences{
		UserID:                 userID,
		NotifyFavoritedApps:    true,
		NotifyRecentlyViewed:   true,
		NotifyOwnedManagedApps: true,
		CreatedAt:              now,
		UpdatedAt:              now,
	}
	if _, insertErr := db.NewInsert().
		Model(&preferences).
		On("CONFLICT (user_id) DO NOTHING").
		Exec(ctx); insertErr != nil {
		return models.UserUpdatePreferences{}, insertErr
	}

	if err := db.NewSelect().Model(&preferences).Where("user_id = ?", userID).Scan(ctx); err != nil {
		return models.UserUpdatePreferences{}, err
	}
	return preferences, nil
}
