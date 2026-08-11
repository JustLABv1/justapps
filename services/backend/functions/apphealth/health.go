package apphealth

import (
	"context"
	"strings"
	"time"

	"justapps-backend/pkg/models"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Scope struct {
	// EditableBy limits the response to apps owned by or assigned to this user.
	// A nil value returns the complete catalog for administrators.
	EditableBy *uuid.UUID
}

type AppHealthRow struct {
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

type Response struct {
	GeneratedAt        time.Time      `json:"generatedAt"`
	Total              int            `json:"total"`
	Healthy            int            `json:"healthy"`
	Attention          int            `json:"attention"`
	Critical           int            `json:"critical"`
	LinkProbeIssues    int            `json:"linkProbeIssues"`
	SyncIssues         int            `json:"syncIssues"`
	StaleDocumentation int            `json:"staleDocumentation"`
	Unowned            int            `json:"unowned"`
	Apps               []AppHealthRow `json:"apps"`
}

func Load(ctx context.Context, db *bun.DB, scope Scope) (Response, error) {
	apps := make([]models.Apps, 0)
	query := db.NewSelect().Model(&apps).Relation("Owner").OrderExpr("LOWER(a.name) ASC")
	if scope.EditableBy != nil && *scope.EditableBy != uuid.Nil {
		query = query.Where(
			"a.owner_id = ? OR EXISTS (SELECT 1 FROM app_editors ae WHERE ae.app_id = a.id AND ae.user_id = ?)",
			*scope.EditableBy,
			*scope.EditableBy,
		)
	}
	if err := query.Scan(ctx); err != nil {
		return Response{}, err
	}

	links := make([]models.GitLabAppLink, 0)
	if len(apps) > 0 {
		appIDs := make([]string, 0, len(apps))
		for _, app := range apps {
			appIDs = append(appIDs, app.ID)
		}
		if err := db.NewSelect().Model(&links).Where("app_id IN (?)", bun.In(appIDs)).Scan(ctx); err != nil {
			return Response{}, err
		}
	}
	linkByAppID := make(map[string]models.GitLabAppLink, len(links))
	for _, link := range links {
		linkByAppID[link.AppID] = link
	}

	staleBefore := time.Now().UTC().AddDate(0, 0, -90)
	response := Response{
		GeneratedAt: time.Now().UTC(),
		Apps:        make([]AppHealthRow, 0, len(apps)),
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

		response.Apps = append(response.Apps, AppHealthRow{
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
		})
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

	return response, nil
}
