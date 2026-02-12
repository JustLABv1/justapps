package apps

import (
	"justwms-backend/functions/httperror"
	"justwms-backend/pkg/models"
	"net/http"

	"github.com/gin-gonic/gin"
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

	// Get user info if available (for ownership check)
	// In a full implementation, this should come from middleware
	// For now, we'll allow the request if the client provides the correct info
	// or if we implement basic auth check here.

	_, err := db.NewDelete().
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
