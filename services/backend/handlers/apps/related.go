package apps

import (
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// GetRelatedApps returns all apps related to the given app (bidirectional).
func GetRelatedApps(c *gin.Context, db *bun.DB) {
	id := c.Param("id")
	viewerID, viewerRole, hasViewer := getViewerContext(c)

	var baseApp models.Apps
	if err := db.NewSelect().Model(&baseApp).Where("id = ?", id).Scan(c); err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return
	}
	if !canViewApp(baseApp, viewerID, viewerRole, hasViewer) {
		httperror.StatusNotFound(c, "App not found", nil)
		return
	}

	type relRow struct {
		RelatedAppID string    `bun:"related_app_id"`
		Name         string    `bun:"name"`
		Icon         string    `bun:"icon"`
		OwnerID      uuid.UUID `bun:"owner_id"`
		Status       string    `bun:"status"`
	}
	var rows []relRow
	err := db.NewRaw(`
		SELECT r.related_app_id, a.name, a.icon, a.owner_id, a.status
		FROM app_relations r
		JOIN apps a ON a.id = r.related_app_id
		WHERE r.app_id = ?
		UNION
		SELECT r.app_id AS related_app_id, a.name, a.icon, a.owner_id, a.status
		FROM app_relations r
		JOIN apps a ON a.id = r.app_id
		WHERE r.related_app_id = ?
	`, id, id).Scan(c, &rows)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching related apps", err)
		return
	}

	result := make([]models.AppRelationSummary, 0, len(rows))
	for _, r := range rows {
		relatedApp := models.Apps{ID: r.RelatedAppID, Name: r.Name, Icon: r.Icon, OwnerID: r.OwnerID, Status: r.Status}
		if !canViewApp(relatedApp, viewerID, viewerRole, hasViewer) {
			continue
		}
		result = append(result, models.AppRelationSummary{
			ID:   r.RelatedAppID,
			Name: r.Name,
			Icon: r.Icon,
		})
	}
	c.JSON(200, result)
}

// AddRelatedApp creates a bidirectional relation between two apps.
func AddRelatedApp(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")

	var body struct {
		RelatedAppID string `json:"relatedAppId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "relatedAppId is required", err)
		return
	}
	if body.RelatedAppID == appID {
		httperror.StatusBadRequest(c, "An app cannot be related to itself", nil)
		return
	}

	// Ensure both apps exist
	exists, err := db.NewSelect().TableExpr("apps").Where("id IN (?, ?)", appID, body.RelatedAppID).Count(c)
	if err != nil || exists < 2 {
		httperror.StatusNotFound(c, "One or both apps not found", err)
		return
	}

	relation := &models.AppRelation{
		AppID:        appID,
		RelatedAppID: body.RelatedAppID,
	}
	_, err = db.NewInsert().Model(relation).On("CONFLICT DO NOTHING").Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error creating relation", err)
		return
	}

	c.JSON(201, gin.H{"message": "Relation created"})
}

// RemoveRelatedApp deletes the relation between two apps (both directions).
func RemoveRelatedApp(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	relatedID := c.Param("relatedId")

	_, err := db.NewRaw(`
		DELETE FROM app_relations
		WHERE (app_id = ? AND related_app_id = ?)
		   OR (app_id = ? AND related_app_id = ?)
	`, appID, relatedID, relatedID, appID).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error removing relation", err)
		return
	}

	c.JSON(200, gin.H{"message": "Relation removed"})
}

// ----- App Groups -----

// ListGroups returns all app groups.
func ListGroups(c *gin.Context, db *bun.DB) {
	var groups []models.AppGroup
	err := db.NewSelect().Model(&groups).Scan(c)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching groups", err)
		return
	}
	c.JSON(200, groups)
}

// CreateGroup creates a new app group.
func CreateGroup(c *gin.Context, db *bun.DB) {
	var body struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "name is required", err)
		return
	}

	group := &models.AppGroup{
		Name:        body.Name,
		Description: body.Description,
	}
	_, err := db.NewInsert().Model(group).Returning("*").Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error creating group", err)
		return
	}

	c.JSON(201, group)
}

// UpdateGroup updates name/description of an existing group.
func UpdateGroup(c *gin.Context, db *bun.DB) {
	groupID := c.Param("groupId")

	var body struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "name is required", err)
		return
	}

	_, err := db.NewUpdate().
		TableExpr("app_groups").
		Set("name = ?", body.Name).
		Set("description = ?", body.Description).
		Where("id = ?::uuid", groupID).
		Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error updating group", err)
		return
	}

	c.JSON(200, gin.H{"message": "Group updated"})
}

// DeleteGroup deletes an app group and all its members.
func DeleteGroup(c *gin.Context, db *bun.DB) {
	groupID := c.Param("groupId")
	_, err := db.NewDelete().TableExpr("app_groups").Where("id = ?::uuid", groupID).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error deleting group", err)
		return
	}
	c.JSON(200, gin.H{"message": "Group deleted"})
}

// GetGroupMembers returns all apps in a group.
func GetGroupMembers(c *gin.Context, db *bun.DB) {
	groupID := c.Param("groupId")
	viewerID, viewerRole, hasViewer := getViewerContext(c)

	type memberRow struct {
		AppID   string    `bun:"app_id"`
		Name    string    `bun:"name"`
		Icon    string    `bun:"icon"`
		OwnerID uuid.UUID `bun:"owner_id"`
		Status  string    `bun:"status"`
	}
	var rows []memberRow
	err := db.NewRaw(`
		SELECT m.app_id, a.name, a.icon, a.owner_id, a.status
		FROM app_group_members m
		JOIN apps a ON a.id = m.app_id
		WHERE m.app_group_id = ?::uuid
	`, groupID).Scan(c, &rows)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching group members", err)
		return
	}

	result := make([]models.AppRelationSummary, 0, len(rows))
	for _, r := range rows {
		memberApp := models.Apps{ID: r.AppID, Name: r.Name, Icon: r.Icon, OwnerID: r.OwnerID, Status: r.Status}
		if !canViewApp(memberApp, viewerID, viewerRole, hasViewer) {
			continue
		}
		result = append(result, models.AppRelationSummary{ID: r.AppID, Name: r.Name, Icon: r.Icon})
	}
	c.JSON(200, result)
}

// AddGroupMember adds an app to a group.
func AddGroupMember(c *gin.Context, db *bun.DB) {
	groupID := c.Param("groupId")

	var body struct {
		AppID string `json:"appId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "appId is required", err)
		return
	}

	// Ensure both group and app exist
	groupExists, _ := db.NewSelect().TableExpr("app_groups").Where("id = ?::uuid", groupID).Count(c)
	appExists, _ := db.NewSelect().TableExpr("apps").Where("id = ?", body.AppID).Count(c)
	if groupExists == 0 || appExists == 0 {
		httperror.StatusNotFound(c, "Group or app not found", nil)
		return
	}

	_, err := db.NewRaw(`
		INSERT INTO app_group_members (app_group_id, app_id) VALUES (?::uuid, ?)
		ON CONFLICT DO NOTHING
	`, groupID, body.AppID).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error adding member", err)
		return
	}

	c.JSON(201, gin.H{"message": "Member added"})
}

// RemoveGroupMember removes an app from a group.
func RemoveGroupMember(c *gin.Context, db *bun.DB) {
	groupID := c.Param("groupId")
	appID := c.Param("appId")

	_, err := db.NewDelete().TableExpr("app_group_members").
		Where("app_group_id = ?::uuid AND app_id = ?", groupID, appID).
		Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Error removing member", err)
		return
	}
	c.JSON(200, gin.H{"message": "Member removed"})
}
