package users

import (
	"errors"
	"strconv"
	"strings"

	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
)

const (
	defaultNotificationPageSize = 15
	maxNotificationPageSize     = 50
)

func parseNotificationPagination(c *gin.Context) (int, int, bool) {
	page, err := strconv.Atoi(strings.TrimSpace(c.DefaultQuery("page", "1")))
	if err != nil || page < 1 {
		httperror.StatusBadRequest(c, "Ungültige Seite", errors.New("page must be a positive integer"))
		return 0, 0, false
	}
	pageSize, err := strconv.Atoi(strings.TrimSpace(c.DefaultQuery("pageSize", strconv.Itoa(defaultNotificationPageSize))))
	if err != nil || pageSize < 1 || pageSize > maxNotificationPageSize {
		httperror.StatusBadRequest(c, "Ungültige Seitengröße", errors.New("pageSize must be between 1 and 50"))
		return 0, 0, false
	}
	return page, pageSize, true
}

func paginatedResponse(items any, page, pageSize, total int) gin.H {
	return gin.H{
		"items":    items,
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
		"hasMore":  page*pageSize < total,
	}
}
