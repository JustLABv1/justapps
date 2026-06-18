package appupdates

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"slices"
	"strings"
	"time"

	"justapps-backend/pkg/models"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

const (
	ReleaseAreaDocs       = "docs"
	ReleaseAreaDeployment = "deployment"
	ReleaseAreaMetadata   = "metadata"
	ReleaseSourceGitSync  = "git_sync"
)

func CreateReleaseForAppSync(ctx context.Context, tx bun.Tx, previousApp, updatedApp models.Apps) (*models.AppRelease, error) {
	changedAreas := classifyChangedAreas(previousApp, updatedApp)
	if len(changedAreas) == 0 {
		return nil, nil
	}

	fingerprint := buildFingerprint(updatedApp, changedAreas)

	var existing models.AppRelease
	err := tx.NewSelect().
		Model(&existing).
		Where("app_id = ?", updatedApp.ID).
		Where("fingerprint = ?", fingerprint).
		Scan(ctx)
	if err == nil {
		return &existing, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	releaseType := determineReleaseType(changedAreas)
	nextVersion := bumpVersion(updatedApp.Version, releaseType)
	title, summary := buildReleaseText(changedAreas)
	changeDetails := buildChangeDetails(previousApp, updatedApp)
	diffPreview := buildDiffPreview(changeDetails)
	now := time.Now().UTC()

	release := &models.AppRelease{
		AppID:         updatedApp.ID,
		Version:       nextVersion,
		ReleaseType:   releaseType,
		Source:        ReleaseSourceGitSync,
		Title:         title,
		Summary:       summary,
		ChangedAreas:  changedAreas,
		ChangeDetails: changeDetails,
		DiffPreview:   diffPreview,
		Fingerprint:   fingerprint,
		PublishedAt:   now,
		CreatedAt:     now,
	}

	if _, err := tx.NewInsert().Model(release).Exec(ctx); err != nil {
		return nil, err
	}

	if updatedApp.Version != nextVersion {
		if _, err := tx.NewUpdate().
			Model((*models.Apps)(nil)).
			Set("version = ?", nextVersion).
			Set("changelog = ?", summary).
			Set("updated_at = ?", now).
			Where("id = ?", updatedApp.ID).
			Exec(ctx); err != nil {
			return nil, err
		}
	}

	if err := fanOutInboxItems(ctx, tx, updatedApp, *release); err != nil {
		return nil, err
	}

	return release, nil
}

func classifyChangedAreas(previousApp, updatedApp models.Apps) []string {
	areas := make([]string, 0, 3)

	if normalizeMultiline(previousApp.MarkdownContent) != normalizeMultiline(updatedApp.MarkdownContent) {
		areas = append(areas, ReleaseAreaDocs)
	}

	if normalizeMultiline(previousApp.CustomHelmValues) != normalizeMultiline(updatedApp.CustomHelmValues) ||
		normalizeMultiline(previousApp.CustomComposeCommand) != normalizeMultiline(updatedApp.CustomComposeCommand) {
		areas = append(areas, ReleaseAreaDeployment)
	}

	if normalizeString(previousApp.Description) != normalizeString(updatedApp.Description) ||
		normalizeString(previousApp.License) != normalizeString(updatedApp.License) ||
		!slices.Equal(normalizeStringSlice(previousApp.Tags), normalizeStringSlice(updatedApp.Tags)) ||
		!equalLinks(previousApp.Repositories, updatedApp.Repositories) {
		areas = append(areas, ReleaseAreaMetadata)
	}

	slices.Sort(areas)
	return slices.Compact(areas)
}

func determineReleaseType(changedAreas []string) string {
	if slices.Contains(changedAreas, ReleaseAreaDeployment) || slices.Contains(changedAreas, ReleaseAreaMetadata) {
		return "minor"
	}
	return "patch"
}

func buildReleaseText(changedAreas []string) (string, string) {
	hasDocs := slices.Contains(changedAreas, ReleaseAreaDocs)
	hasDeployment := slices.Contains(changedAreas, ReleaseAreaDeployment)
	hasMetadata := slices.Contains(changedAreas, ReleaseAreaMetadata)

	switch {
	case hasDocs && hasDeployment && hasMetadata:
		return "Dokumentation, Deployment und Metadaten aktualisiert", "Dokumentation, Deployment-Konfiguration und Metadaten wurden automatisch aus dem Repository aktualisiert."
	case hasDeployment && hasMetadata:
		return "Deployment und Metadaten aktualisiert", "Deployment-Konfiguration und Metadaten wurden automatisch aus dem Repository aktualisiert."
	case hasDocs && hasDeployment:
		return "Dokumentation und Deployment aktualisiert", "Dokumentation und Deployment-Konfiguration wurden automatisch aus dem Repository aktualisiert."
	case hasDocs && hasMetadata:
		return "Dokumentation und Metadaten aktualisiert", "Dokumentation und Metadaten wurden automatisch aus dem Repository aktualisiert."
	case hasDeployment:
		return "Deployment-Konfiguration aktualisiert", "Deployment-Konfiguration wurde automatisch aus dem Repository aktualisiert."
	case hasMetadata:
		return "Metadaten aktualisiert", "Metadaten wurden automatisch aus dem Repository aktualisiert."
	default:
		return "Dokumentation aktualisiert", "Dokumentation wurde automatisch aus dem Repository aktualisiert."
	}
}

func bumpVersion(currentVersion, releaseType string) string {
	major, minor, patch := parseSemver(currentVersion)
	if major == 0 && minor == 0 && patch == 0 {
		major = 1
	}

	if releaseType == "minor" {
		minor++
		patch = 0
	} else {
		patch++
	}

	return fmt.Sprintf("%d.%d.%d", major, minor, patch)
}

func parseSemver(version string) (int, int, int) {
	trimmed := strings.TrimSpace(version)
	if trimmed == "" {
		return 0, 0, 0
	}

	var major, minor, patch int
	if _, err := fmt.Sscanf(trimmed, "%d.%d.%d", &major, &minor, &patch); err != nil {
		return 0, 0, 0
	}

	return major, minor, patch
}

func buildFingerprint(app models.Apps, changedAreas []string) string {
	payload := strings.Join([]string{
		app.ID,
		strings.Join(changedAreas, ","),
		normalizeMultiline(app.MarkdownContent),
		normalizeMultiline(app.CustomHelmValues),
		normalizeMultiline(app.CustomComposeCommand),
		normalizeString(app.Description),
		normalizeString(app.License),
		strings.Join(normalizeStringSlice(app.Tags), ","),
		flattenLinks(app.Repositories),
	}, "\n")

	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func buildChangeDetails(previousApp, updatedApp models.Apps) []models.ReleaseChangeDetail {
	details := make([]models.ReleaseChangeDetail, 0, 6)

	if normalizeMultiline(previousApp.MarkdownContent) != normalizeMultiline(updatedApp.MarkdownContent) {
		diff := buildLineDiff("README", previousApp.MarkdownContent, updatedApp.MarkdownContent)
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaDocs,
			Field:      "markdownContent",
			Label:      "README",
			Language:   "markdown",
			Preview:    summarizeDiffLines(diff),
			Diff:       diff,
			BeforeText: normalizeMultiline(previousApp.MarkdownContent),
			AfterText:  normalizeMultiline(updatedApp.MarkdownContent),
		})
	}

	if normalizeMultiline(previousApp.CustomHelmValues) != normalizeMultiline(updatedApp.CustomHelmValues) {
		diff := buildLineDiff("Helm Values", previousApp.CustomHelmValues, updatedApp.CustomHelmValues)
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaDeployment,
			Field:      "customHelmValues",
			Label:      "Helm Values",
			Language:   "yaml",
			Preview:    summarizeDiffLines(diff),
			Diff:       diff,
			BeforeText: normalizeMultiline(previousApp.CustomHelmValues),
			AfterText:  normalizeMultiline(updatedApp.CustomHelmValues),
		})
	}

	if normalizeMultiline(previousApp.CustomComposeCommand) != normalizeMultiline(updatedApp.CustomComposeCommand) {
		diff := buildLineDiff("Compose", previousApp.CustomComposeCommand, updatedApp.CustomComposeCommand)
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaDeployment,
			Field:      "customComposeCommand",
			Label:      "Compose",
			Language:   "yaml",
			Preview:    summarizeDiffLines(diff),
			Diff:       diff,
			BeforeText: normalizeMultiline(previousApp.CustomComposeCommand),
			AfterText:  normalizeMultiline(updatedApp.CustomComposeCommand),
		})
	}

	if normalizeString(previousApp.Description) != normalizeString(updatedApp.Description) {
		diff := buildScalarDiff("Beschreibung", previousApp.Description, updatedApp.Description)
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaMetadata,
			Field:      "description",
			Label:      "Beschreibung",
			Language:   "text",
			Preview:    "Beschreibung aktualisiert",
			Diff:       diff,
			BeforeText: normalizeString(previousApp.Description),
			AfterText:  normalizeString(updatedApp.Description),
		})
	}

	if normalizeString(previousApp.License) != normalizeString(updatedApp.License) {
		diff := buildScalarDiff("Lizenz", previousApp.License, updatedApp.License)
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaMetadata,
			Field:      "license",
			Label:      "Lizenz",
			Language:   "text",
			Preview:    "Lizenz aktualisiert",
			Diff:       diff,
			BeforeText: normalizeString(previousApp.License),
			AfterText:  normalizeString(updatedApp.License),
		})
	}

	if !slices.Equal(normalizeStringSlice(previousApp.Tags), normalizeStringSlice(updatedApp.Tags)) {
		diff := buildScalarDiff("Tags", strings.Join(normalizeStringSlice(previousApp.Tags), ", "), strings.Join(normalizeStringSlice(updatedApp.Tags), ", "))
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaMetadata,
			Field:      "tags",
			Label:      "Tags",
			Language:   "text",
			Preview:    "Tags aktualisiert",
			Diff:       diff,
			BeforeText: strings.Join(normalizeStringSlice(previousApp.Tags), ", "),
			AfterText:  strings.Join(normalizeStringSlice(updatedApp.Tags), ", "),
		})
	}

	if !equalLinks(previousApp.Repositories, updatedApp.Repositories) {
		diff := buildScalarDiff("Repository-Links", flattenLinks(previousApp.Repositories), flattenLinks(updatedApp.Repositories))
		details = append(details, models.ReleaseChangeDetail{
			Area:       ReleaseAreaMetadata,
			Field:      "repositories",
			Label:      "Repository-Links",
			Language:   "text",
			Preview:    "Repository-Link aktualisiert",
			Diff:       diff,
			BeforeText: flattenLinks(previousApp.Repositories),
			AfterText:  flattenLinks(updatedApp.Repositories),
		})
	}

	return details
}

