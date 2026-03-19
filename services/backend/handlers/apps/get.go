package apps

import (
	"fmt"

	"just-apps-backend/functions/httperror"
	"just-apps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// allowedSortFields maps frontend-safe field names to DB column names.
var allowedSortFields = map[string]string{
	"name":       "name",
	"rating_avg": "rating_avg",
	"updated_at": "updated_at",
	"status":     "status",
	"authority":  "authority",
}

func GetApps(c *gin.Context, db *bun.DB) {
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
	err := db.NewSelect().
		Model(&apps).
		Relation("Owner").
		Order("is_featured DESC", fmt.Sprintf("%s %s", sortField, sortDir)).
		Scan(c)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching apps", err)
		return
	}

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

	c.JSON(200, apps)
}

func GetApp(c *gin.Context, db *bun.DB) {
	id := c.Param("id")
	var app models.Apps
	err := db.NewSelect().Model(&app).Where("a.id = ?", id).Relation("Owner").Scan(c)
	if err != nil {
		httperror.StatusNotFound(c, "App not found", err)
		return
	}

	// Load related apps (bidirectional)
	type relRow struct {
		RelatedAppID string `bun:"related_app_id"`
		Name         string `bun:"name"`
		Icon         string `bun:"icon"`
	}
	var related []relRow
	_ = db.NewRaw(`
		SELECT r.related_app_id, a.name, a.icon
		FROM app_relations r
		JOIN apps a ON a.id = r.related_app_id
		WHERE r.app_id = ?
		UNION
		SELECT r.app_id AS related_app_id, a.name, a.icon
		FROM app_relations r
		JOIN apps a ON a.id = r.app_id
		WHERE r.related_app_id = ?
	`, id, id).Scan(c, &related)

	app.RelatedApps = make([]models.AppRelationSummary, 0, len(related))
	for _, r := range related {
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
