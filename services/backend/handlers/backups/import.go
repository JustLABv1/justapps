package backups

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type restoreMode string

const (
	restoreModeMerge   restoreMode = "merge"
	restoreModeReplace restoreMode = "replace"
)

type importSectionStats struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
}

type importResponse struct {
	Message         string                        `json:"message"`
	RestoreMode     restoreMode                   `json:"restoreMode"`
	AppliedSections []string                      `json:"appliedSections"`
	Warnings        []string                      `json:"warnings,omitempty"`
	Stats           map[string]importSectionStats `json:"stats"`
}

func ImportBackup(c *gin.Context, db *bun.DB, dataPath string) {
	payload, passphrase, requestedSectionsInput, restoreModeInput, err := readImportRequest(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup payload", "detail": err.Error()})
		return
	}

	manifest, importWarnings, err := decodeBackupPayload(payload, passphrase)
	if err != nil {
		message := "Backup payload could not be decrypted or verified. Check the passphrase and the file integrity."
		if errors.Is(err, errEncryptedBackupInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": message})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": message, "detail": err.Error()})
		return
	}

	if strings.TrimSpace(manifest.SchemaVersion) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup schemaVersion is required"})
		return
	}

	requestedSections, err := parseImportSections(requestedSectionsInput, manifest)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mode, err := parseRestoreMode(restoreModeInput)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if mode == restoreModeReplace && !isFullScope(requestedSections) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "Replace restore currently requires the full backup scope",
			"detail": "Use merge for selective section imports or include all sections for a destructive replace.",
		})
		return
	}

	stats := make(map[string]importSectionStats, len(requestedSections))
	warnings := append(make([]string, 0, 8), importWarnings...)

	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start restore transaction", "detail": err.Error()})
		return
	}
	defer tx.Rollback()

	ctx := c.Request.Context()

	if mode == restoreModeReplace {
		if err := clearDatabaseForReplace(ctx, tx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear existing data for replace restore", "detail": err.Error()})
			return
		}
	}

	applySection := func(section string, fn func() (importSectionStats, []string, error)) bool {
		sectionStats, sectionWarnings, sectionErr := fn()
		if sectionErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to restore backup section",
				"section": section,
				"detail":  sectionErr.Error(),
			})
			return false
		}
		stats[section] = sectionStats
		warnings = append(warnings, sectionWarnings...)
		return true
	}

	for _, section := range requestedSections {
		switch section {
		case "users":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importUsers(ctx, tx, manifest.Data.Users)
			}) {
				return
			}
		case "settings":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importSettings(ctx, tx, manifest.Data.Settings)
			}) {
				return
			}
		case "repositoryProviders", "gitLabProviders":
			if !applySection("repositoryProviders", func() (importSectionStats, []string, error) {
				return importGitLabProviders(ctx, tx, manifest.Data.RepositoryProviders)
			}) {
				return
			}
		case "apps":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importApps(ctx, tx, manifest.Data.Apps)
			}) {
				return
			}
		case "appGroups":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importAppGroups(ctx, tx, manifest.Data.AppGroups)
			}) {
				return
			}
		case "appRelations":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importAppRelations(ctx, tx, manifest.Data.AppRelations)
			}) {
				return
			}
		case "repositoryAppLinks", "gitLabAppLinks":
			if !applySection("repositoryAppLinks", func() (importSectionStats, []string, error) {
				return importGitLabAppLinks(ctx, tx, manifest.Data.RepositoryAppLinks)
			}) {
				return
			}
		case "aiProviders":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importAIProviders(ctx, tx, manifest.Data.AIProviders)
			}) {
				return
			}
		case "aiConversations":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importAIConversations(ctx, tx, manifest.Data.AIConversations, manifest.Data.AIMessages)
			}) {
				return
			}
		case "tokens":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importTokens(ctx, tx, manifest.Data.Tokens)
			}) {
				return
			}
		case "favorites":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importFavorites(ctx, tx, manifest.Data.Favorites)
			}) {
				return
			}
		case "ratings":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importRatings(ctx, tx, manifest.Data.Ratings)
			}) {
				return
			}
		case "audit":
			if !applySection(section, func() (importSectionStats, []string, error) {
				return importAudit(ctx, tx, manifest.Data.Audit)
			}) {
				return
			}
		case "assets":
			// Assets are restored after the DB transaction commits.
			stats[section] = importSectionStats{Created: len(manifest.Data.Assets)}
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit restore transaction", "detail": err.Error()})
		return
	}

	if hasSection(requestedSections, "assets") {
		assetStats, assetWarnings, assetErr := restoreAssets(dataPath, manifest.Data.Assets, mode == restoreModeReplace)
		warnings = append(warnings, assetWarnings...)
		stats["assets"] = assetStats
		if assetErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":           "Backup data was restored, but asset restore failed",
				"detail":          assetErr.Error(),
				"restoreMode":     mode,
				"appliedSections": requestedSections,
				"warnings":        warnings,
				"stats":           stats,
			})
			return
		}
	}

	c.JSON(http.StatusOK, importResponse{
		Message:         "Backup import completed",
		RestoreMode:     mode,
		AppliedSections: requestedSections,
		Warnings:        warnings,
		Stats:           stats,
	})
}

