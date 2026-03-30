package apps

import (
	"fmt"
	"strings"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func getViewerContext(c *gin.Context) (uuid.UUID, string, bool) {
	role := c.GetString("role")
	userIDVal, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, role, false
	}

	switch value := userIDVal.(type) {
	case uuid.UUID:
		return value, role, true
	case string:
		parsed, err := uuid.Parse(value)
		if err == nil {
			return parsed, role, true
		}
	}

	return uuid.Nil, role, false
}

func canViewApp(app models.Apps, viewerID uuid.UUID, viewerRole string, hasViewer bool) bool {
	if !isDraftApp(app) {
		return true
	}

	if viewerRole == "admin" {
		return true
	}

	return hasViewer && app.OwnerID == viewerID
}

// allowedSortFields maps frontend-safe field names to DB column names.
var allowedSortFields = map[string]string{
	"name":       "name",
	"rating_avg": "rating_avg",
	"updated_at": "updated_at",
	"status":     "status",
	"authority":  "authority",
}

func GetApps(c *gin.Context, db *bun.DB) {
	viewerID, viewerRole, hasViewer := getViewerContext(c)

	// Load platform settings to determine sort order and pinned apps
	var settings models.PlatformSettings
	_ = db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c)

	sortField := "name"
	if f, ok := allowedSortFields[settings.AppSortField]; ok {
		sortField = f
	}
	sortDir := "ASC"
	if settings.AppSortDirection == "desc" {
		sortDir = "DESC"
	}

	apps := make([]models.Apps, 0)
	q := c.Query("q")
	category := c.Query("category")
	techStack := c.Query("techStack")
	statusFilter := c.Query("status")
	groupID := c.Query("group")

	query := db.NewSelect().
		Model(&apps).
		Relation("Owner").
		Order("is_featured DESC", fmt.Sprintf("%s %s", sortField, sortDir))

	if q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		query = query.Where(
			"LOWER(a.name) LIKE ? OR LOWER(a.description) LIKE ? OR LOWER(a.authority) LIKE ?",
			pattern, pattern, pattern,
		)
	}

	if category != "" {
		query = query.Where("? = ANY(a.categories)", category)
	}

	if techStack != "" {
		query = query.Where("? = ANY(a.tech_stack)", techStack)
	}

	if statusFilter != "" {
		query = query.Where("a.status = ?", statusFilter)
	}

	if groupID != "" {
		query = query.
			Join("JOIN app_group_members agm ON agm.app_id = a.id").
			Where("agm.app_group_id::text = ?", groupID)
	}

	err := query.Scan(c)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching apps", err)
		return
	}

	visibleApps := make([]models.Apps, 0, len(apps))
	for _, app := range apps {
		normalizeAppModelStatus(&app)
		normalizeAppDetailFields(&app)
		if canViewApp(app, viewerID, viewerRole, hasViewer) {
			visibleApps = append(visibleApps, app)
		}
	}
	apps = visibleApps

	// Move pinned apps to the front (in configured order), then featured, then rest
	if len(settings.PinnedApps) > 0 {
		pinnedIdx := make(map[string]int, len(settings.PinnedApps))
		for i, id := range settings.PinnedApps {
			pinnedIdx[id] = i
		}

		pinned := make([]models.Apps, len(settings.PinnedApps))
		rest := make([]models.Apps, 0, len(apps))

		for _, app := range apps {
			if idx, ok := pinnedIdx[app.ID]; ok {
				pinned[idx] = app
			} else {
				rest = append(rest, app)
			}
		}

		// Filter out zero-value slots (in case a pinned ID no longer exists)
		finalPinned := pinned[:0]
		for _, a := range pinned {
			if a.ID != "" {
				finalPinned = append(finalPinned, a)
			}
		}
		apps = append(finalPinned, rest...)
	}

	// Load group memberships for all apps in bulk (one extra query)
	type appGroupRow struct {
		AppID   string `bun:"app_id"`
		GroupID string `bun:"group_id"`
		Name    string `bun:"name"`
	}
	var groupRows []appGroupRow
	_ = db.NewRaw(`
		SELECT m.app_id, g.id::text AS group_id, g.name
		FROM app_group_members m
		JOIN app_groups g ON g.id = m.app_group_id
	`).Scan(c, &groupRows)

	appGroupsMap := make(map[string][]models.AppGroupSummary)
	for _, row := range groupRows {
		appGroupsMap[row.AppID] = append(appGroupsMap[row.AppID], models.AppGroupSummary{
			ID:   row.GroupID,
			Name: row.Name,
		})
	}
	for i := range apps {
		if gs, ok := appGroupsMap[apps[i].ID]; ok {
			apps[i].AppGroups = gs
		} else {
			apps[i].AppGroups = make([]models.AppGroupSummary, 0)
		}
	}

	if viewerRole == "admin" && len(apps) > 0 {
		appIDs := make([]string, 0, len(apps))
		for _, app := range apps {
			appIDs = append(appIDs, app.ID)
		}

		var links []models.GitLabAppLink
		if err := db.NewSelect().Model(&links).Where("app_id IN (?)", bun.In(appIDs)).Scan(c); err == nil {
			linkByAppID := make(map[string]models.GitLabAppLink, len(links))
			for _, link := range links {
				linkByAppID[link.AppID] = link
			}

			for i := range apps {
				link, ok := linkByAppID[apps[i].ID]
				if !ok {
					continue
				}

				summary := &models.GitLabSyncSummary{
					Linked:           true,
					ProviderKey:      link.ProviderKey,
					ProjectPath:      link.ProjectPath,
					LastSyncStatus:   link.LastSyncStatus,
					LastSyncError:    link.LastSyncError,
					ApprovalRequired: link.ApprovalRequired,
				}
				if !link.LastSyncedAt.IsZero() {
					summary.LastSyncedAt = &link.LastSyncedAt
				}
				apps[i].GitLabSync = summary
			}
		}
	}

	c.JSON(200, apps)
}

func GetApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	var app models.Apps
	err := db.NewSelect().Model(&app).Where("a.id = ?", id).Relation("Owner").Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return
	}
	normalizeAppModelStatus(&app)
	normalizeAppDetailFields(&app)
	if !canViewApp(app, viewerID, viewerRole, hasViewer) {
		httperror.StatusNotFound(c, "App not found", nil)
		return
	}

	// Load related apps (bidirectional)
	type relRow struct {
		RelatedAppID string    `bun:"related_app_id"`
		Name         string    `bun:"name"`
		Icon         string    `bun:"icon"`
		OwnerID      uuid.UUID `bun:"owner_id"`
		Status       string    `bun:"status"`
	}
	var related []relRow
	_ = db.NewRaw(`
		SELECT r.related_app_id, a.name, a.icon, a.owner_id, a.status
		FROM app_relations r
		JOIN apps a ON a.id = r.related_app_id
		WHERE r.app_id = ?
		UNION
		SELECT r.app_id AS related_app_id, a.name, a.icon, a.owner_id, a.status
		FROM app_relations r
		JOIN apps a ON a.id = r.app_id
		WHERE r.related_app_id = ?
	`, id, id).Scan(c, &related)

	app.RelatedApps = make([]models.AppRelationSummary, 0, len(related))
	for _, r := range related {
		relatedApp := models.Apps{ID: r.RelatedAppID, Name: r.Name, Icon: r.Icon, OwnerID: r.OwnerID, Status: NormalizeAppStatus(r.Status)}
		if !canViewApp(relatedApp, viewerID, viewerRole, hasViewer) {
			continue
		}
		app.RelatedApps = append(app.RelatedApps, models.AppRelationSummary{
			ID:   r.RelatedAppID,
			Name: r.Name,
			Icon: r.Icon,
		})
	}

	// Load groups this app belongs to
	type groupRow struct {
		ID   string `bun:"id"`
		Name string `bun:"name"`
	}
	var groups []groupRow
	_ = db.NewRaw(`
		SELECT g.id::text, g.name
		FROM app_groups g
		JOIN app_group_members m ON m.app_group_id = g.id
		WHERE m.app_id = ?
	`, id).Scan(c, &groups)

	app.AppGroups = make([]models.AppGroupSummary, 0, len(groups))
	for _, g := range groups {
		app.AppGroups = append(app.AppGroups, models.AppGroupSummary{
			ID:   g.ID,
			Name: g.Name,
		})
	}

	c.JSON(200, app)
}
