package metrics

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/uptrace/bun"
)

var trackedOperations = []string{
	"app.create",
	"app.update",
	"app.delete",
	"app.gitlab.link",
	"app.gitlab.sync",
	"app.gitlab.approve",
	"app.gitlab.unlink",
	"app.rating.create",
	"app.rating.update",
	"app.rating.delete",
	"app.favorite.add",
	"app.favorite.remove",
	"ai.conversation.create",
	"ai.chat.authenticated.success",
	"ai.chat.authenticated.error",
	"ai.chat.public.success",
	"ai.chat.public.error",
	"auth.login.local.success",
}

type collector struct {
	db *bun.DB

	appsCountDesc              *prometheus.Desc
	appsByStatusCountDesc      *prometheus.Desc
	appsByProbeStatusCountDesc *prometheus.Desc
	featuredAppsCountDesc      *prometheus.Desc
	reuseAppsCountDesc         *prometheus.Desc
	usersCountDesc             *prometheus.Desc
	usersByRoleCountDesc       *prometheus.Desc
	usersRecentLoginCountDesc  *prometheus.Desc
	ratingsCountDesc           *prometheus.Desc
	favoritesCountDesc         *prometheus.Desc
	aiConversationsCountDesc   *prometheus.Desc
	aiMessagesCountDesc        *prometheus.Desc
	aiPromptTokensStoredDesc   *prometheus.Desc
	aiResponseTokensStoredDesc *prometheus.Desc
	functionalEventsTotalDesc  *prometheus.Desc
	appInfoDesc                *prometheus.Desc
	appRatingAverageDesc       *prometheus.Desc
	appRatingCountDesc         *prometheus.Desc
	appFavoriteCountDesc       *prometheus.Desc
}

type appRow struct {
	ID              string  `bun:"id"`
	Status          string  `bun:"status"`
	IsFeatured      bool    `bun:"is_featured"`
	IsReuse         bool    `bun:"is_reuse"`
	LinkProbeStatus string  `bun:"link_probe_status"`
	RatingAvg       float64 `bun:"rating_avg"`
	RatingCount     int64   `bun:"rating_count"`
	FavoriteCount   int64   `bun:"favorite_count"`
}

type userRoleRow struct {
	Role     string `bun:"role"`
	Disabled bool   `bun:"disabled"`
	Count    int64  `bun:"count"`
}

type recentLoginRow struct {
	Last7d  int64 `bun:"last_7d"`
	Last30d int64 `bun:"last_30d"`
}

type aiTotalsRow struct {
	ConversationsCount   int64 `bun:"conversations_count"`
	MessagesCount        int64 `bun:"messages_count"`
	PromptTokensStored   int64 `bun:"prompt_tokens_stored"`
	ResponseTokensStored int64 `bun:"response_tokens_stored"`
}

type auditCountRow struct {
	Operation string `bun:"operation"`
	Count     int64  `bun:"count"`
}

func Handler(db *bun.DB) http.Handler {
	registry := prometheus.NewRegistry()
	registry.MustRegister(newCollector(db))

	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
		ErrorHandling:     promhttp.ContinueOnError,
	})
}

