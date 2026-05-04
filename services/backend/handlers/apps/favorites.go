package apps

import (
	"fmt"
	"net/http"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// GetFavorites returns all app IDs the current user has favorited.
func GetFavorites(c *gin.Context, db *bun.DB) {
	userID, _, ok := getViewerContext(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"app_ids": []string{}})
		return
	}

	var favs []models.UserFavorite
	_ = db.NewSelect().Model(&favs).Where("user_id = ?", userID).Scan(c)

	ids := make([]string, 0, len(favs))
	for _, f := range favs {
		ids = append(ids, f.AppID)
	}

	c.JSON(http.StatusOK, gin.H{"app_ids": ids})
}

// AddFavorite adds an app to the current user's favorites.
func AddFavorite(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	userIDVal, exists := c.Get("user_id")
	if !exists {
		httperror.Unauthorized(c, "Not authenticated", nil)
		return
	}

	var userID uuid.UUID
	switch v := userIDVal.(type) {
	case uuid.UUID:
		userID = v
	case string:
		var err error
		userID, err = uuid.Parse(v)
		if err != nil {
			httperror.StatusBadRequest(c, "Invalid user ID", err)
			return
		}
	default:
		httperror.StatusBadRequest(c, "Invalid user ID", nil)
		return
	}

	fav := &models.UserFavorite{UserID: userID, AppID: appID}
	result, err := db.NewInsert().Model(fav).On("CONFLICT DO NOTHING").Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Could not add favorite", err)
		return
	}

	if rowsAffected, err := result.RowsAffected(); err == nil && rowsAffected > 0 {
		audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.favorite.add", fmt.Sprintf("added favorite for app %s", appID))
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// RemoveFavorite removes an app from the current user's favorites.
func RemoveFavorite(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	userIDVal, exists := c.Get("user_id")
	if !exists {
		httperror.Unauthorized(c, "Not authenticated", nil)
		return
	}

	var userID uuid.UUID
	switch v := userIDVal.(type) {
	case uuid.UUID:
		userID = v
	case string:
		var err error
		userID, err = uuid.Parse(v)
		if err != nil {
			httperror.StatusBadRequest(c, "Invalid user ID", err)
			return
		}
	default:
		httperror.StatusBadRequest(c, "Invalid user ID", nil)
		return
	}

	result, err := db.NewDelete().
		TableExpr("user_favorites").
		Where("user_id = ? AND app_id = ?", userID, appID).
		Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Could not remove favorite", err)
		return
	}

	if rowsAffected, err := result.RowsAffected(); err == nil && rowsAffected > 0 {
		audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.favorite.remove", fmt.Sprintf("removed favorite for app %s", appID))
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
