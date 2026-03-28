package admins

import (
	"net/http"
	"strconv"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func GetAudit(c *gin.Context, db *bun.DB) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	operation := c.Query("operation")

	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	entries := make([]models.AuditWithUser, 0)
	q := db.NewSelect().
		TableExpr("audit AS a").
		ColumnExpr("a.id, a.user_id, a.operation, a.details, a.created_at, u.username, u.email, u.role").
		Join("LEFT JOIN users AS u ON u.id::text = a.user_id").
		OrderExpr("a.created_at DESC").
		Limit(limit).
		Offset(offset)

	if operation != "" {
		q = q.Where("a.operation = ?", operation)
	}

	if err := q.Scan(c, &entries); err != nil {
		httperror.InternalServerError(c, "Error fetching audit log", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
		"limit":   limit,
		"offset":  offset,
	})
}