func readImportRequest(c *gin.Context) ([]byte, string, string, string, error) {
	contentType := strings.ToLower(c.ContentType())
	if strings.HasPrefix(contentType, "multipart/") {
		file, err := c.FormFile("file")
		if err != nil {
			return nil, "", "", "", err
		}
		opened, err := file.Open()
		if err != nil {
			return nil, "", "", "", err
		}
		defer opened.Close()

		payload, err := io.ReadAll(opened)
		if err != nil {
			return nil, "", "", "", err
		}
		return payload, c.PostForm("passphrase"), c.PostForm("sections"), c.PostForm("restoreMode"), nil
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, "", "", "", err
	}
	return payload, c.GetHeader("X-Backup-Passphrase"), c.Query("sections"), c.Query("restoreMode"), nil
}

func parseRestoreMode(value string) (restoreMode, error) {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" || trimmed == string(restoreModeMerge) {
		return restoreModeMerge, nil
	}
	if trimmed == string(restoreModeReplace) {
		return restoreModeReplace, nil
	}
	return "", errors.New("restoreMode must be merge or replace")
}

func parseImportSections(query string, manifest models.BackupManifest) ([]string, error) {
	if strings.TrimSpace(query) != "" {
		return parseSections(query)
	}

	if len(manifest.Sections) > 0 {
		joined := strings.Join(manifest.Sections, ",")
		return parseSections(joined)
	}

	inferred := inferManifestSections(manifest)
	if len(inferred) == 0 {
		return nil, errors.New("backup payload does not contain any importable sections")
	}
	return inferred, nil
}

func inferManifestSections(manifest models.BackupManifest) []string {
	sections := make([]string, 0, len(allSections))
	if len(manifest.Data.Apps) > 0 {
		sections = append(sections, "apps")
	}
	if len(manifest.Data.AppGroups) > 0 {
		sections = append(sections, "appGroups")
	}
	if len(manifest.Data.AppRelations) > 0 {
		sections = append(sections, "appRelations")
	}
	if len(manifest.Data.Users) > 0 {
		sections = append(sections, "users")
	}
	if manifest.Data.Settings != nil {
		sections = append(sections, "settings")
	}
	if len(manifest.Data.RepositoryProviders) > 0 {
		sections = append(sections, "repositoryProviders")
	}
	if len(manifest.Data.RepositoryAppLinks) > 0 {
		sections = append(sections, "repositoryAppLinks")
	}
	if len(manifest.Data.AIProviders) > 0 {
		sections = append(sections, "aiProviders")
	}
	if len(manifest.Data.AIConversations) > 0 || len(manifest.Data.AIMessages) > 0 {
		sections = append(sections, "aiConversations")
	}
	if len(manifest.Data.Tokens) > 0 {
		sections = append(sections, "tokens")
	}
	if len(manifest.Data.Favorites) > 0 {
		sections = append(sections, "favorites")
	}
	if len(manifest.Data.Ratings) > 0 {
		sections = append(sections, "ratings")
	}
	if len(manifest.Data.Audit) > 0 {
		sections = append(sections, "audit")
	}
	if len(manifest.Data.Assets) > 0 {
		sections = append(sections, "assets")
	}
	return sections
}