func buildDiffPreview(details []models.ReleaseChangeDetail) string {
	if len(details) == 0 {
		return ""
	}
	previews := make([]string, 0, min(2, len(details)))
	for _, detail := range details {
		if strings.TrimSpace(detail.Preview) == "" {
			continue
		}
		previews = append(previews, detail.Preview)
		if len(previews) == 2 {
			break
		}
	}
	return strings.Join(previews, " · ")
}

func fanOutInboxItems(ctx context.Context, tx bun.Tx, app models.Apps, release models.AppRelease) error {
	recipients, err := collectRecipientReasons(ctx, tx, app)
	if err != nil {
		return err
	}

	if len(recipients) == 0 {
		return nil
	}

	items := make([]models.UserReleaseInboxItem, 0, len(recipients))
	now := time.Now().UTC()
	for userID, reason := range recipients {
		items = append(items, models.UserReleaseInboxItem{
			UserID:    userID,
			ReleaseID: release.ID,
			AppID:     app.ID,
			Reason:    reason,
			CreatedAt: now,
		})
	}

	_, err = tx.NewInsert().
		Model(&items).
		On("CONFLICT (user_id, release_id) DO NOTHING").
		Exec(ctx)
	return err
}

func collectRecipientReasons(ctx context.Context, tx bun.Tx, app models.Apps) (map[uuid.UUID]string, error) {
	type reasonRow struct {
		UserID uuid.UUID `bun:"user_id"`
		Reason string    `bun:"reason"`
	}

	var rows []reasonRow
	err := tx.NewRaw(`
		WITH candidate_reasons AS (
			SELECT uf.user_id AS user_id, 'favorite' AS reason
			FROM user_favorites AS uf
			LEFT JOIN user_update_preferences AS pref ON pref.user_id = uf.user_id
			WHERE uf.app_id = ?
			  AND COALESCE(pref.notify_favorited_apps, TRUE)
			UNION
			SELECT urva.user_id AS user_id, 'recently_viewed' AS reason
			FROM user_recently_viewed_apps AS urva
			LEFT JOIN user_update_preferences AS pref ON pref.user_id = urva.user_id
			WHERE urva.app_id = ?
			  AND COALESCE(pref.notify_recently_viewed_apps, TRUE)
			UNION
			SELECT a.owner_id AS user_id, 'owned' AS reason
			FROM apps AS a
			LEFT JOIN user_update_preferences AS pref ON pref.user_id = a.owner_id
			WHERE a.id = ?
			  AND a.owner_id IS NOT NULL
			  AND COALESCE(pref.notify_owned_managed_apps, TRUE)
			UNION
			SELECT ae.user_id AS user_id, 'owned' AS reason
			FROM app_editors AS ae
			LEFT JOIN user_update_preferences AS pref ON pref.user_id = ae.user_id
			WHERE ae.app_id = ?
			  AND COALESCE(pref.notify_owned_managed_apps, TRUE)
		)
		SELECT cr.user_id, MIN(cr.reason) AS reason
		FROM candidate_reasons AS cr
		JOIN users AS u ON u.id = cr.user_id
		GROUP BY cr.user_id
	`, app.ID, app.ID, app.ID, app.ID).Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}

	recipients := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		recipients[row.UserID] = row.Reason
	}

	return recipients, nil
}

