package gitlab

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

func SyncAndPersist(ctx context.Context, db *bun.DB, provider ProviderRuntime, link *models.GitLabAppLink) error {
	effectiveLink := *link
	if strings.TrimSpace(effectiveLink.ReadmePath) == "" {
		effectiveLink.ReadmePath = provider.DefaultReadmePath
	}
	if strings.TrimSpace(effectiveLink.HelmValuesPath) == "" {
		effectiveLink.HelmValuesPath = provider.DefaultHelmValuesPath
	}
	if strings.TrimSpace(effectiveLink.ComposeFilePath) == "" {
		effectiveLink.ComposeFilePath = provider.DefaultComposeFilePath
	}

	syncer := NewSyncer(config.RepositoryProviderConf{
		Key:                provider.Key,
		Type:               provider.Type,
		Label:              provider.Label,
		BaseURL:            provider.BaseURL,
		Token:              provider.Token,
		Enabled:            provider.Enabled,
		NamespaceAllowlist: provider.NamespaceAllowlist,
		TimeoutSeconds:     provider.TimeoutSeconds,
	})
	result, err := syncer.Sync(effectiveLink)

	now := time.Now().UTC()
	if provider.Type != "" {
		link.ProviderType = provider.Type
	}
	link.ProjectID = result.ProjectID
	link.ProjectWebURL = result.ProjectWebURL
	link.LastSyncedAt = now
	link.UpdatedAt = now

	if err != nil {
		link.LastSyncStatus = "error"
		link.LastSyncError = err.Error()
		_, updateErr := db.NewUpdate().
			Model(link).
			Where("app_id = ?", link.AppID).
			Column("provider_type", "project_id", "project_web_url", "last_sync_status", "last_sync_error", "last_synced_at", "updated_at").
			Exec(ctx)
		if updateErr != nil {
			return updateErr
		}
		return err
	}

	link.LastSyncError = ""
	if link.ApprovalRequired {
		link.PendingSnapshot = result.Snapshot
		link.LastSyncStatus = "pending_approval"
		_, err = db.NewUpdate().
			Model(link).
			Where("app_id = ?", link.AppID).
			Column("provider_type", "project_id", "project_web_url", "last_sync_status", "last_sync_error", "last_synced_at", "pending_snapshot", "updated_at").
			Exec(ctx)
		return err
	}

	link.Snapshot = result.Snapshot
	link.PendingSnapshot = models.GitLabSyncSnapshot{}
	link.ApprovalRequired = false
	link.LastAppliedAt = now
	link.LastManualChangeAt = time.Time{}
	link.LastSyncStatus = result.Status

	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		var app models.Apps
		if err := tx.NewSelect().Model(&app).Where("id = ?", link.AppID).Scan(ctx); err != nil {
			return err
		}

		applySnapshotToApp(&app, provider.Label, result.Snapshot)
		app.UpdatedAt = now

		if _, err := tx.NewUpdate().
			Model(&app).
			Where("id = ?", link.AppID).
			Column("description", "license", "markdown_content", "tags", "repositories", "custom_helm_values", "custom_compose_command", "updated_at").
			Exec(ctx); err != nil {
			return err
		}

		_, err := tx.NewUpdate().
			Model(link).
			Where("app_id = ?", link.AppID).
			Column("provider_type", "project_id", "project_web_url", "last_sync_status", "last_sync_error", "last_synced_at", "snapshot", "pending_snapshot", "approval_required", "last_applied_at", "last_manual_change_at", "updated_at").
			Exec(ctx)
		return err
	})
}