func isFullScope(sections []string) bool {
	if len(sections) != len(allSections) {
		return false
	}
	for _, candidate := range allSections {
		if !hasSection(sections, candidate) {
			return false
		}
	}
	return true
}

func hasSection(sections []string, target string) bool {
	for _, section := range sections {
		if section == target {
			return true
		}
	}
	return false
}

func clearDatabaseForReplace(ctx context.Context, tx bun.Tx) error {
	deleteAll := func(model interface{}) error {
		_, err := tx.NewDelete().Model(model).Where("1 = 1").Exec(ctx)
		return err
	}

	for _, model := range []interface{}{
		(*models.Audit)(nil),
		(*models.Rating)(nil),
		(*models.UserFavorite)(nil),
		(*models.Tokens)(nil),
		(*models.AIMessage)(nil),
		(*models.AIConversation)(nil),
		(*models.AIKnowledgeChunk)(nil),
		(*models.GitLabAppLink)(nil),
		(*models.AppRelation)(nil),
		(*models.AppGroupMember)(nil),
		(*models.AppGroup)(nil),
		(*models.Apps)(nil),
		(*models.AIProviderSettings)(nil),
		(*models.GitLabProviderSettings)(nil),
		(*models.PlatformSettings)(nil),
		(*models.Users)(nil),
	} {
		if err := deleteAll(model); err != nil {
			return err
		}
	}

	return nil
}

func importUsers(ctx context.Context, tx bun.Tx, backupUsers []models.BackupUser) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	warnings := make([]string, 0)

	for _, backupUser := range backupUsers {
		var existing models.Users
		err := tx.NewSelect().Model(&existing).Where("id = ?", backupUser.ID).Scan(ctx)
		exists := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return stats, warnings, err
		}

		password := backupUser.Password
		if !exists && password == "" {
			generated := models.Users{Password: uuid.NewString()}
			if hashErr := generated.HashPassword(generated.Password); hashErr != nil {
				return stats, warnings, hashErr
			}
			password = generated.Password
			backupUser.Disabled = true
			if strings.TrimSpace(backupUser.DisabledReason) == "" {
				backupUser.DisabledReason = "Restored from safe backup without password hash; password reset required"
			}
			warnings = append(warnings, "Created placeholder password hashes for one or more restored users.")
		}
		if exists && password == "" {
			password = existing.Password
		}

		user := models.Users{
			ID:             backupUser.ID,
			Username:       backupUser.Username,
			Email:          backupUser.Email,
			Password:       password,
			Role:           strings.ToLower(strings.TrimSpace(backupUser.Role)),
			AuthType:       strings.TrimSpace(backupUser.AuthType),
			CanSubmitApps:  backupUser.CanSubmitApps,
			Disabled:       backupUser.Disabled,
			DisabledReason: backupUser.DisabledReason,
			CreatedAt:      backupUser.CreatedAt,
			UpdatedAt:      backupUser.UpdatedAt,
			LastLoginAt:    backupUser.LastLoginAt,
		}
		if user.Role == "" {
			user.Role = "user"
		}
		if user.AuthType == "" {
			user.AuthType = "local"
		}
		if user.UpdatedAt.IsZero() {
			user.UpdatedAt = time.Now().UTC()
		}

		if exists {
			_, err = tx.NewUpdate().Model(&user).
				Where("id = ?", user.ID).
				Column("username", "email", "password", "role", "auth_type", "can_submit_apps", "disabled", "disabled_reason", "updated_at", "last_login_at").
				Exec(ctx)
			if err != nil {
				return stats, warnings, err
			}
			stats.Updated++
			continue
		}

		_, err = tx.NewInsert().Model(&user).
			Column("id", "username", "email", "password", "role", "auth_type", "can_submit_apps", "disabled", "disabled_reason", "created_at", "updated_at", "last_login_at").
			Exec(ctx)
		if err != nil {
			return stats, warnings, err
		}
		stats.Created++
	}

	return stats, dedupeWarnings(warnings), nil
}

