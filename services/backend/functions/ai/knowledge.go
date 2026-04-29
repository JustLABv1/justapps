package ai

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

const defaultChunkSize = 3600

func ReindexAll(ctx context.Context, db *bun.DB) (int, error) {
	apps := make([]models.Apps, 0)
	if err := db.NewSelect().Model(&apps).Scan(ctx); err != nil {
		return 0, err
	}
	for _, app := range apps {
		if err := ReindexApp(ctx, db, app.ID); err != nil {
			return 0, err
		}
	}
	return len(apps), nil
}

func ReindexApp(ctx context.Context, db *bun.DB, appID string) error {
	appID = strings.TrimSpace(appID)
	if appID == "" {
		return nil
	}

	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("id = ?", appID).Scan(ctx); err != nil {
		if err == sql.ErrNoRows {
			return DeleteAppChunks(ctx, db, appID)
		}
		return err
	}

	chunks := BuildKnowledgeChunks(app)
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().Model((*models.AIKnowledgeChunk)(nil)).Where("app_id = ?", appID).Exec(ctx); err != nil {
			return err
		}
		if len(chunks) == 0 {
			return nil
		}
		_, err := tx.NewInsert().Model(&chunks).Exec(ctx)
		return err
	})
}

func DeleteAppChunks(ctx context.Context, db *bun.DB, appID string) error {
	if strings.TrimSpace(appID) == "" {
		return nil
	}
	_, err := db.NewDelete().Model((*models.AIKnowledgeChunk)(nil)).Where("app_id = ?", strings.TrimSpace(appID)).Exec(ctx)
	return err
}

func BuildKnowledgeChunks(app models.Apps) []models.AIKnowledgeChunk {
	sections := []struct {
		SourceType string
		SourceID   string
		Title      string
		Content    string
	}{
		{SourceType: "app-summary", SourceID: "summary", Title: app.Name + " - Übersicht", Content: buildAppSummary(app)},
		{SourceType: "readme", SourceID: "markdown-content", Title: app.Name + " - README", Content: app.MarkdownContent},
		{SourceType: "helm-values", SourceID: "custom-helm-values", Title: app.Name + " - Helm Values", Content: app.CustomHelmValues},
		{SourceType: "compose", SourceID: "custom-compose-command", Title: app.Name + " - Docker Compose", Content: app.CustomComposeCommand},
		{SourceType: "docker", SourceID: "custom-docker-command", Title: app.Name + " - Docker", Content: app.CustomDockerCommand},
		{SourceType: "deployment-variants", SourceID: "deployment-variants", Title: app.Name + " - Deployment Varianten", Content: buildDeploymentVariants(app.DeploymentVariants)},
		{SourceType: "custom-fields", SourceID: "custom-fields", Title: app.Name + " - Fachliche Details", Content: buildCustomFields(app.CustomFields)},
		{SourceType: "reuse", SourceID: "reuse-requirements", Title: app.Name + " - Nachnutzung", Content: app.ReuseRequirements},
		{SourceType: "release", SourceID: "version-changelog", Title: app.Name + " - Version und Changelog", Content: buildReleaseInfo(app)},
		{SourceType: "links", SourceID: "links", Title: app.Name + " - Links", Content: buildLinks(app)},
	}

	now := time.Now().UTC()
	chunks := make([]models.AIKnowledgeChunk, 0)
	for _, section := range sections {
		content := strings.TrimSpace(section.Content)
		if content == "" {
			continue
		}
		parts := splitContent(content, defaultChunkSize)
		for index, part := range parts {
			contentHash := hashContent(part)
			sourceID := section.SourceID
			if len(parts) > 1 {
				sourceID = fmt.Sprintf("%s:%d", sourceID, index+1)
			}
			chunks = append(chunks, models.AIKnowledgeChunk{
				AppID:           app.ID,
				AppName:         app.Name,
				SourceType:      section.SourceType,
				SourceID:        sourceID,
				Title:           section.Title,
				Content:         part,
				SearchText:      buildSearchText(app, section.Title, part),
				Metadata:        map[string]string{"appStatus": app.Status},
				ContentHash:     contentHash,
				SourceUpdatedAt: app.UpdatedAt,
				IndexedAt:       now,
			})
		}
	}
	return chunks
}