func newCollector(db *bun.DB) *collector {
	return &collector{
		db: db,
		appsCountDesc: prometheus.NewDesc(
			"justapps_apps_count",
			"Current number of catalog applications.",
			nil,
			nil,
		),
		appsByStatusCountDesc: prometheus.NewDesc(
			"justapps_apps_by_status_count",
			"Current number of catalog applications by status.",
			[]string{"status"},
			nil,
		),
		appsByProbeStatusCountDesc: prometheus.NewDesc(
			"justapps_apps_by_link_probe_status_count",
			"Current number of catalog applications by link probe status.",
			[]string{"link_probe_status"},
			nil,
		),
		featuredAppsCountDesc: prometheus.NewDesc(
			"justapps_featured_apps_count",
			"Current number of featured applications.",
			nil,
			nil,
		),
		reuseAppsCountDesc: prometheus.NewDesc(
			"justapps_reuse_apps_count",
			"Current number of reuse-oriented applications.",
			nil,
			nil,
		),
		usersCountDesc: prometheus.NewDesc(
			"justapps_users_count",
			"Current number of users.",
			nil,
			nil,
		),
		usersByRoleCountDesc: prometheus.NewDesc(
			"justapps_users_by_role_count",
			"Current number of users by role and disabled state.",
			[]string{"role", "disabled"},
			nil,
		),
		usersRecentLoginCountDesc: prometheus.NewDesc(
			"justapps_users_recent_login_count",
			"Current number of users who logged in within the given time window.",
			[]string{"window"},
			nil,
		),
		ratingsCountDesc: prometheus.NewDesc(
			"justapps_ratings_count",
			"Current number of ratings stored for all applications.",
			nil,
			nil,
		),
		favoritesCountDesc: prometheus.NewDesc(
			"justapps_favorites_count",
			"Current number of stored favorites across all applications.",
			nil,
			nil,
		),
		aiConversationsCountDesc: prometheus.NewDesc(
			"justapps_ai_conversations_count",
			"Current number of persisted AI conversations.",
			nil,
			nil,
		),
		aiMessagesCountDesc: prometheus.NewDesc(
			"justapps_ai_messages_count",
			"Current number of persisted AI messages.",
			nil,
			nil,
		),
		aiPromptTokensStoredDesc: prometheus.NewDesc(
			"justapps_ai_prompt_tokens_stored",
			"Current number of stored prompt tokens across persisted AI messages.",
			nil,
			nil,
		),
		aiResponseTokensStoredDesc: prometheus.NewDesc(
			"justapps_ai_response_tokens_stored",
			"Current number of stored response tokens across persisted AI messages.",
			nil,
			nil,
		),
		functionalEventsTotalDesc: prometheus.NewDesc(
			"justapps_functional_events_total",
			"Cumulative number of selected functional events recorded in the audit log.",
			[]string{"operation"},
			nil,
		),
		appInfoDesc: prometheus.NewDesc(
			"justapps_app_info",
			"Static and low-cardinality metadata for each catalog application.",
			[]string{"app_id", "status", "is_featured", "is_reuse", "link_probe_status"},
			nil,
		),
		appRatingAverageDesc: prometheus.NewDesc(
			"justapps_app_rating_average",
			"Current average rating for a catalog application.",
			[]string{"app_id"},
			nil,
		),
		appRatingCountDesc: prometheus.NewDesc(
			"justapps_app_rating_count",
			"Current number of ratings for a catalog application.",
			[]string{"app_id"},
			nil,
		),
		appFavoriteCountDesc: prometheus.NewDesc(
			"justapps_app_favorite_count",
			"Current number of favorites for a catalog application.",
			[]string{"app_id"},
			nil,
		),
	}
}

func (c *collector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.appsCountDesc
	ch <- c.appsByStatusCountDesc
	ch <- c.appsByProbeStatusCountDesc
	ch <- c.featuredAppsCountDesc
	ch <- c.reuseAppsCountDesc
	ch <- c.usersCountDesc
	ch <- c.usersByRoleCountDesc
	ch <- c.usersRecentLoginCountDesc
	ch <- c.ratingsCountDesc
	ch <- c.favoritesCountDesc
	ch <- c.aiConversationsCountDesc
	ch <- c.aiMessagesCountDesc
	ch <- c.aiPromptTokensStoredDesc
	ch <- c.aiResponseTokensStoredDesc
	ch <- c.functionalEventsTotalDesc
	ch <- c.appInfoDesc
	ch <- c.appRatingAverageDesc
	ch <- c.appRatingCountDesc
	ch <- c.appFavoriteCountDesc
}