func importSettings(ctx context.Context, tx bun.Tx, settings *models.PlatformSettings) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	if settings == nil {
		stats.Skipped = 1
		return stats, nil, nil
	}

	settings.ID = "default"
	var existing models.PlatformSettings
	err := tx.NewSelect().Model(&existing).Where("id = ?", "default").Scan(ctx)
	exists := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return stats, nil, err
	}

	if exists {
		_, err = tx.NewUpdate().Model(settings).
			Where("id = ?", "default").
			Column(
				"allow_app_submissions", "show_top_banner", "top_banner_text", "top_banner_type",
				"detail_fields", "store_name", "store_description", "logo_url", "logo_dark_url",
				"favicon_url", "accent_color", "hero_badge", "hero_title", "hero_title_preset", "hero_title_colors", "hero_subtitle",
				"footer_text", "footer_links", "show_flag_bar", "top_bar_preset", "top_bar_colors", "app_sort_field", "app_sort_direction",
				"pinned_apps", "enable_link_probing",
			).
			Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Updated = 1
		return stats, nil, nil
	}

	_, err = tx.NewInsert().Model(settings).Exec(ctx)
	if err != nil {
		return stats, nil, err
	}
	stats.Created = 1
	return stats, nil, nil
}

func importGitLabProviders(ctx context.Context, tx bun.Tx, providers []models.GitLabProviderSettings) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, provider := range providers {
		var existing models.GitLabProviderSettings
		err := tx.NewSelect().Model(&existing).Where("provider_key = ?", provider.ProviderKey).Scan(ctx)
		exists := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&provider).
				Where("provider_key = ?", provider.ProviderKey).
				Column("provider_type", "label", "base_url", "encrypted_token", "token_nonce", "token_key_version", "token_configured", "namespace_allowlist", "enabled", "auto_sync_enabled", "sync_interval_minutes", "default_readme_path", "default_helm_values_path", "default_compose_file_path", "created_at", "updated_at").
				Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&provider).Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importApps(ctx context.Context, tx bun.Tx, apps []models.Apps) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, app := range apps {
		normalizeImportedApp(&app)
		exists, err := tx.NewSelect().Model((*models.Apps)(nil)).Where("id = ?", app.ID).Exists(ctx)
		if err != nil {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&app).Where("id = ?", app.ID).Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&app).Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importAppGroups(ctx context.Context, tx bun.Tx, groups []models.AppGroup) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, group := range groups {
		members := append([]models.AppGroupMember(nil), group.Members...)
		group.Members = nil
		exists, err := tx.NewSelect().Model((*models.AppGroup)(nil)).Where("id = ?", group.ID).Exists(ctx)
		if err != nil {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&group).Where("id = ?", group.ID).Column("name", "description", "icon").Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
		} else {
			_, err = tx.NewInsert().Model(&group).Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Created++
		}

		if len(members) == 0 {
			continue
		}
		for index := range members {
			members[index].AppGroupID = group.ID
		}
		_, err = tx.NewInsert().Model(&members).On("CONFLICT DO NOTHING").Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created += len(members)
	}
	return stats, nil, nil
}