func RetrieveContext(ctx context.Context, db *bun.DB, viewer Viewer, query RetrievalQuery) (RetrievedContext, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = 8
	}
	if limit > 20 {
		limit = 20
	}

	chunks := make([]models.AIKnowledgeChunk, 0, limit)
	selectQuery := db.NewSelect().
		Model(&chunks).
		Join("JOIN apps AS a ON a.id = aikc.app_id").
		Limit(limit)

	if viewer.Role != "admin" {
		if viewer.HasUser && strings.TrimSpace(viewer.UserID) != "" {
			selectQuery = selectQuery.Where("(a.status IS NULL OR a.status = '' OR LOWER(a.status) NOT IN ('draft', 'entwurf') OR a.owner_id::text = ?)", viewer.UserID)
		} else {
			selectQuery = selectQuery.Where("(a.status IS NULL OR a.status = '' OR LOWER(a.status) NOT IN ('draft', 'entwurf'))")
		}
	}

	text := strings.TrimSpace(query.Text)
	terms := searchTerms(text)
	if len(terms) > 0 {
		clauses := make([]string, 0, len(terms)*3)
		args := make([]interface{}, 0, len(terms)*3)
		for _, term := range terms {
			pattern := "%" + term + "%"
			clauses = append(clauses, "LOWER(aikc.search_text) LIKE ?", "LOWER(a.name) LIKE ?", "LOWER(a.description) LIKE ?")
			args = append(args, pattern, pattern, pattern)
		}
		selectQuery = selectQuery.Where("("+strings.Join(clauses, " OR ")+")", args...)
	}

	if strings.TrimSpace(query.AppID) != "" {
		selectQuery = selectQuery.OrderExpr("CASE WHEN aikc.app_id = ? THEN 0 ELSE 1 END", strings.TrimSpace(query.AppID))
	}
	if text != "" {
		selectQuery = selectQuery.OrderExpr("ts_rank(to_tsvector('simple', aikc.search_text), plainto_tsquery('simple', ?)) DESC", text)
	}
	selectQuery = selectQuery.OrderExpr("aikc.indexed_at DESC")

	if err := selectQuery.Scan(ctx); err != nil {
		return RetrievedContext{}, err
	}

	if len(chunks) == 0 && strings.TrimSpace(query.AppID) != "" {
		fallback := db.NewSelect().
			Model(&chunks).
			Join("JOIN apps AS a ON a.id = aikc.app_id").
			Where("aikc.app_id = ?", strings.TrimSpace(query.AppID)).
			OrderExpr("aikc.indexed_at DESC").
			Limit(limit)
		if viewer.Role != "admin" {
			fallback = fallback.Where("(a.status IS NULL OR a.status = '' OR LOWER(a.status) NOT IN ('draft', 'entwurf') OR a.owner_id::text = ?)", viewer.UserID)
		}
		if err := fallback.Scan(ctx); err != nil {
			return RetrievedContext{}, err
		}
	}

	sources := SourcesFromChunks(chunks)
	return RetrievedContext{Chunks: chunks, Sources: sources}, nil
}

func AppIsViewable(ctx context.Context, db *bun.DB, appID string, viewer Viewer) (bool, error) {
	if strings.TrimSpace(appID) == "" {
		return true, nil
	}
	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("id = ?", strings.TrimSpace(appID)).Scan(ctx); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	if viewer.Role == "admin" {
		return true, nil
	}
	status := strings.ToLower(strings.TrimSpace(app.Status))
	if status != "draft" && status != "entwurf" {
		return true, nil
	}
	return viewer.HasUser && strings.TrimSpace(viewer.UserID) != "" && app.OwnerID.String() == viewer.UserID, nil
}

func SourcesFromChunks(chunks []models.AIKnowledgeChunk) []models.AIMessageSource {
	sources := make([]models.AIMessageSource, 0, len(chunks))
	seen := make(map[string]struct{}, len(chunks))
	for _, chunk := range chunks {
		key := chunk.AppID + "|" + chunk.SourceType + "|" + chunk.SourceID
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		sources = append(sources, models.AIMessageSource{
			AppID:      chunk.AppID,
			AppName:    chunk.AppName,
			ChunkID:    chunk.ID.String(),
			SourceType: chunk.SourceType,
			SourceID:   chunk.SourceID,
			Title:      chunk.Title,
			Snippet:    trimRunes(strings.TrimSpace(chunk.Content), 280),
		})
	}
	return sources
}

func BuildPromptMessages(question string, history []models.AIMessage, chunks []models.AIKnowledgeChunk, maxContextTokens int) []ChatMessage {
	contextLimit := maxContextTokens * 4
	if contextLimit <= 0 {
		contextLimit = 24000
	}

	contextBuilder := strings.Builder{}
	for index, chunk := range chunks {
		entry := fmt.Sprintf("Quelle %d: %s (%s, App: %s)\n%s\n\n", index+1, chunk.Title, chunk.SourceType, chunk.AppName, strings.TrimSpace(chunk.Content))
		if contextBuilder.Len()+len(entry) > contextLimit {
			break
		}
		contextBuilder.WriteString(entry)
	}

	systemPrompt := `Du bist der JustApps AI Chat. Beantworte Fragen zu Apps, Konfiguration, Deployment, Nachnutzung und Repository-Dokumentation.
Nutze bevorzugt den bereitgestellten JustApps-Kontext. Wenn der Kontext nicht reicht, sage das klar und schlage vor, welche App-Daten oder Repository-Quellen fehlen.
Antworte in der Sprache der Nutzerfrage. Nenne relevante App- oder Quellentitel im Text, aber erfinde keine Quellen, Versionen oder Konfigurationswerte.`
	if strings.TrimSpace(contextBuilder.String()) != "" {
		systemPrompt += "\n\nJustApps-Kontext:\n" + contextBuilder.String()
	}

	messages := []ChatMessage{{Role: "system", Content: systemPrompt}}
	for _, message := range lastMessages(history, 12) {
		if message.Role != "user" && message.Role != "assistant" {
			continue
		}
		if strings.TrimSpace(message.Content) == "" {
			continue
		}
		messages = append(messages, ChatMessage{Role: message.Role, Content: message.Content})
	}
	messages = append(messages, ChatMessage{Role: "user", Content: question})
	return messages
}