func (c *collector) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	appRows, err := c.loadApps(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.appsCountDesc, err)
		return
	}

	statusCounts := make(map[string]int64)
	probeCounts := make(map[string]int64)
	var featuredApps int64
	var reuseApps int64
	var favoritesTotal int64

	for _, row := range appRows {
		status := normalizeLabel(row.Status)
		probeStatus := normalizeLabel(row.LinkProbeStatus)
		featured := boolLabel(row.IsFeatured)
		reuse := boolLabel(row.IsReuse)

		statusCounts[status]++
		probeCounts[probeStatus]++
		favoritesTotal += row.FavoriteCount
		if row.IsFeatured {
			featuredApps++
		}
		if row.IsReuse {
			reuseApps++
		}

		ch <- prometheus.MustNewConstMetric(c.appInfoDesc, prometheus.GaugeValue, 1,
			row.ID,
			status,
			featured,
			reuse,
			probeStatus,
		)
		ch <- prometheus.MustNewConstMetric(c.appRatingAverageDesc, prometheus.GaugeValue, row.RatingAvg, row.ID)
		ch <- prometheus.MustNewConstMetric(c.appRatingCountDesc, prometheus.GaugeValue, float64(row.RatingCount), row.ID)
		ch <- prometheus.MustNewConstMetric(c.appFavoriteCountDesc, prometheus.GaugeValue, float64(row.FavoriteCount), row.ID)
	}

	ch <- prometheus.MustNewConstMetric(c.appsCountDesc, prometheus.GaugeValue, float64(len(appRows)))
	ch <- prometheus.MustNewConstMetric(c.featuredAppsCountDesc, prometheus.GaugeValue, float64(featuredApps))
	ch <- prometheus.MustNewConstMetric(c.reuseAppsCountDesc, prometheus.GaugeValue, float64(reuseApps))
	ch <- prometheus.MustNewConstMetric(c.favoritesCountDesc, prometheus.GaugeValue, float64(favoritesTotal))
	for status, count := range statusCounts {
		ch <- prometheus.MustNewConstMetric(c.appsByStatusCountDesc, prometheus.GaugeValue, float64(count), status)
	}
	for probeStatus, count := range probeCounts {
		ch <- prometheus.MustNewConstMetric(c.appsByProbeStatusCountDesc, prometheus.GaugeValue, float64(count), probeStatus)
	}

	userRows, err := c.loadUsersByRole(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.usersByRoleCountDesc, err)
		return
	}

	var usersTotal int64
	for _, row := range userRows {
		usersTotal += row.Count
		ch <- prometheus.MustNewConstMetric(c.usersByRoleCountDesc, prometheus.GaugeValue, float64(row.Count), normalizeLabel(row.Role), boolLabel(row.Disabled))
	}
	ch <- prometheus.MustNewConstMetric(c.usersCountDesc, prometheus.GaugeValue, float64(usersTotal))

	recentLogins, err := c.loadRecentLoginCounts(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.usersRecentLoginCountDesc, err)
		return
	}
	ch <- prometheus.MustNewConstMetric(c.usersRecentLoginCountDesc, prometheus.GaugeValue, float64(recentLogins.Last7d), "7d")
	ch <- prometheus.MustNewConstMetric(c.usersRecentLoginCountDesc, prometheus.GaugeValue, float64(recentLogins.Last30d), "30d")

	ratingsCount, err := c.countRows(ctx, "ratings")
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.ratingsCountDesc, err)
		return
	}
	ch <- prometheus.MustNewConstMetric(c.ratingsCountDesc, prometheus.GaugeValue, float64(ratingsCount))

	aiTotals, err := c.loadAITotals(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.aiConversationsCountDesc, err)
		return
	}
	ch <- prometheus.MustNewConstMetric(c.aiConversationsCountDesc, prometheus.GaugeValue, float64(aiTotals.ConversationsCount))
	ch <- prometheus.MustNewConstMetric(c.aiMessagesCountDesc, prometheus.GaugeValue, float64(aiTotals.MessagesCount))
	ch <- prometheus.MustNewConstMetric(c.aiPromptTokensStoredDesc, prometheus.GaugeValue, float64(aiTotals.PromptTokensStored))
	ch <- prometheus.MustNewConstMetric(c.aiResponseTokensStoredDesc, prometheus.GaugeValue, float64(aiTotals.ResponseTokensStored))

	auditCounts, err := c.loadAuditCounts(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.functionalEventsTotalDesc, err)
		return
	}
	for _, operation := range trackedOperations {
		ch <- prometheus.MustNewConstMetric(c.functionalEventsTotalDesc, prometheus.CounterValue, float64(auditCounts[operation]), operation)
	}
}

