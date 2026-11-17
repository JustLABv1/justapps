package admins

import (
	"net/http"
	"strconv"
	"strings"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// auditAreas maps an area of the platform to the operation prefixes it covers.
var auditAreas = map[string][]string{
	"apps":      {"app.create", "app.update", "app.delete", "app.publish", "app.visibility", "app.editors", "app.gitlab", "app.health", "app.changelog", "app.creation", "catalog."},
	"users":     {"user.", "role.", "auth."},
	"community": {"app.rating", "app.faq", "faq.", "global.faq", "app.favorite"},
	"settings":  {"settings.", "spaces.", "space."},
	"ai":        {"ai."},
}

func GetAudit(c *gin.Context, db *bun.DB) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	operation := c.Query("operation")
	area := c.Query("area")
	search := strings.TrimSpace(c.Query("q"))

	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	q := db.NewSelect().
		TableExpr("audit AS a").
		Join("LEFT JOIN users AS u ON u.id::text = a.user_id")

	if operation != "" {
		q = q.Where("a.operation = ?", operation)
	}
	if prefixes, ok := auditAreas[area]; ok {
		q = q.WhereGroup(" AND ", func(group *bun.SelectQuery) *bun.SelectQuery {
			for _, prefix := range prefixes {
				group = group.WhereOr("a.operation LIKE ?", prefix+"%")
			}
			return group
		})
	}
	if search != "" {
		pattern := "%" + strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(search) + "%"
		q = q.WhereGroup(" AND ", func(group *bun.SelectQuery) *bun.SelectQuery {
			return group.
				Where("u.username ILIKE ?", pattern).
				WhereOr("u.email ILIKE ?", pattern).
				WhereOr("u.display_name ILIKE ?", pattern).
				WhereOr("a.details ILIKE ?", pattern)
		})
	}

	total, err := q.Clone().Count(c.Request.Context())
	if err != nil {
		httperror.InternalServerError(c, "Error counting audit log", err)
		return
	}

	entries := make([]models.AuditWithUser, 0)
	if err := q.
		ColumnExpr("a.id, a.user_id, a.operation, a.details, a.created_at").
		ColumnExpr("COALESCE(u.username, '') AS username, COALESCE(u.email, '') AS email, COALESCE(u.role, '') AS role").
		ColumnExpr("COALESCE(u.display_name, '') AS display_name, COALESCE(u.avatar_url, '') AS avatar_url").
		OrderExpr("a.created_at DESC").
		Limit(int64(limit)).
		Offset(int64(offset)).
		Scan(c.Request.Context(), &entries); err != nil {
		httperror.InternalServerError(c, "Error fetching audit log", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
		"limit":   limit,
		"offset":  offset,
		"total":   total,
	})
}