func ApprovePendingSync(ctx context.Context, db *bun.DB, provider ProviderRuntime, link *models.GitLabAppLink) error {
	if !link.ApprovalRequired || !snapshotHasContent(link.PendingSnapshot) {
		return errors.New("no pending gitlab snapshot to approve")
	}

	now := time.Now().UTC()
	link.Snapshot = link.PendingSnapshot
	link.PendingSnapshot = models.GitLabSyncSnapshot{}
	link.ApprovalRequired = false
	link.LastAppliedAt = now
	link.LastManualChangeAt = time.Time{}
	link.LastSyncStatus = pendingSnapshotStatus(link.Snapshot)
	link.LastSyncError = ""
	link.UpdatedAt = now

	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		var app models.Apps
		if err := tx.NewSelect().Model(&app).Where("id = ?", link.AppID).Scan(ctx); err != nil {
			return err
		}

		applySnapshotToApp(&app, provider.Label, link.Snapshot)
		app.UpdatedAt = now

		if _, err := tx.NewUpdate().
			Model(&app).
			Where("id = ?", link.AppID).
			Column("description", "license", "markdown_content", "tags", "repositories", "custom_helm_values", "custom_compose_command", "updated_at").
			Exec(ctx); err != nil {
			return err
		}

		_, err := tx.NewUpdate().
			Model(link).
			Where("app_id = ?", link.AppID).
			Column("last_sync_status", "last_sync_error", "snapshot", "pending_snapshot", "approval_required", "last_applied_at", "last_manual_change_at", "updated_at").
			Exec(ctx)
		return err
	})
}

func MarkManualChangePendingApproval(ctx context.Context, db *bun.DB, appID string) error {
	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("id = ?", appID).Scan(ctx); err != nil {
		return err
	}

	return MarkManualChangePendingApprovalForApp(ctx, db, app)
}

func MarkManualChangePendingApprovalForApp(ctx context.Context, db *bun.DB, app models.Apps) error {
	var link models.GitLabAppLink
	err := db.NewSelect().Model(&link).Where("app_id = ?", app.ID).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	if link.ApprovalRequired && snapshotHasContent(link.PendingSnapshot) {
		return nil
	}

	if !appHasManualGitLabChanges(app, link) {
		if !link.ApprovalRequired || snapshotHasContent(link.PendingSnapshot) {
			return nil
		}

		link.ApprovalRequired = false
		link.LastManualChangeAt = time.Time{}
		link.UpdatedAt = time.Now().UTC()

		_, err = db.NewUpdate().
			Model(&link).
			Where("app_id = ?", app.ID).
			Column("approval_required", "last_manual_change_at", "updated_at").
			Exec(ctx)
		return err
	}

	now := time.Now().UTC()
	link.ApprovalRequired = true
	link.LastManualChangeAt = now
	link.UpdatedAt = now

	_, err = db.NewUpdate().
		Model(&link).
		Where("app_id = ?", app.ID).
		Column("approval_required", "last_manual_change_at", "updated_at").
		Exec(ctx)
	return err
}

func snapshotHasContent(snapshot models.GitLabSyncSnapshot) bool {
	return strings.TrimSpace(snapshot.ReadmeContent) != "" ||
		strings.TrimSpace(snapshot.Description) != "" ||
		strings.TrimSpace(snapshot.License) != "" ||
		len(snapshot.Topics) > 0 ||
		strings.TrimSpace(snapshot.ProjectWebURL) != "" ||
		strings.TrimSpace(snapshot.HelmValuesContent) != "" ||
		strings.TrimSpace(snapshot.ComposeFileContent) != ""
}

func pendingSnapshotStatus(snapshot models.GitLabSyncSnapshot) string {
	if len(snapshot.Warnings) > 0 {
		return "warning"
	}
	return "success"
}

