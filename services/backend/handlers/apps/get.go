package apps

import (
	"context"
	"errors"
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

// allowedSortFields maps frontend-safe field names to DB column names.
var allowedSortFields = map[string]string{
	"name":       "name",
	"rating_avg": "rating_avg",
	"updated_at": "updated_at",
	"status":     "status",
	"authority":  "authority",
}

var draftStatusAliases = []string{"draft", "entwurf"}

var statusFilterAliases = map[string][]string{
	"draft":         draftStatusAliases,
	"entwurf":       draftStatusAliases,
	"in erprobung":  {"in erprobung", "incubating", "in inkubation"},
	"incubating":    {"in erprobung", "incubating", "in inkubation"},
	"in inkubation": {"in erprobung", "incubating", "in inkubation"},
	"etabliert":     {"etabliert", "graduated", "produktiv"},
	"graduated":     {"etabliert", "graduated", "produktiv"},
	"produktiv":     {"etabliert", "graduated", "produktiv"},
}

var allowedSyncStatusFilters = map[string]struct{}{
	"linked":           {},
	"unlinked":         {},
	"success":          {},
	"warning":          {},
	"pending_approval": {},
	"error":            {},
	"never":            {},
}

var allowedVisibilityFilters = map[string]struct{}{
	"draft":     {},
	"published": {},
}

type appEditorSummaryRow struct {
	AppID    string    `bun:"app_id"`
	UserID   uuid.UUID `bun:"id"`
	Username string    `bun:"username"`
	Email    string    `bun:"email"`
}

func normalizeFilterValue(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func parseOptionalBoolFilter(param string, value string) (*bool, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}

	switch normalizeFilterValue(value) {
	case "true":
		parsed := true
		return &parsed, nil
	case "false":
		parsed := false
		return &parsed, nil
	default:
		return nil, fmt.Errorf("invalid value for %s", param)
	}
}

func parseOptionalUUIDFilter(param string, value string) (uuid.UUID, bool, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return uuid.Nil, false, nil
	}

	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("invalid value for %s", param)
	}

	if parsed == uuid.Nil {
		return uuid.Nil, false, fmt.Errorf("invalid value for %s", param)
	}

	return parsed, true, nil
}

func applyStatusFilter(query *bun.SelectQuery, rawValue string) *bun.SelectQuery {
	normalized := normalizeFilterValue(rawValue)
	if normalized == "" {
		return query
	}

	aliases, ok := statusFilterAliases[normalized]
	if !ok {
		return query.Where("LOWER(TRIM(COALESCE(a.status, ''))) = ?", normalized)
	}

	return query.Where("LOWER(TRIM(COALESCE(a.status, ''))) IN (?)", bun.In(aliases))
}

func applyVisibilityFilter(query *bun.SelectQuery, rawValue string) (*bun.SelectQuery, error) {
	normalized := normalizeFilterValue(rawValue)
	if normalized == "" {
		return query, nil
	}

	if _, ok := allowedVisibilityFilters[normalized]; !ok {
		return nil, errors.New("invalid value for visibility")
	}

	if normalized == "draft" {
		return query.Where("LOWER(TRIM(COALESCE(a.status, ''))) IN (?)", bun.In(draftStatusAliases)), nil
	}

	return query.Where("LOWER(TRIM(COALESCE(a.status, ''))) NOT IN (?)", bun.In(draftStatusAliases)), nil
}

func applySyncStatusFilter(query *bun.SelectQuery, rawValue string) (*bun.SelectQuery, error) {
	normalized := normalizeFilterValue(rawValue)
	if normalized == "" {
		return query, nil
	}

	if _, ok := allowedSyncStatusFilters[normalized]; !ok {
		return nil, errors.New("invalid value for syncStatus")
	}

	switch normalized {
	case "linked":
		return query.Where("EXISTS (SELECT 1 FROM gitlab_app_links gal WHERE gal.app_id = a.id)"), nil
	case "unlinked":
		return query.Where("NOT EXISTS (SELECT 1 FROM gitlab_app_links gal WHERE gal.app_id = a.id)"), nil
	default:
		return query.Where("EXISTS (SELECT 1 FROM gitlab_app_links gal WHERE gal.app_id = a.id AND gal.last_sync_status = ?)", normalized), nil
	}
}

func loadAppEditorSummaries(ctx context.Context, db *bun.DB, appIDs []string) (map[string][]models.AppUserSummary, error) {
	if len(appIDs) == 0 {
		return map[string][]models.AppUserSummary{}, nil
	}

	var rows []appEditorSummaryRow
	err := db.NewSelect().
		TableExpr("app_editors AS ae").
		ColumnExpr("ae.app_id").
		ColumnExpr("u.id").
		ColumnExpr("u.username").
		ColumnExpr("u.email").
		Join("JOIN users AS u ON u.id = ae.user_id").
		Where("ae.app_id IN (?)", bun.In(appIDs)).
		OrderExpr("ae.app_id ASC").
		OrderExpr("LOWER(u.username) ASC").
		OrderExpr("LOWER(u.email) ASC").
		Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}

	editorsByAppID := make(map[string][]models.AppUserSummary, len(appIDs))
	for _, row := range rows {
		editorsByAppID[row.AppID] = append(editorsByAppID[row.AppID], models.AppUserSummary{
			ID:       row.UserID,
			Username: row.Username,
			Email:    row.Email,
		})
	}

	return editorsByAppID, nil
}

