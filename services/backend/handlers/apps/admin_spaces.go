package apps

import (
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"
	"strconv"
	"strings"
)

func ListAdminSpaces(c *gin.Context, db *bun.DB) {
	if !requireSpaceAdmin(c) {
		return
	}
	page := 1
	if raw := c.Query("page"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			httperror.StatusBadRequest(c, "Ungültige Seite", errors.New("invalid page"))
			return
		}
		page = parsed
	}
	rows := make([]struct {
		models.PrivateSpace
		OwnerUsername   string `bun:"owner_username" json:"ownerUsername"`
		OwnerEmail      string `bun:"owner_email" json:"ownerEmail"`
		AppCount        int    `bun:"app_count" json:"appCount"`
		MemberCount     int    `bun:"member_count" json:"memberCount"`
		InvitationCount int    `bun:"invitation_count" json:"invitationCount"`
		GroupCount      int    `bun:"group_count" json:"groupCount"`
		Accepted        bool   `bun:"accepted" json:"accepted"`
		CanViewApps     bool   `bun:"can_view_apps" json:"canViewApps"`
	}, 0)
	viewerID, _, _ := getViewerContext(c)
	query := db.NewSelect().TableExpr("private_spaces ps").ColumnExpr(`ps.*, u.username AS owner_username, u.email AS owner_email, true AS accepted,
 (SELECT COUNT(*) FROM apps a WHERE a.space_id = ps.id) AS app_count,
 1 + (SELECT COUNT(*) FROM private_space_members m WHERE m.space_id = ps.id AND m.accepted AND m.user_id <> ps.owner_id) AS member_count,
 (SELECT COUNT(*) FROM private_space_members m WHERE m.space_id = ps.id AND NOT m.accepted AND m.user_id <> ps.owner_id) AS invitation_count,
 (SELECT COUNT(*) FROM private_space_group_mappings g WHERE g.space_id = ps.id) AS group_count`).ColumnExpr("(ps.owner_id = ? OR EXISTS (SELECT 1 FROM private_space_members vm WHERE vm.space_id = ps.id AND vm.user_id = ? AND vm.accepted)) AS can_view_apps", viewerID, viewerID).Join("JOIN users u ON u.id = ps.owner_id")
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		pattern := "%" + strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(q) + "%"
		query = query.Where("ps.name ILIKE ? OR u.username ILIKE ? OR u.email ILIKE ?", pattern, pattern, pattern)
	}
	total, err := query.Count(c)
	if err != nil {
		httperror.InternalServerError(c, "Spaces konnten nicht gezählt werden", err)
		return
	}
	if err := query.OrderExpr("ps.created_at DESC, ps.id ASC").Limit(50).Offset(int64((page-1)*50)).Scan(c, &rows); err != nil {
		httperror.InternalServerError(c, "Spaces konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, gin.H{"items": rows, "total": total, "page": page, "pageSize": 50})
}

func TransferSpaceOwner(c *gin.Context, db *bun.DB) {
	if !requireSpaceAdmin(c) {
		return
	}
	space, ok := loadSpace(c, db, true)
	if !ok {
		return
	}
	var body struct {
		UserID string `json:"userId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "Benutzer fehlt", err)
		return
	}
	target, err := uuid.Parse(body.UserID)
	if err != nil || target == uuid.Nil {
		httperror.StatusBadRequest(c, "Ungültiger Benutzer", errors.New("invalid user id"))
		return
	}
	exists, err := db.NewSelect().Model((*models.Users)(nil)).Where("id = ? AND disabled = false", target).Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Benutzer konnte nicht geprüft werden", err)
		return
	}
	if !exists {
		httperror.StatusBadRequest(c, "Kein aktiver Benutzer gefunden", errors.New("target unavailable"))
		return
	}
	if _, err := db.NewUpdate().Model((*models.PrivateSpace)(nil)).Set("owner_id = ?", target).Where("id = ?", space.ID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Eigentümer konnte nicht geändert werden", err)
		return
	}
	actor, _, _ := getViewerContext(c)
	audit.WriteAudit(c.Request.Context(), db, actor.String(), "space.owner.update", fmt.Sprintf("transferred space %s from %s to %s", space.ID, space.OwnerID, target))
	c.Status(204)
}

func requireSpaceAdmin(c *gin.Context) bool {
	_, role, ok := getRequiredViewerContext(c)
	if !ok {
		return false
	}
	if role != "admin" {
		httperror.Forbidden(c, "Administratorrechte erforderlich", errors.New("admin required"))
		return false
	}
	return true
}