func importAppRelations(ctx context.Context, tx bun.Tx, relations []models.AppRelation) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, relation := range relations {
		_, err := tx.NewInsert().Model(&relation).On("CONFLICT DO NOTHING").Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importGitLabAppLinks(ctx context.Context, tx bun.Tx, links []models.GitLabAppLink) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, link := range links {
		exists, err := tx.NewSelect().Model((*models.GitLabAppLink)(nil)).Where("app_id = ?", link.AppID).Exists(ctx)
		if err != nil {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&link).
				Where("app_id = ?", link.AppID).
				Column("provider_key", "project_id", "project_path", "project_web_url", "branch", "readme_path", "helm_values_path", "compose_file_path", "last_sync_status", "last_sync_error", "last_synced_at", "snapshot", "pending_snapshot", "approval_required", "last_applied_at", "last_manual_change_at", "created_at", "updated_at").
				Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&link).Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importAIProviders(ctx context.Context, tx bun.Tx, providers []models.AIProviderSettings) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	now := time.Now().UTC()
	for _, provider := range providers {
		provider.ProviderKey = strings.TrimSpace(provider.ProviderKey)
		if provider.ProviderKey == "" {
			stats.Skipped++
			continue
		}
		if strings.TrimSpace(provider.ProviderType) == "" {
			provider.ProviderType = "openai-compatible"
		}
		if provider.CreatedAt.IsZero() {
			provider.CreatedAt = now
		}
		if provider.UpdatedAt.IsZero() {
			provider.UpdatedAt = now
		}

		var existing models.AIProviderSettings
		err := tx.NewSelect().Model(&existing).Where("provider_key = ?", provider.ProviderKey).Scan(ctx)
		exists := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&provider).
				Where("provider_key = ?", provider.ProviderKey).
				Column("provider_type", "label", "base_url", "api_path", "api_version", "region", "organization", "chat_model", "embedding_model", "encrypted_token", "token_nonce", "token_key_version", "token_configured", "enabled", "is_default", "timeout_seconds", "max_context_tokens", "max_output_tokens", "temperature", "created_at", "updated_at").
				Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&provider).Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importAIConversations(ctx context.Context, tx bun.Tx, conversations []models.AIConversation, messages []models.AIMessage) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	warnings := make([]string, 0)
	now := time.Now().UTC()

	for _, conversation := range conversations {
		if conversation.ID == uuid.Nil || conversation.UserID == uuid.Nil {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more AI conversations because required identifiers were missing.")
			continue
		}
		conversation.AppID = strings.TrimSpace(conversation.AppID)
		if strings.TrimSpace(conversation.Title) == "" {
			conversation.Title = "Neuer Chat"
		}
		if strings.TrimSpace(conversation.ScopeType) == "" {
			if conversation.AppID != "" {
				conversation.ScopeType = "app"
			} else {
				conversation.ScopeType = "global"
			}
		}
		if conversation.CreatedAt.IsZero() {
			conversation.CreatedAt = now
		}
		if conversation.UpdatedAt.IsZero() {
			conversation.UpdatedAt = conversation.CreatedAt
		}

		exists, err := tx.NewSelect().Model((*models.AIConversation)(nil)).Where("id = ?", conversation.ID).Exists(ctx)
		if err != nil {
			return stats, warnings, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&conversation).
				Where("id = ?", conversation.ID).
				Column("user_id", "title", "scope_type", "app_id", "created_at", "updated_at").
				Exec(ctx)
			if err != nil {
				return stats, warnings, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&conversation).Exec(ctx)
		if err != nil {
			return stats, warnings, err
		}
		stats.Created++
	}

	for _, message := range messages {
		if message.ID == uuid.Nil || message.ConversationID == uuid.Nil {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more AI messages because required identifiers were missing.")
			continue
		}
		message.Role = strings.TrimSpace(message.Role)
		if message.Role == "" {
			message.Role = "assistant"
		}
		if message.Sources == nil {
			message.Sources = []models.AIMessageSource{}
		}
		if message.CreatedAt.IsZero() {
			message.CreatedAt = now
		}

		exists, err := tx.NewSelect().Model((*models.AIMessage)(nil)).Where("id = ?", message.ID).Exists(ctx)
		if err != nil {
			return stats, warnings, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&message).
				Where("id = ?", message.ID).
				Column("conversation_id", "role", "content", "provider_key", "provider_type", "model", "prompt_tokens", "response_tokens", "sources", "error", "created_at").
				Exec(ctx)
			if err != nil {
				return stats, warnings, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&message).Exec(ctx)
		if err != nil {
			return stats, warnings, err
		}
		stats.Created++
	}

	return stats, dedupeWarnings(warnings), nil
}

