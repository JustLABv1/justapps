package admins

import (
	"net/http"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type LinkProbeEndpointIssue struct {
	URL        string    `json:"url"`
	StatusCode int       `json:"statusCode"`
	Reachable  bool      `json:"reachable"`
	ProbedAt   time.Time `json:"probedAt"`
}

type LinkProbeIssue struct {
	AppID           string                   `json:"appId"`
	Name            string                   `json:"name"`
	Icon            string                   `json:"icon"`
	LinkProbeStatus string                   `json:"linkProbeStatus"`
	Endpoints []LinkProbeEndpointIssue `json:"endpoints"`
}

func GetStats(c *gin.Context, db *bun.DB) {
	oneWeekAgo := time.Now().AddDate(0, 0, -7)

	totalApps, err := db.NewSelect().TableExpr("apps").Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: count apps", err)
		return
	}

	draftApps, err := db.NewSelect().TableExpr("apps").Where("LOWER(status) = 'entwurf'").Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: count drafts", err)
		return
	}

	totalUsers, err := db.NewSelect().Model((*models.Users)(nil)).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: count users", err)
		return
	}

	newUsersThisWeek, err := db.NewSelect().Model((*models.Users)(nil)).
		Where("created_at >= ?", oneWeekAgo).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: new users", err)
		return
	}

	newAppsThisWeek, err := db.NewSelect().TableExpr("apps").
		Where("updated_at >= ?", oneWeekAgo).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "stats: new apps", err)
		return
	}

	recentActivity := make([]models.AuditWithUser, 0)
	_ = db.NewSelect().
		TableExpr("audit AS a").
		ColumnExpr("a.id, a.user_id, a.operation, a.details, a.created_at, u.username, u.email, u.role").
		Join("LEFT JOIN users AS u ON u.id::text = a.user_id").
		OrderExpr("a.created_at DESC").
		Limit(10).
		Scan(c, &recentActivity)

	var settings models.PlatformSettings
	linkProbingEnabled := false
	if err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c); err == nil {
		linkProbingEnabled = settings.EnableLinkProbing
	}

	appsWithProbeIssues := 0
	downApps := 0
	partialApps := 0
	linkProbeIssues := make([]LinkProbeIssue, 0)

	if linkProbingEnabled {
		appsWithProbeIssues, err = db.NewSelect().
			TableExpr("apps").
			Where("skip_link_probe = false").
			Where("link_probe_status IN ('partial', 'down')").
			Count(c)
		if err != nil {
			httperror.InternalServerError(c, "stats: count probe issues", err)
			return
		}

		downApps, err = db.NewSelect().
			TableExpr("apps").
			Where("skip_link_probe = false").
			Where("link_probe_status = 'down'").
			Count(c)
		if err != nil {
			httperror.InternalServerError(c, "stats: count down apps", err)
			return
		}

		partialApps, err = db.NewSelect().
			TableExpr("apps").
			Where("skip_link_probe = false").
			Where("link_probe_status = 'partial'").
			Count(c)
		if err != nil {
			httperror.InternalServerError(c, "stats: count partial apps", err)
			return
		}

		type linkProbeIssueRow struct {
			AppID           string    `bun:"app_id"`
			Name            string    `bun:"name"`
			Icon            string    `bun:"icon"`
			LinkProbeStatus string    `bun:"link_probe_status"`
			URL             string    `bun:"url"`
			StatusCode      int       `bun:"status_code"`
			Reachable       bool      `bun:"reachable"`
			ProbedAt        time.Time `bun:"probed_at"`
		}

		rows := make([]linkProbeIssueRow, 0)
		_ = db.NewRaw(`
			SELECT a.id AS app_id, a.name, a.icon, a.link_probe_status, lpr.url, lpr.status_code, lpr.reachable, lpr.probed_at
			FROM apps a
			JOIN link_probe_results lpr ON lpr.app_id = a.id
			WHERE a.skip_link_probe = false
			  AND a.link_probe_status IN ('partial', 'down')
			ORDER BY CASE a.link_probe_status WHEN 'down' THEN 0 ELSE 1 END, a.name ASC, lpr.reachable ASC, lpr.probed_at DESC, lpr.url ASC
		`).Scan(c, &rows)

		issueIndex := make(map[string]int)
		for _, row := range rows {
			idx, ok := issueIndex[row.AppID]
			if !ok {
				if len(linkProbeIssues) >= 8 {
					continue
				}
				linkProbeIssues = append(linkProbeIssues, LinkProbeIssue{
					AppID:           row.AppID,
					Name:            row.Name,
					Icon:            row.Icon,
					LinkProbeStatus: row.LinkProbeStatus,
					Endpoints:       make([]LinkProbeEndpointIssue, 0),
				})
				idx = len(linkProbeIssues) - 1
				issueIndex[row.AppID] = idx
			}

			linkProbeIssues[idx].Endpoints = append(linkProbeIssues[idx].Endpoints, LinkProbeEndpointIssue{
				URL:        row.URL,
				StatusCode: row.StatusCode,
				Reachable:  row.Reachable,
				ProbedAt:   row.ProbedAt,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"totalApps":           totalApps,
		"draftApps":           draftApps,
		"totalUsers":          totalUsers,
		"newUsersThisWeek":    newUsersThisWeek,
		"newAppsThisWeek":     newAppsThisWeek,
		"recentActivity":      recentActivity,
		"linkProbingEnabled":  linkProbingEnabled,
		"appsWithProbeIssues": appsWithProbeIssues,
		"downApps":            downApps,
		"partialApps":         partialApps,
		"linkProbeIssues":     linkProbeIssues,
	})
}