func normalizeString(value string) string {
	return strings.TrimSpace(value)
}

func normalizeMultiline(value string) string {
	return strings.TrimSpace(strings.ReplaceAll(value, "\r\n", "\n"))
}

func normalizeStringSlice(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := normalizeString(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	slices.Sort(normalized)
	return normalized
}

func equalLinks(previous, updated []models.AppLink) bool {
	return flattenLinks(previous) == flattenLinks(updated)
}

func flattenLinks(links []models.AppLink) string {
	normalized := make([]string, 0, len(links))
	for _, link := range links {
		label := normalizeString(link.Label)
		url := normalizeString(link.URL)
		if label == "" && url == "" {
			continue
		}
		normalized = append(normalized, label+"|"+url)
	}
	slices.Sort(normalized)
	return strings.Join(normalized, ",")
}

func buildScalarDiff(label, before, after string) string {
	return fmt.Sprintf("--- %s (alt)\n+++ %s (neu)\n-%s\n+%s", label, label, strings.TrimSpace(before), strings.TrimSpace(after))
}

func buildLineDiff(label, before, after string) string {
	beforeLines := splitLines(before)
	afterLines := splitLines(after)
	diffLines := []string{
		fmt.Sprintf("--- %s (alt)", label),
		fmt.Sprintf("+++ %s (neu)", label),
	}

	ops := diffOperations(beforeLines, afterLines)
	hunks := buildUnifiedHunks(ops, 3)
	if len(hunks) == 0 {
		return strings.Join(diffLines, "\n")
	}

	for _, hunk := range hunks {
		diffLines = append(diffLines, fmt.Sprintf(
			"@@ -%d,%d +%d,%d @@",
			hunk.oldStart,
			hunk.oldCount,
			hunk.newStart,
			hunk.newCount,
		))
		for _, line := range hunk.lines {
			diffLines = append(diffLines, line)
		}
	}

	return strings.Join(diffLines, "\n")
}

func summarizeDiffLines(diff string) string {
	lines := strings.Split(diff, "\n")
	added := 0
	removed := 0
	for _, line := range lines {
		if strings.HasPrefix(line, "+++") || strings.HasPrefix(line, "---") || strings.HasPrefix(line, "@@") {
			continue
		}
		if strings.HasPrefix(line, "+") {
			added++
		}
		if strings.HasPrefix(line, "-") {
			removed++
		}
	}
	return fmt.Sprintf("%d Ergänzungen, %d Entfernungen", added, removed)
}

func splitLines(value string) []string {
	normalized := normalizeMultiline(value)
	if normalized == "" {
		return []string{}
	}
	return strings.Split(normalized, "\n")
}

type diffOp struct {
	kind    byte
	oldLine int
	newLine int
	text    string
}

type unifiedHunk struct {
	oldStart int
	oldCount int
	newStart int
	newCount int
	lines    []string
}

func diffOperations(beforeLines, afterLines []string) []diffOp {
	m := len(beforeLines)
	n := len(afterLines)
	lcs := make([][]int, m+1)
	for i := range lcs {
		lcs[i] = make([]int, n+1)
	}

	for i := m - 1; i >= 0; i-- {
		for j := n - 1; j >= 0; j-- {
			if beforeLines[i] == afterLines[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else if lcs[i+1][j] >= lcs[i][j+1] {
				lcs[i][j] = lcs[i+1][j]
			} else {
				lcs[i][j] = lcs[i][j+1]
			}
		}
	}

	ops := make([]diffOp, 0, m+n)
	i, j := 0, 0
	oldLine, newLine := 1, 1
	for i < m && j < n {
		if beforeLines[i] == afterLines[j] {
			ops = append(ops, diffOp{kind: ' ', oldLine: oldLine, newLine: newLine, text: beforeLines[i]})
			i++
			j++
			oldLine++
			newLine++
			continue
		}
		if lcs[i+1][j] >= lcs[i][j+1] {
			ops = append(ops, diffOp{kind: '-', oldLine: oldLine, newLine: newLine, text: beforeLines[i]})
			i++
			oldLine++
			continue
		}
		ops = append(ops, diffOp{kind: '+', oldLine: oldLine, newLine: newLine, text: afterLines[j]})
		j++
		newLine++
	}

	for i < m {
		ops = append(ops, diffOp{kind: '-', oldLine: oldLine, newLine: newLine, text: beforeLines[i]})
		i++
		oldLine++
	}
	for j < n {
		ops = append(ops, diffOp{kind: '+', oldLine: oldLine, newLine: newLine, text: afterLines[j]})
		j++
		newLine++
	}

	return ops
}

func buildUnifiedHunks(ops []diffOp, contextLines int) []unifiedHunk {
	changeIndexes := make([]int, 0)
	for index, op := range ops {
		if op.kind != ' ' {
			changeIndexes = append(changeIndexes, index)
		}
	}
	if len(changeIndexes) == 0 {
		return nil
	}

	type rawRange struct{ start, end int }
	ranges := make([]rawRange, 0, len(changeIndexes))
	current := rawRange{
		start: max(0, changeIndexes[0]-contextLines),
		end:   min(len(ops)-1, changeIndexes[0]+contextLines),
	}
	for _, changeIndex := range changeIndexes[1:] {
		start := max(0, changeIndex-contextLines)
		end := min(len(ops)-1, changeIndex+contextLines)
		if start <= current.end+1 {
			current.end = max(current.end, end)
			continue
		}
		ranges = append(ranges, current)
		current = rawRange{start: start, end: end}
	}
	ranges = append(ranges, current)

	hunks := make([]unifiedHunk, 0, len(ranges))
	for _, diffRange := range ranges {
		slice := ops[diffRange.start : diffRange.end+1]
		oldStart := 0
		newStart := 0
		oldCount := 0
		newCount := 0
		lines := make([]string, 0, len(slice))

		for idx, op := range slice {
			if idx == 0 {
				oldStart = op.oldLine
				newStart = op.newLine
			}
			lines = append(lines, string(op.kind)+op.text)
			if op.kind != '+' {
				oldCount++
			}
			if op.kind != '-' {
				newCount++
			}
		}

		if oldCount == 0 {
			oldStart = slice[0].oldLine
		}
		if newCount == 0 {
			newStart = slice[0].newLine
		}

		hunks = append(hunks, unifiedHunk{
			oldStart: oldStart,
			oldCount: oldCount,
			newStart: newStart,
			newCount: newCount,
			lines:    lines,
		})
	}

	return hunks
}
