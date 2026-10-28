package users

import (
	"net/http"
	"strings"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ListSelectableUsers(context *gin.Context, db *bun.DB) {
	users := make([]models.Users, 0)
	query := db.NewSelect().Model(&users).
		Column("id", "username", "email", "role", "auth_type", "can_submit_apps", "disabled").
		Where("disabled = FALSE").
		OrderExpr("LOWER(username) ASC, LOWER(email) ASC")
	search := context.Query("q")
	_, searching := context.Request.URL.Query()["q"]
	if searching {
		search = strings.TrimSpace(search)
		if len([]rune(search)) < 2 {
			context.JSON(http.StatusOK, gin.H{"users": users, "hasMore": false})
			return
		}
		pattern := "%" + strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(search) + "%"
		query = query.Where("username ILIKE ? OR email ILIKE ?", pattern, pattern).Limit(21)
	}
	err := query.Scan(context.Request.Context())
	if err != nil {
		httperror.InternalServerError(context, "Error collecting users on db", err)
		return
	}

	hasMore := searching && len(users) > 20
	if hasMore {
		users = users[:20]
	}
	context.JSON(http.StatusOK, gin.H{"users": users, "hasMore": hasMore})
}