func importTokens(ctx context.Context, tx bun.Tx, tokens []models.BackupToken) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	warnings := make([]string, 0)
	for _, backupToken := range tokens {
		var existing models.Tokens
		err := tx.NewSelect().Model(&existing).Where("id = ?", backupToken.ID).Scan(ctx)
		exists := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return stats, warnings, err
		}

		if !exists && strings.TrimSpace(backupToken.Key) == "" {
			stats.Skipped++
			warnings = append(warnings, "Skipped token creation for one or more entries because the backup did not include token secrets.")
			continue
		}

		tokenKey := backupToken.Key
		if exists && tokenKey == "" {
			tokenKey = existing.Key
		}

		token := models.Tokens{
			ID:             backupToken.ID,
			Key:            tokenKey,
			Description:    backupToken.Description,
			Type:           backupToken.Type,
			Disabled:       backupToken.Disabled,
			DisabledReason: backupToken.DisabledReason,
			CreatedAt:      backupToken.CreatedAt,
			ExpiresAt:      backupToken.ExpiresAt,
			UserID:         backupToken.UserID,
		}

		if exists {
			_, err = tx.NewUpdate().Model(&token).
				Where("id = ?", token.ID).
				Column("key", "description", "type", "disabled", "disabled_reason", "created_at", "expires_at", "user_id").
				Exec(ctx)
			if err != nil {
				return stats, warnings, err
			}
			stats.Updated++
			continue
		}

		_, err = tx.NewInsert().Model(&token).Exec(ctx)
		if err != nil {
			return stats, warnings, err
		}
		stats.Created++
	}
	return stats, dedupeWarnings(warnings), nil
}

func importFavorites(ctx context.Context, tx bun.Tx, favorites []models.UserFavorite) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, favorite := range favorites {
		_, err := tx.NewInsert().Model(&favorite).On("CONFLICT DO NOTHING").Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importRatings(ctx context.Context, tx bun.Tx, ratings []models.Rating) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, rating := range ratings {
		exists, err := tx.NewSelect().Model((*models.Rating)(nil)).Where("id = ?", rating.ID).Exists(ctx)
		if err != nil {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&rating).Where("id = ?", rating.ID).Column("app_id", "user_id", "username", "rating", "comment", "created_at").Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&rating).Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func importAudit(ctx context.Context, tx bun.Tx, entries []models.Audit) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	for _, entry := range entries {
		exists, err := tx.NewSelect().Model((*models.Audit)(nil)).Where("id = ?", entry.ID).Exists(ctx)
		if err != nil {
			return stats, nil, err
		}
		if exists {
			_, err = tx.NewUpdate().Model(&entry).Where("id = ?", entry.ID).Column("user_id", "operation", "details", "created_at").Exec(ctx)
			if err != nil {
				return stats, nil, err
			}
			stats.Updated++
			continue
		}
		_, err = tx.NewInsert().Model(&entry).Exec(ctx)
		if err != nil {
			return stats, nil, err
		}
		stats.Created++
	}
	return stats, nil, nil
}