func (c *collector) loadApps(ctx context.Context) ([]appRow, error) {
	rows := make([]appRow, 0)
	err := c.db.NewRaw(`
		SELECT a.id,
		       COALESCE(NULLIF(TRIM(a.status), ''), 'unknown') AS status,
		       a.is_featured,
		       a.is_reuse,
		       COALESCE(NULLIF(TRIM(a.link_probe_status), ''), 'unknown') AS link_probe_status,
		       a.rating_avg,
		       a.rating_count,
		       COALESCE(f.favorite_count, 0) AS favorite_count
		FROM apps AS a
		LEFT JOIN (
			SELECT app_id, COUNT(*)::bigint AS favorite_count
			FROM user_favorites
			GROUP BY app_id
		) AS f ON f.app_id = a.id
		ORDER BY a.id ASC
	`).Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("metrics: load apps: %w", err)
	}
	return rows, nil
}

func (c *collector) loadUsersByRole(ctx context.Context) ([]userRoleRow, error) {
	rows := make([]userRoleRow, 0)
	err := c.db.NewRaw(`
		SELECT COALESCE(NULLIF(TRIM(role), ''), 'unknown') AS role,
		       disabled,
		       COUNT(*)::bigint AS count
		FROM users
		GROUP BY 1, 2
		ORDER BY 1, 2
	`).Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("metrics: load users by role: %w", err)
	}
	return rows, nil
}

func (c *collector) loadRecentLoginCounts(ctx context.Context) (recentLoginRow, error) {
	row := recentLoginRow{}
	err := c.db.NewRaw(`
		SELECT COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::bigint AS last_7d,
		       COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '30 days')::bigint AS last_30d
		FROM users
	`).Scan(ctx, &row)
	if err != nil {
		return recentLoginRow{}, fmt.Errorf("metrics: load recent logins: %w", err)
	}
	return row, nil
}

func (c *collector) loadAITotals(ctx context.Context) (aiTotalsRow, error) {
	row := aiTotalsRow{}
	err := c.db.NewRaw(`
		SELECT
			(SELECT COUNT(*)::bigint FROM ai_conversations) AS conversations_count,
			(SELECT COUNT(*)::bigint FROM ai_messages) AS messages_count,
			COALESCE((SELECT SUM(prompt_tokens)::bigint FROM ai_messages), 0) AS prompt_tokens_stored,
			COALESCE((SELECT SUM(response_tokens)::bigint FROM ai_messages), 0) AS response_tokens_stored
	`).Scan(ctx, &row)
	if err != nil {
		return aiTotalsRow{}, fmt.Errorf("metrics: load ai totals: %w", err)
	}
	return row, nil
}

func (c *collector) loadAuditCounts(ctx context.Context) (map[string]int64, error) {
	rows := make([]auditCountRow, 0)
	err := c.db.NewSelect().
		TableExpr("audit").
		Column("operation").
		ColumnExpr("COUNT(*)::bigint AS count").
		Where("operation IN (?)", bun.In(trackedOperations)).
		Group("operation").
		Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("metrics: load audit counts: %w", err)
	}

	counts := make(map[string]int64, len(trackedOperations))
	for _, row := range rows {
		counts[row.Operation] = row.Count
	}
	return counts, nil
}

func (c *collector) countRows(ctx context.Context, table string) (int, error) {
	count, err := c.db.NewSelect().TableExpr(table).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("metrics: count %s: %w", table, err)
	}
	return count, nil
}

func normalizeLabel(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return "unknown"
	}
	return normalized
}

func boolLabel(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