func applySnapshotToApp(app *models.Apps, providerLabel string, snapshot models.GitLabSyncSnapshot) {
	if app == nil {
		return
	}

	if description := strings.TrimSpace(snapshot.Description); description != "" {
		app.Description = description
	}
	if license := strings.TrimSpace(snapshot.License); license != "" {
		app.License = license
	}
	if readme := strings.TrimSpace(snapshot.ReadmeContent); readme != "" {
		app.MarkdownContent = readme
	}
	if helmValues := strings.TrimSpace(snapshot.HelmValuesContent); helmValues != "" {
		app.CustomHelmValues = helmValues
	}
	if composeFile := strings.TrimSpace(snapshot.ComposeFileContent); composeFile != "" {
		app.CustomComposeCommand = composeFile
	}

	if projectURL := strings.TrimSpace(snapshot.ProjectWebURL); projectURL != "" {
		label := strings.TrimSpace(providerLabel)
		if label == "" {
			label = "GitLab"
		}

		updated := false
		for index := range app.Repositories {
			if app.Repositories[index].URL == projectURL {
				app.Repositories[index].Label = label
				updated = true
				break
			}
		}
		if !updated {
			app.Repositories = append(app.Repositories, models.AppLink{Label: label, URL: projectURL})
		}
	}

	if len(snapshot.Topics) > 0 {
		tagSet := make(map[string]struct{}, len(app.Tags)+len(snapshot.Topics))
		mergedTags := make([]string, 0, len(app.Tags)+len(snapshot.Topics))
		for _, tag := range app.Tags {
			normalized := strings.TrimSpace(tag)
			if normalized == "" {
				continue
			}
			if _, exists := tagSet[normalized]; exists {
				continue
			}
			tagSet[normalized] = struct{}{}
			mergedTags = append(mergedTags, normalized)
		}
		for _, tag := range snapshot.Topics {
			normalized := strings.TrimSpace(tag)
			if normalized == "" {
				continue
			}
			if _, exists := tagSet[normalized]; exists {
				continue
			}
			tagSet[normalized] = struct{}{}
			mergedTags = append(mergedTags, normalized)
		}
		app.Tags = mergedTags
	}
}

func appHasManualGitLabChanges(app models.Apps, link models.GitLabAppLink) bool {
	snapshot := link.Snapshot
	if !snapshotHasContent(snapshot) {
		return false
	}

	if description := strings.TrimSpace(snapshot.Description); description != "" && strings.TrimSpace(app.Description) != description {
		return true
	}
	if license := strings.TrimSpace(snapshot.License); license != "" && strings.TrimSpace(app.License) != license {
		return true
	}
	if readme := strings.TrimSpace(snapshot.ReadmeContent); readme != "" && strings.TrimSpace(app.MarkdownContent) != readme {
		return true
	}
	if helmValues := strings.TrimSpace(snapshot.HelmValuesContent); helmValues != "" && strings.TrimSpace(app.CustomHelmValues) != helmValues {
		return true
	}
	if composeFile := strings.TrimSpace(snapshot.ComposeFileContent); composeFile != "" && strings.TrimSpace(app.CustomComposeCommand) != composeFile {
		return true
	}
	if projectURL := strings.TrimSpace(snapshot.ProjectWebURL); projectURL != "" && !repositoriesContainURL(app.Repositories, projectURL) {
		return true
	}
	if len(snapshot.Topics) > 0 && !tagsContainAllTopics(app.Tags, snapshot.Topics) {
		return true
	}

	return false
}

func repositoriesContainURL(repositories []models.AppLink, url string) bool {
	normalizedURL := strings.TrimSpace(url)
	if normalizedURL == "" {
		return true
	}

	for _, repository := range repositories {
		if strings.TrimSpace(repository.URL) == normalizedURL {
			return true
		}
	}

	return false
}

func tagsContainAllTopics(tags []string, topics []string) bool {
	if len(topics) == 0 {
		return true
	}

	tagSet := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		normalized := strings.TrimSpace(tag)
		if normalized == "" {
			continue
		}
		tagSet[normalized] = struct{}{}
	}

	for _, topic := range topics {
		normalized := strings.TrimSpace(topic)
		if normalized == "" {
			continue
		}
		if _, exists := tagSet[normalized]; !exists {
			return false
		}
	}

	return true
}