func restoreAssets(dataPath string, assets []models.BackupAsset, replace bool) (importSectionStats, []string, error) {
	stats := importSectionStats{}
	warnings := make([]string, 0)
	uploadDir := filepath.Join(dataPath, "uploads")

	if replace {
		if err := os.RemoveAll(uploadDir); err != nil {
			return stats, warnings, err
		}
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return stats, warnings, err
	}

	for _, asset := range assets {
		relativePath, _, ok := normalizeBackupAssetPath(asset.RelativePath, asset.Filename)
		if !ok {
			stats.Skipped++
			warnings = append(warnings, "Skipped an uploaded asset because its path was invalid.")
			continue
		}
		if strings.TrimSpace(asset.ContentBase64) == "" {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more uploaded assets because the backup did not include file contents.")
			continue
		}

		content, err := base64.StdEncoding.DecodeString(asset.ContentBase64)
		if err != nil {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more uploaded assets because their content could not be decoded.")
			continue
		}

		targetPath := filepath.Join(dataPath, filepath.FromSlash(relativePath))
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more uploaded assets because their directory could not be created.")
			continue
		}

		_, statErr := os.Stat(targetPath)
		exists := statErr == nil
		if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more uploaded assets because their existing file state could not be checked.")
			continue
		}

		if writeErr := os.WriteFile(targetPath, content, 0644); writeErr != nil {
			stats.Skipped++
			warnings = append(warnings, "Skipped one or more uploaded assets because they could not be written to disk.")
			continue
		}
		if exists {
			stats.Updated++
		} else {
			stats.Created++
		}
	}

	return stats, dedupeWarnings(warnings), nil
}

func normalizeImportedApp(app *models.Apps) {
	if app == nil {
		return
	}
	// Legacy backup compatibility: promote knownIssue to a warning banner
	if strings.TrimSpace(app.KnownIssue) != "" && strings.TrimSpace(app.BannerText) == "" {
		app.BannerText = strings.TrimSpace(app.KnownIssue)
		app.BannerType = "warning"
	}
	app.Status = normalizeStatus(app.Status)
	normalizeDetailFields(app)
	if app.CreatedAt.IsZero() {
		app.CreatedAt = time.Now().UTC()
	}
	if app.UpdatedAt.IsZero() {
		app.UpdatedAt = time.Now().UTC()
	}
}

func normalizeStatus(status string) string {
	trimmed := strings.TrimSpace(status)
	if trimmed == "" {
		return ""
	}
	if strings.EqualFold(trimmed, "draft") || strings.EqualFold(trimmed, "entwurf") {
		return "Entwurf"
	}
	return trimmed
}

func normalizeDetailFields(app *models.Apps) {
	if app == nil {
		return
	}
	keyed := make(map[string]int, len(app.CustomFields))
	fields := make([]models.AppField, 0, len(app.CustomFields)+11)
	appendField := func(key string, value string) {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			return
		}
		if index, exists := keyed[trimmedKey]; exists {
			if fields[index].Value == "" && strings.TrimSpace(value) != "" {
				fields[index].Value = value
			}
			return
		}
		keyed[trimmedKey] = len(fields)
		fields = append(fields, models.AppField{Key: trimmedKey, Value: value})
	}

	for _, field := range app.CustomFields {
		appendField(field.Key, field.Value)
	}
	legacy := map[string]string{
		"focus":           app.Focus,
		"app_type":        app.AppType,
		"use_case":        app.UseCase,
		"visualization":   app.Visualization,
		"deployment":      app.Deployment,
		"infrastructure":  app.Infrastructure,
		"database":        app.Database,
		"transferability": app.Transferability,
		"contact_person":  app.ContactPerson,
		"authority":       app.Authority,
		"additional_info": app.AdditionalInfo,
	}
	for key, value := range legacy {
		appendField(key, strings.TrimSpace(value))
	}
	app.CustomFields = fields
}

func dedupeWarnings(items []string) []string {
	if len(items) < 2 {
		return items
	}
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))
	for _, item := range items {
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}
