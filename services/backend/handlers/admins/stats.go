package admins

import (
	"net/http"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func GetStats(c *gin.Context, db *bun.DB) {
	oneWeekAgo := time.Now().AddDate(0, 0, -7)

	totalApps, err := db.NewSelect().TableExpr("apps").Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: count apps", err)
		return
	}

	draftApps, err := db.NewSelect().TableExpr("apps").Where("LOWER(status) = 'entwurf'").Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: count drafts", err)
		return
	}

	totalUsers, err := db.NewSelect().Model((*models.Users)(nil)).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: count users", err)
		return
	}

	newUsersThisWeek, err := db.NewSelect().Model((*models.Users)(nil)).
		Where("created_at >= ?", oneWeekAgo).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: new users", err)
		return
	}

	newAppsThisWeek, err := db.NewSelect().TableExpr("apps").
		Where("updated_at >= ?", oneWeekAgo).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: new apps", err)
		return
	}

	recentActivity := make([]models.AuditWithUser, 0)
	_ = db.NewSelect().
		TableExpr("audit AS a").
		ColumnExpr("a.id, a.user_id, a.operation, a.details, a.created_at, u.username, u.email, u.role").
		Join("LEFT JOIN users AS u ON u.id::text = a.user_id").
		OrderExpr("a.created_at DESC").
		Limit(10).
		Scan(c, &recentActivity)

	c.JSON(http.StatusOK, gin.H{
		"totalApps":        totalApps,
		"draftApps":        draftApps,
		"totalUsers":       totalUsers,
		"newUsersThisWeek": newUsersThisWeek,
		"newAppsThisWeek":  newAppsThisWeek,
		"recentActivity":   recentActivity,
	})
}