func GetApps(c *gin.Context, db *bun.DB) {
	if !ensureAppStoreAccess(c, db) {
		return
	}

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
	ownerIDFilter, hasOwnerIDFilter, err := parseOptionalUUIDFilter("ownerId", c.Query("ownerId"))
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}
	hasEditorsFilter, err := parseOptionalBoolFilter("hasEditors", c.Query("hasEditors"))
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}
	featuredFilter, err := parseOptionalBoolFilter("featured", c.Query("featured"))
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}
	lockedFilter, err := parseOptionalBoolFilter("locked", c.Query("locked"))
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}
	syncStatusFilter := c.Query("syncStatus")
	visibilityFilter := c.Query("visibility")

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
		query = applyStatusFilter(query, statusFilter)
	}

	if groupID != "" {
		query = query.
			Join("JOIN app_group_members agm ON agm.app_id = a.id").
			Where("agm.app_group_id::text = ?", groupID)
	}

	if hasOwnerIDFilter {
		query = query.Where("a.owner_id = ?", ownerIDFilter)
	}

	if hasEditorsFilter != nil {
		if *hasEditorsFilter {
			query = query.Where("EXISTS (SELECT 1 FROM app_editors ae WHERE ae.app_id = a.id)")
		} else {
			query = query.Where("NOT EXISTS (SELECT 1 FROM app_editors ae WHERE ae.app_id = a.id)")
		}
	}

	if featuredFilter != nil {
		query = query.Where("a.is_featured = ?", *featuredFilter)
	}

	if lockedFilter != nil {
		query = query.Where("a.is_locked = ?", *lockedFilter)
	}

	query, err = applySyncStatusFilter(query, syncStatusFilter)
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}

	query, err = applyVisibilityFilter(query, visibilityFilter)
	if err != nil {
		httperror.StatusBadRequest(c, err.Error(), err)
		return
	}

	if c.Query("owner") == "me" && hasViewer {
		query = query.Where("a.owner_id = ?", viewerID)
	}
	if c.Query("editable") == "me" && hasViewer {
		query = query.Where("a.owner_id = ? OR EXISTS (SELECT 1 FROM app_editors ae WHERE ae.app_id = a.id AND ae.user_id = ?)", viewerID, viewerID)
	}

	err = query.Scan(c)
	if err != nil {
		httperror.InternalServerError(c, "Error fetching apps", err)
		return
	}

	editorAppIDs := map[string]struct{}{}
	if hasViewer {
		var editorErr error
		editorAppIDs, editorErr = loadEditorAppIDs(c.Request.Context(), db, viewerID)
		if editorErr != nil {
			httperror.InternalServerError(c, "Error loading app editor permissions", editorErr)
			return
		}
	}

	visibleApps := make([]models.Apps, 0, len(apps))
	for _, app := range apps {
		normalizeAppModelStatus(&app)
		normalizeAppDetailFields(&app)
		if canViewApp(app, viewerID, viewerRole, hasViewer, editorAppIDs) {
			applyViewerPermissions(&app, viewerID, viewerRole, hasViewer, editorAppIDs)
			visibleApps = append(visibleApps, app)
		}
	}
	apps = visibleApps
	appIDs := make([]string, 0, len(apps))
	for _, app := range apps {
		appIDs = append(appIDs, app.ID)
	}

	editorsByAppID, err := loadAppEditorSummaries(c.Request.Context(), db, appIDs)
	if err != nil {
		httperror.InternalServerError(c, "Error loading app editors", err)
		return
	}
	for i := range apps {
		apps[i].Editors = editorsByAppID[apps[i].ID]
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
		Icon    string `bun:"icon"`
	}
	var groupRows []appGroupRow
	_ = db.NewRaw(`
		SELECT m.app_id, g.id::text AS group_id, g.name, g.icon
		FROM app_group_members m
		JOIN app_groups g ON g.id = m.app_group_id
	`).Scan(c, &groupRows)

	appGroupsMap := make(map[string][]models.AppGroupSummary)
	for _, row := range groupRows {
		appGroupsMap[row.AppID] = append(appGroupsMap[row.AppID], models.AppGroupSummary{
			ID:   row.GroupID,
			Name: row.Name,
			Icon: row.Icon,
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
					ProviderType:     link.ProviderType,
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
	if !ensureAppStoreAccess(c, db) {
		return
	}

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
	editorAppIDs := map[string]struct{}{}
	if hasViewer {
		var editorErr error
		editorAppIDs, editorErr = loadEditorAppIDs(c.Request.Context(), db, viewerID)
		if editorErr != nil {
			httperror.InternalServerError(c, "Error loading app editor permissions", editorErr)
			return
		}
	}
	if !canViewApp(app, viewerID, viewerRole, hasViewer, editorAppIDs) {
		httperror.StatusNotFound(c, "App not found", nil)
		return
	}
	applyViewerPermissions(&app, viewerID, viewerRole, hasViewer, editorAppIDs)

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
		if !canViewApp(relatedApp, viewerID, viewerRole, hasViewer, editorAppIDs) {
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
		Icon string `bun:"icon"`
	}
	var groups []groupRow
	_ = db.NewRaw(`
		SELECT g.id::text, g.name, g.icon
		FROM app_groups g
		JOIN app_group_members m ON m.app_group_id = g.id
		WHERE m.app_id = ?
	`, id).Scan(c, &groups)

	app.AppGroups = make([]models.AppGroupSummary, 0, len(groups))
	for _, g := range groups {
		app.AppGroups = append(app.AppGroups, models.AppGroupSummary{
			ID:   g.ID,
			Name: g.Name,
			Icon: g.Icon,
		})
	}

	c.JSON(200, app)
}