func buildAppSummary(app models.Apps) string {
	lines := []string{
		"Name: " + app.Name,
		"Beschreibung: " + app.Description,
		"Status: " + app.Status,
		"Lizenz: " + app.License,
		"Kategorien: " + strings.Join(app.Categories, ", "),
		"Tags: " + strings.Join(app.Tags, ", "),
		"Tech Stack: " + strings.Join(app.TechStack, ", "),
		"Collections: " + strings.Join(app.Collections, ", "),
	}
	if app.LiveUrl != "" {
		lines = append(lines, "Live URL: "+app.LiveUrl)
	}
	if app.DocsUrl != "" {
		lines = append(lines, "Docs URL: "+app.DocsUrl)
	}
	if app.HelmRepo != "" {
		lines = append(lines, "Helm Repository: "+app.HelmRepo)
	}
	if app.DockerRepo != "" {
		lines = append(lines, "Docker Repository: "+app.DockerRepo)
	}
	return strings.Join(filterBlankLines(lines), "\n")
}

func buildCustomFields(fields []models.AppField) string {
	lines := make([]string, 0, len(fields))
	for _, field := range fields {
		if strings.TrimSpace(field.Key) == "" && strings.TrimSpace(field.Value) == "" {
			continue
		}
		lines = append(lines, strings.TrimSpace(field.Key)+": "+strings.TrimSpace(field.Value))
	}
	return strings.Join(lines, "\n")
}

func buildDeploymentVariants(variants []models.DeploymentVariant) string {
	lines := make([]string, 0)
	for _, variant := range variants {
		parts := []string{variant.Name, variant.Description, variant.DockerCommand, variant.DockerNote, variant.ComposeCommand, variant.ComposeNote, variant.HelmCommand, variant.HelmNote, variant.HelmValues}
		lines = append(lines, strings.Join(filterBlankLines(parts), "\n"))
	}
	return strings.Join(filterBlankLines(lines), "\n\n")
}

func buildReleaseInfo(app models.Apps) string {
	return strings.Join(filterBlankLines([]string{"Version: " + app.Version, "Changelog:\n" + app.Changelog}), "\n")
}

func buildLinks(app models.Apps) string {
	lines := make([]string, 0)
	appendLinks := func(title string, links []models.AppLink) {
		for _, link := range links {
			if strings.TrimSpace(link.URL) == "" {
				continue
			}
			label := strings.TrimSpace(link.Label)
			if label == "" {
				label = title
			}
			lines = append(lines, label+": "+strings.TrimSpace(link.URL))
		}
	}
	appendLinks("Repository", app.Repositories)
	appendLinks("Link", app.CustomLinks)
	for _, demo := range app.LiveDemos {
		if strings.TrimSpace(demo.URL) != "" {
			lines = append(lines, strings.TrimSpace(demo.Label)+": "+strings.TrimSpace(demo.URL))
		}
	}
	return strings.Join(lines, "\n")
}

func buildSearchText(app models.Apps, title, content string) string {
	parts := []string{app.Name, app.Description, title, content}
	parts = append(parts, app.Categories...)
	parts = append(parts, app.Tags...)
	parts = append(parts, app.TechStack...)
	return strings.ToLower(strings.Join(filterBlankLines(parts), " "))
}

func searchTerms(query string) []string {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return nil
	}

	seen := make(map[string]struct{})
	terms := make([]string, 0, 8)
	for _, term := range strings.FieldsFunc(query, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	}) {
		term = strings.TrimSpace(term)
		if len([]rune(term)) < 3 {
			continue
		}
		if _, exists := seen[term]; exists {
			continue
		}
		seen[term] = struct{}{}
		terms = append(terms, term)
		if len(terms) >= 8 {
			break
		}
	}

	if len(terms) == 0 {
		return []string{query}
	}
	return terms
}

func splitContent(content string, size int) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}
	if utf8.RuneCountInString(content) <= size {
		return []string{content}
	}

	runes := []rune(content)
	parts := make([]string, 0, len(runes)/size+1)
	for start := 0; start < len(runes); start += size {
		end := start + size
		if end > len(runes) {
			end = len(runes)
		}
		parts = append(parts, strings.TrimSpace(string(runes[start:end])))
	}
	return parts
}

func hashContent(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func filterBlankLines(values []string) []string {
	filtered := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" && trimmed != ":" {
			filtered = append(filtered, trimmed)
		}
	}
	return filtered
}

func trimRunes(value string, limit int) string {
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return strings.TrimSpace(string(runes[:limit])) + "..."
}

func lastMessages(messages []models.AIMessage, limit int) []models.AIMessage {
	if limit <= 0 || len(messages) <= limit {
		return messages
	}
	return messages[len(messages)-limit:]
}
