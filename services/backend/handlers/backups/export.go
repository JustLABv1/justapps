package backups

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	apphandlers "justapps-backend/handlers/apps"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type exportBackupRequest struct {
	Mode       string   `json:"mode"`
	Sections   []string `json:"sections"`
	Passphrase string   `json:"passphrase"`
}

const schemaVersion = "2026-04-17"

var allSections = []string{
	"apps",
	"appGroups",
	"appRelations",
	"users",
	"settings",
	"gitLabProviders",
	"gitLabAppLinks",
	"tokens",
	"favorites",
	"ratings",
	"audit",
	"assets",
}

var sensitiveSections = map[string]bool{
	"users":  true,
	"tokens": true,
	"audit":  true,
}

func ExportBackup(c *gin.Context, db *bun.DB, dataPath string) {
	var request exportBackupRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid export request", "detail": err.Error()})
		return
	}

	mode := parseBackupMode(request.Mode)
	sections, err := parseRequestedSections(request.Sections)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateBackupPassphrase(request.Passphrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	manifest := models.BackupManifest{
		SchemaVersion: schemaVersion,
		ExportedAt:    time.Now().UTC(),
		Mode:          mode,
		Sections:      sections,
		Summary:       make([]models.BackupSectionSummary, 0, len(sections)),
		Warnings:      make([]string, 0, 4),
	}

	for _, section := range sections {
		switch section {
		case "apps":
			apps, sectionErr := apphandlers.ExportAppsData(c.Request.Context(), db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Apps = apps
			appendSummary(&manifest, section, len(apps))
		case "appGroups":
			groups, sectionErr := exportAppGroups(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.AppGroups = groups
			appendSummary(&manifest, section, len(groups))
		case "appRelations":
			relations, sectionErr := exportAppRelations(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.AppRelations = relations
			appendSummary(&manifest, section, len(relations))
		case "users":
			users, redacted, sectionErr := exportUsers(c, db, mode)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Users = users
			appendSummary(&manifest, section, len(users))
			if redacted {
				manifest.Warnings = append(manifest.Warnings, "User password hashes were omitted in safe mode.")
			}
		case "settings":
			settings, sectionErr := exportSettings(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Settings = settings
			count := 0
			if settings != nil {
				count = 1
			}
			appendSummary(&manifest, section, count)
		case "gitLabProviders":
			providers, sectionErr := exportGitLabProviders(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.GitLabProviders = providers
			appendSummary(&manifest, section, len(providers))
		case "gitLabAppLinks":
			links, sectionErr := exportGitLabAppLinks(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.GitLabAppLinks = links
			appendSummary(&manifest, section, len(links))
		case "tokens":
			tokens, redacted, sectionErr := exportTokens(c, db, mode)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Tokens = tokens
			appendSummary(&manifest, section, len(tokens))
			if redacted {
				manifest.Warnings = append(manifest.Warnings, "Token secrets were omitted in safe mode.")
			}
		case "favorites":
			favorites, sectionErr := exportFavorites(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Favorites = favorites
			appendSummary(&manifest, section, len(favorites))
		case "ratings":
			ratings, sectionErr := exportRatings(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Ratings = ratings
			appendSummary(&manifest, section, len(ratings))
		case "audit":
			auditEntries, sectionErr := exportAudit(c, db)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Audit = auditEntries
			appendSummary(&manifest, section, len(auditEntries))
		case "assets":
			assets, assetWarnings, sectionErr := exportAssets(dataPath)
			if sectionErr != nil {
				respondSectionError(c, section, sectionErr)
				return
			}
			manifest.Data.Assets = assets
			manifest.Warnings = append(manifest.Warnings, assetWarnings...)
			appendSummary(&manifest, section, len(assets))
		}
	}

	payload, err := encryptBackupManifest(manifest, request.Passphrase)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt backup payload", "detail": err.Error()})
		return
	}

	filename := buildBackupFilename(mode, sections, manifest.ExportedAt)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/vnd.justapps.backup+json", payload)
}

func parseBackupMode(value string) models.BackupMode {
	if strings.EqualFold(strings.TrimSpace(value), string(models.BackupModeFull)) {
		return models.BackupModeFull
	}
	return models.BackupModeSafe
}

func parseSections(value string) ([]string, error) {
	if strings.TrimSpace(value) == "" {
		return append([]string(nil), allSections...), nil
	}

	seen := make(map[string]struct{})
	sections := make([]string, 0, len(allSections))
	for _, part := range strings.Split(value, ",") {
		section := strings.TrimSpace(part)
		if section == "" {
			continue
		}

		matched := ""
		for _, candidate := range allSections {
			if strings.EqualFold(section, candidate) {
				matched = candidate
				break
			}
		}
		if matched == "" {
			return nil, errors.New("unknown backup section: " + section)
		}
		if _, exists := seen[matched]; exists {
			continue
		}
		seen[matched] = struct{}{}
		sections = append(sections, matched)
	}

	if len(sections) == 0 {
		return nil, errors.New("no backup sections requested")
	}

	return sections, nil
}

func parseRequestedSections(sections []string) ([]string, error) {
	if len(sections) == 0 {
		return append([]string(nil), allSections...), nil
	}
	return parseSections(strings.Join(sections, ","))
}

func buildBackupFilename(mode models.BackupMode, sections []string, exportedAt time.Time) string {
	suffix := "instance"
	if len(sections) == 1 {
		suffix = sections[0]
	}
	if len(sections) > 1 && len(sections) < len(allSections) {
		suffix = "selected"
	}
	return fmt.Sprintf("justapps-backup-%s-%s-%s.jabackup", suffix, mode, exportedAt.UTC().Format("2006-01-02"))
}

func appendSummary(manifest *models.BackupManifest, section string, itemCount int) {
	manifest.Summary = append(manifest.Summary, models.BackupSectionSummary{
		Name:      section,
		ItemCount: itemCount,
		Sensitive: sensitiveSections[section],
	})
}

func respondSectionError(c *gin.Context, section string, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"error":   "Failed to export backup section",
		"section": section,
		"detail":  err.Error(),
	})
}

func exportAppGroups(c *gin.Context, db *bun.DB) ([]models.AppGroup, error) {
	var groups []models.AppGroup
	err := db.NewSelect().Model(&groups).Relation("Members").Order("name ASC").Scan(c.Request.Context())
	return groups, err
}

func exportAppRelations(c *gin.Context, db *bun.DB) ([]models.AppRelation, error) {
	var relations []models.AppRelation
	err := db.NewSelect().Model(&relations).Order("app_id ASC", "related_app_id ASC").Scan(c.Request.Context())
	return relations, err
}

func exportUsers(c *gin.Context, db *bun.DB, mode models.BackupMode) ([]models.BackupUser, bool, error) {
	var users []models.Users
	if err := db.NewSelect().Model(&users).Order("created_at ASC").Scan(c.Request.Context()); err != nil {
		return nil, false, err
	}

	redacted := mode != models.BackupModeFull
	backupUsers := make([]models.BackupUser, 0, len(users))
	for _, user := range users {
		backupUser := models.BackupUser{
			ID:             user.ID,
			Username:       user.Username,
			Email:          user.Email,
			Role:           user.Role,
			AuthType:       user.AuthType,
			CanSubmitApps:  user.CanSubmitApps,
			Disabled:       user.Disabled,
			DisabledReason: user.DisabledReason,
			CreatedAt:      user.CreatedAt,
			UpdatedAt:      user.UpdatedAt,
			LastLoginAt:    user.LastLoginAt,
		}
		if !redacted {
			backupUser.Password = user.Password
		}
		backupUsers = append(backupUsers, backupUser)
	}

	return backupUsers, redacted && len(users) > 0, nil
}

func exportSettings(c *gin.Context, db *bun.DB) (*models.PlatformSettings, error) {
	var settings models.PlatformSettings
	err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c.Request.Context())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &settings, nil
}

func exportGitLabProviders(c *gin.Context, db *bun.DB) ([]models.GitLabProviderSettings, error) {
	var providers []models.GitLabProviderSettings
	err := db.NewSelect().Model(&providers).Order("provider_key ASC").Scan(c.Request.Context())
	return providers, err
}

func exportGitLabAppLinks(c *gin.Context, db *bun.DB) ([]models.GitLabAppLink, error) {
	var links []models.GitLabAppLink
	err := db.NewSelect().Model(&links).Order("app_id ASC").Scan(c.Request.Context())
	return links, err
}

func exportTokens(c *gin.Context, db *bun.DB, mode models.BackupMode) ([]models.BackupToken, bool, error) {
	var tokens []models.Tokens
	if err := db.NewSelect().Model(&tokens).Order("created_at ASC").Scan(c.Request.Context()); err != nil {
		return nil, false, err
	}

	redacted := mode != models.BackupModeFull
	backupTokens := make([]models.BackupToken, 0, len(tokens))
	for _, token := range tokens {
		backupToken := models.BackupToken{
			ID:             token.ID,
			Description:    token.Description,
			Type:           token.Type,
			Disabled:       token.Disabled,
			DisabledReason: token.DisabledReason,
			CreatedAt:      token.CreatedAt,
			ExpiresAt:      token.ExpiresAt,
			UserID:         token.UserID,
		}
		if !redacted {
			backupToken.Key = token.Key
		}
		backupTokens = append(backupTokens, backupToken)
	}

	return backupTokens, redacted && len(tokens) > 0, nil
}

func exportFavorites(c *gin.Context, db *bun.DB) ([]models.UserFavorite, error) {
	var favorites []models.UserFavorite
	err := db.NewSelect().Model(&favorites).Order("created_at ASC").Scan(c.Request.Context())
	return favorites, err
}

func exportRatings(c *gin.Context, db *bun.DB) ([]models.Rating, error) {
	var ratings []models.Rating
	err := db.NewSelect().Model(&ratings).Order("created_at ASC").Scan(c.Request.Context())
	return ratings, err
}

func exportAudit(c *gin.Context, db *bun.DB) ([]models.Audit, error) {
	var auditEntries []models.Audit
	err := db.NewSelect().Model(&auditEntries).Order("created_at ASC").Scan(c.Request.Context())
	return auditEntries, err
}

func exportAssets(dataPath string) ([]models.BackupAsset, []string, error) {
	uploadDir := filepath.Join(dataPath, "uploads")
	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []models.BackupAsset{}, nil, nil
		}
		return nil, nil, err
	}

	assets := make([]models.BackupAsset, 0, len(entries))
	warnings := make([]string, 0)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()
		path := filepath.Join(uploadDir, filename)
		info, statErr := entry.Info()
		if statErr != nil {
			warnings = append(warnings, "Failed to stat uploaded asset: "+filename)
			continue
		}

		content, readErr := os.ReadFile(path)
		if readErr != nil {
			warnings = append(warnings, "Failed to read uploaded asset: "+filename)
			continue
		}

		hash := sha256.Sum256(content)
		contentType := http.DetectContentType(content)
		assets = append(assets, models.BackupAsset{
			Filename:      filename,
			RelativePath:  filepath.ToSlash(filepath.Join("uploads", filename)),
			PublicURL:     "/uploads/" + filename,
			Size:          info.Size(),
			ModifiedAt:    info.ModTime().UTC(),
			ContentType:   contentType,
			SHA256:        hex.EncodeToString(hash[:]),
			ContentBase64: base64.StdEncoding.EncodeToString(content),
		})
	}

	sort.Slice(assets, func(i, j int) bool {
		return assets[i].Filename < assets[j].Filename
	})

	return assets, warnings, nil
}
