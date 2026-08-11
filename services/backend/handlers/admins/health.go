package admins

import (
	"net/http"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type appHealthRow struct {
	AppID            string     `json:"appId"`
	Name             string     `json:"name"`
	Icon             string     `json:"icon"`
	Status           string     `json:"status"`
	OwnerID          string     `json:"ownerId,omitempty"`
	OwnerName        string     `json:"ownerName,omitempty"`
	LinkProbeStatus  string     `json:"linkProbeStatus"`
	SyncStatus       string     `json:"syncStatus"`
	ApprovalRequired bool       `json:"approvalRequired"`
	SyncError        string     `json:"syncError,omitempty"`
	LastSyncedAt     *time.Time `json:"lastSyncedAt,omitempty"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	Health           string     `json:"health"`
	Issues           []string   `json:"issues"`
}

type appHealthResponse struct {
	GeneratedAt        time.Time      `json:"generatedAt"`
	Total              int            `json:"total"`
	Healthy            int            `json:"healthy"`
	Attention          int            `json:"attention"`
	Critical           int            `json:"critical"`
	LinkProbeIssues    int            `json:"linkProbeIssues"`
	SyncIssues         int            `json:"syncIssues"`
	StaleDocumentation int            `json:"staleDocumentation"`
	Unowned            int            `json:"unowned"`
	Apps               []appHealthRow `json:"apps"`
}

func GetHealth(c *gin.Context, db *bun.DB) {
	apps := make([]models.Apps, 0)
	if err := db.NewSelect().Model(&apps).Relation("Owner").OrderExpr("LOWER(a.name) ASC").Scan(c); err != nil {
		httperror.InternalServerError(c, "health: load apps", err)
		return
	}

	links := make([]models.GitLabAppLink, 0)
	if err := db.NewSelect().Model(&links).Scan(c); err != nil {
		httperror.InternalServerError(c, "health: load repository links", err)
		return
	}
	linkByAppID := make(map[string]models.GitLabAppLink, len(links))
	for _, link := range links {
		linkByAppID[link.AppID] = link
	}

	staleBefore := time.Now().UTC().AddDate(0, 0, -90)
	response := appHealthResponse{
		GeneratedAt: time.Now().UTC(),
		Apps:        make([]appHealthRow, 0, len(apps)),
	}

	for _, app := range apps {
		issues := make([]string, 0, 5)
		linkStatus := strings.ToLower(strings.TrimSpace(app.LinkProbeStatus))
		syncStatus := "unlinked"
		approvalRequired := false
		var syncError string
		var lastSyncedAt *time.Time

		if link, ok := linkByAppID[app.ID]; ok {
			syncStatus = strings.ToLower(strings.TrimSpace(link.LastSyncStatus))
			approvalRequired = link.ApprovalRequired
			syncError = strings.TrimSpace(link.LastSyncError)
			if !link.LastSyncedAt.IsZero() {
				value := link.LastSyncedAt
				lastSyncedAt = &value
			}
		}

		if linkStatus == "down" {
			issues = append(issues, "link-probe-down")
		} else if linkStatus == "partial" {
			issues = append(issues, "link-probe-partial")
		}
		if syncStatus == "error" {
			issues = append(issues, "repository-sync-error")
		} else if syncStatus == "pending_approval" || approvalRequired {
			issues = append(issues, "repository-sync-pending")
		}
		if app.OwnerID == uuid.Nil {
			issues = append(issues, "no-owner")
		}
		if app.UpdatedAt.Before(staleBefore) {
			issues = append(issues, "stale-catalog-entry")
		}
		if strings.TrimSpace(app.MarkdownContent) == "" && strings.TrimSpace(app.DocsUrl) == "" {
			issues = append(issues, "missing-documentation")
		}

		health := "healthy"
		for _, issue := range issues {
			if issue == "link-probe-down" || issue == "repository-sync-error" {
				health = "critical"
				break
			}
			if health == "healthy" {
				health = "attention"
			}
		}

		ownerID := ""
		ownerName := ""
		if app.OwnerID != uuid.Nil {
			ownerID = app.OwnerID.String()
		}
		if app.Owner != nil {
			ownerName = strings.TrimSpace(app.Owner.Username)
			if ownerName == "" {
				ownerName = strings.TrimSpace(app.Owner.Email)
			}
		}

		row := appHealthRow{
			AppID:            app.ID,
			Name:             app.Name,
			Icon:             app.Icon,
			Status:           app.Status,
			OwnerID:          ownerID,
			OwnerName:        ownerName,
			LinkProbeStatus:  linkStatus,
			SyncStatus:       syncStatus,
			ApprovalRequired: approvalRequired,
			SyncError:        syncError,
			LastSyncedAt:     lastSyncedAt,
			UpdatedAt:        app.UpdatedAt,
			Health:           health,
			Issues:           issues,
		}
		response.Apps = append(response.Apps, row)
		response.Total++
		switch health {
		case "critical":
			response.Critical++
		case "attention":
			response.Attention++
		default:
			response.Healthy++
		}
		if linkStatus == "down" || linkStatus == "partial" {
			response.LinkProbeIssues++
		}
		if syncStatus == "error" || syncStatus == "pending_approval" || approvalRequired {
			response.SyncIssues++
		}
		if app.UpdatedAt.Before(staleBefore) {
			response.StaleDocumentation++
		}
		if ownerID == "" {
			response.Unowned++
		}
	}

	c.JSON(http.StatusOK, response)
}
