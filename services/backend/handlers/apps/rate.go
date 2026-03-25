package apps

import (
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func AddRating(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	var rating models.Rating
	if err := c.ShouldBindJSON(&rating); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}

	rating.AppID = appID

	// Check if user already rated this app
	exists, err := db.NewSelect().
		Model((*models.Rating)(nil)).
		Where("app_id = ? AND user_id = ?", appID, rating.UserID).
		Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Error checking rating status", err)
		return
	}

	if exists {
		// Update existing rating
		_, err = db.NewUpdate().
			Model(&rating).
			Where("app_id = ? AND user_id = ?", appID, rating.UserID).
			Column("rating", "comment", "username").
			Exec(c)
	} else {
		// Insert new rating
		_, err = db.NewInsert().Model(&rating).Exec(c)
	}

	if err != nil {
		httperror.InternalServerError(c, "Error saving rating", err)
		return
	}

	// Recalculate App Average
	var stats struct {
		Avg   float64 `bun:"avg"`
		Count int     `bun:"count"`
	}
	err = db.NewSelect().
		Table("ratings").
		ColumnExpr("AVG(rating) as avg").
		ColumnExpr("COUNT(*) as count").
		Where("app_id = ?", appID).
		Scan(c, &stats)

	if err == nil {
		_, _ = db.NewUpdate().
			Model((*models.Apps)(nil)).
			Set("rating_avg = ?", stats.Avg).
			Set("rating_count = ?", stats.Count).
			Where("id = ?", appID).
			Exec(c)
	}

	c.JSON(200, gin.H{"status": "success"})
}

func GetRatings(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	ratings := make([]models.Rating, 0)
	err := db.NewSelect().
		Model(&ratings).
		Where("app_id = ?", appID).
		Order("created_at DESC").
		Scan(c)

	if err != nil {
		httperror.InternalServerError(c, "Error fetching ratings", err)
		return
	}

	c.JSON(http.StatusOK, ratings)
}

func DeleteRating(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	ratingID := c.Param("ratingId")

	// Verify rating existence (ensure it belongs to this app)
	var rating models.Rating
	err := db.NewSelect().Model(&rating).Where("id = ? AND app_id = ?", ratingID, appID).Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "Rating not found", err)
		return
	}

	// Permission Check: Owner or Admin
	userRole := c.GetString("role")
	userIDVal, exists := c.Get("user_id")
	if !exists {
		httperror.Unauthorized(c, "Auth required", nil)
		return
	}

	var userID string
	if idUUID, ok := userIDVal.(uuid.UUID); ok {
		userID = idUUID.String()
	} else if idStr, ok := userIDVal.(string); ok {
		userID = idStr
	}

	if userRole != "admin" && rating.UserID != userID {
		httperror.Forbidden(c, "Not authorized to delete this rating", nil)
		return
	}

	_, err = db.NewDelete().
		Model((*models.Rating)(nil)).
		Where("id = ? AND app_id = ?", ratingID, appID).
		Exec(c)

	if err != nil {
		httperror.InternalServerError(c, "Error deleting rating", err)
		return
	}

	// Recalculate App Average after deletion
	var stats struct {
		Avg   float64 `bun:"avg"`
		Count int     `bun:"count"`
	}
	err = db.NewSelect().
		Table("ratings").
		ColumnExpr("AVG(rating) as avg").
		ColumnExpr("COUNT(*) as count").
		Where("app_id = ?", appID).
		Scan(c, &stats)

	if err == nil {
		_, _ = db.NewUpdate().
			Model((*models.Apps)(nil)).
			Set("rating_avg = ?", stats.Avg).
			Set("rating_count = ?", stats.Count).
			Where("id = ?", appID).
			Exec(c)
	}

	c.JSON(200, gin.H{"status": "success"})
}
