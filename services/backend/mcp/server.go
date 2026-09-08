package mcp

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	apphandlers "justapps-backend/handlers/apps"
	"justapps-backend/pkg/models"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/uptrace/bun"
)

const (
	catalogResourceURI      = "justapps://catalog"
	defaultSearchLimit      = 20
	maxSearchLimit          = 50
	maxCatalogResourceItems = 500
)

// ErrAppNotFound is returned when an app is not part of the public catalog.
// Draft apps intentionally behave like missing apps for MCP callers.
var ErrAppNotFound = errors.New("app not found")

// SearchAppsInput is the input accepted by the search_apps MCP tool.
type SearchAppsInput struct {
	Query     string `json:"query,omitempty" jsonschema:"free-text search across app metadata and indexed repository content"`
	Category  string `json:"category,omitempty" jsonschema:"optional category that must match the app catalog"`
	TechStack string `json:"techStack,omitempty" jsonschema:"optional technology or framework filter"`
	Status    string `json:"status,omitempty" jsonschema:"optional app status filter, for example active, beta, or deprecated"`
	Limit     int    `json:"limit,omitempty" jsonschema:"maximum number of results to return; defaults to 20 and must be between 1 and 50"`
}

// SearchAppsOutput is intentionally compact so agents can use it for discovery.
type SearchAppsOutput struct {
	Apps     []AppSummary `json:"apps"`
	Total    int          `json:"total"`
	Returned int          `json:"returned"`
}

// GetAppInput is the input accepted by the get_app MCP tool.
type GetAppInput struct {
	ID string `json:"id" jsonschema:"stable JustApps app ID, for example my-app"`
}

// AppSummary contains only catalog-safe fields. In particular, it does not
// include the owner relation, internal sync state, permissions, or credentials.
type AppSummary struct {
	ID                     string   `json:"id"`
	Name                   string   `json:"name"`
	Description            string   `json:"description,omitempty"`
	Categories             []string `json:"categories,omitempty"`
	TechStack              []string `json:"techStack,omitempty"`
	Tags                   []string `json:"tags,omitempty"`
	Collections            []string `json:"collections,omitempty"`
	Status                 string   `json:"status,omitempty"`
	Version                string   `json:"version,omitempty"`
	License                string   `json:"license,omitempty"`
	LiveURL                string   `json:"liveUrl,omitempty"`
	DocsURL                string   `json:"docsUrl,omitempty"`
	RepoURL                string   `json:"repoUrl,omitempty"`
	IsFeatured             bool     `json:"isFeatured"`
	RatingAverage          float64  `json:"ratingAverage"`
	RatingCount            int      `json:"ratingCount"`
	IsReuse                bool     `json:"isReuse"`
	HasDeploymentAssistant bool     `json:"hasDeploymentAssistant"`
}

// AppDetails contains the public catalog entry and deployment/documentation
// information useful to an agent. Sensitive account and provider data is not
// included even though it exists on the database model.
type AppDetails struct {
	AppSummary
	Icon                 string                      `json:"icon,omitempty"`
	LiveDemos            []models.LiveDemo           `json:"liveDemos,omitempty"`
	Repositories         []models.AppLink            `json:"repositories,omitempty"`
	CustomLinks          []models.AppLink            `json:"customLinks,omitempty"`
	HelmRepository       string                      `json:"helmRepository,omitempty"`
	DockerRepository     string                      `json:"dockerRepository,omitempty"`
	MarkdownContent      string                      `json:"markdownContent,omitempty"`
	CustomFields         []models.AppField           `json:"customFields,omitempty"`
	ReuseRequirements    string                      `json:"reuseRequirements,omitempty"`
	DeploymentVariants   []models.DeploymentVariant  `json:"deploymentVariants,omitempty"`
	ShowDocker           bool                        `json:"showDocker"`
	ShowCompose          bool                        `json:"showCompose"`
	ShowHelm             bool                        `json:"showHelm"`
	CustomDockerCommand  string                      `json:"customDockerCommand,omitempty"`
	CustomComposeCommand string                      `json:"customComposeCommand,omitempty"`
	CustomHelmCommand    string                      `json:"customHelmCommand,omitempty"`
	CustomDockerNote     string                      `json:"customDockerNote,omitempty"`
	CustomComposeNote    string                      `json:"customComposeNote,omitempty"`
	CustomHelmNote       string                      `json:"customHelmNote,omitempty"`
	CustomHelmValues     string                      `json:"customHelmValues,omitempty"`
	Changelog            string                      `json:"changelog,omitempty"`
	RelatedApps          []models.AppRelationSummary `json:"relatedApps,omitempty"`
	AppGroups            []models.AppGroupSummary    `json:"appGroups,omitempty"`
	CreatedAt            string                      `json:"createdAt,omitempty"`
	UpdatedAt            string                      `json:"updatedAt,omitempty"`
}

type catalogReader struct {
	db *bun.DB
}

// NewHandler creates the authenticated JustApps MCP Streamable HTTP handler.
// The handler is stateless so it can be used behind a load balancer without
// sticky sessions; each request is authenticated by the surrounding router.
func NewHandler(db *bun.DB) http.Handler {
	reader := catalogReader{db: db}
	server := newServer(reader)
	streamableHandler := mcpsdk.NewStreamableHTTPHandler(
		func(_ *http.Request) *mcpsdk.Server {
			return server
		},
		&mcpsdk.StreamableHTTPOptions{
			Stateless:                    true,
			JSONResponse:                 true,
			MaxRequestBodyBytes:          1 << 20,
			PropagateRequestCancellation: true,
		},
	)

	// MCP servers must protect HTTP transports against cross-origin browser
	// requests. Requests from non-browser agents without Origin are allowed.
	return http.NewCrossOriginProtection().Handler(streamableHandler)
}

func newServer(reader catalogReader) *mcpsdk.Server {
	server := mcpsdk.NewServer(
		&mcpsdk.Implementation{
			Name:        "justapps",
			Title:       "JustApps",
			Description: "Read-only access to the JustApps application catalog.",
			Version:     "1.0.0",
		},
		&mcpsdk.ServerOptions{
			Instructions: "Use search_apps to discover published JustApps entries, then get_app for deployment instructions and full public metadata. Draft entries and account data are not exposed.",
			Capabilities: &mcpsdk.ServerCapabilities{},
		},
	)

	readOnly := true
	closedWorld := false
	annotations := &mcpsdk.ToolAnnotations{
		ReadOnlyHint:   true,
		IdempotentHint: true,
		OpenWorldHint:  &closedWorld,
	}

	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "search_apps",
		Title:       "Search JustApps catalog",
		Description: "Search published JustApps entries by free text, category, technology, or status.",
		Annotations: annotations,
	}, reader.search)
	mcpsdk.AddTool(server, &mcpsdk.Tool{
		Name:        "get_app",
		Title:       "Get JustApps entry",
		Description: "Read the full public metadata, documentation, links, and deployment instructions for one published JustApps entry.",
		Annotations: &mcpsdk.ToolAnnotations{
			ReadOnlyHint:   readOnly,
			IdempotentHint: true,
			OpenWorldHint:  &closedWorld,
		},
	}, reader.get)

	server.AddResource(&mcpsdk.Resource{
		URI:         catalogResourceURI,
		Name:        "catalog",
		Title:       "JustApps catalog",
		Description: "Compact JSON snapshot of all published JustApps entries.",
		MIMEType:    "application/json",
	}, reader.readCatalog)
	server.AddResourceTemplate(&mcpsdk.ResourceTemplate{
		URITemplate: "justapps://apps/{id}",
		Name:        "app",
		Title:       "JustApps app entry",
		Description: "JSON representation of one published JustApps entry.",
		MIMEType:    "application/json",
	}, reader.readApp)

	return server
}

func (r catalogReader) search(ctx context.Context, _ *mcpsdk.CallToolRequest, input SearchAppsInput) (*mcpsdk.CallToolResult, SearchAppsOutput, error) {
	limit, err := normalizeSearchLimit(input.Limit)
	if err != nil {
		return nil, SearchAppsOutput{}, err
	}

	apps, total, err := r.queryApps(ctx, input, limit)
	if err != nil {
		return nil, SearchAppsOutput{}, err
	}

	result := SearchAppsOutput{
		Apps:     make([]AppSummary, 0, len(apps)),
		Total:    total,
		Returned: len(apps),
	}
	for _, app := range apps {
		result.Apps = append(result.Apps, publicAppSummary(app))
	}
	return nil, result, nil
}

func (r catalogReader) get(ctx context.Context, _ *mcpsdk.CallToolRequest, input GetAppInput) (*mcpsdk.CallToolResult, AppDetails, error) {
	app, err := r.loadPublicApp(ctx, input.ID)
	if err != nil {
		return nil, AppDetails{}, err
	}

	details, err := r.publicAppDetails(ctx, app)
	if err != nil {
		return nil, AppDetails{}, err
	}
	return nil, details, nil
}

func (r catalogReader) queryApps(ctx context.Context, input SearchAppsInput, limit int) ([]models.Apps, int, error) {
	if r.db == nil {
		return nil, 0, errors.New("JustApps database is not configured")
	}

	apps := make([]models.Apps, 0)
	query := r.db.NewSelect().Model(&apps).
		Where("LOWER(TRIM(COALESCE(a.status, ''))) NOT IN ('draft', 'entwurf')")

	terms := searchTerms(input.Query)
	if len(terms) > 0 {
		clauses := make([]string, 0, len(terms))
		args := make([]any, 0, len(terms)*2)
		for _, term := range terms {
			pattern := "%" + escapeLike(strings.ToLower(term)) + "%"
			clauses = append(clauses, "("+searchableAppText+" LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM ai_knowledge_chunks kc WHERE kc.app_id = a.id AND LOWER(COALESCE(kc.search_text, '')) LIKE ? ESCAPE '\\'))")
			args = append(args, pattern, pattern)
		}
		query = query.Where("("+strings.Join(clauses, " OR ")+")", args...)
	}

	if category := strings.TrimSpace(input.Category); category != "" {
		query = query.Where("? = ANY(a.categories)", category)
	}
	if techStack := strings.TrimSpace(input.TechStack); techStack != "" {
		query = query.Where("? = ANY(a.tech_stack)", techStack)
	}
	if status := strings.TrimSpace(input.Status); status != "" {
		query = query.Where("LOWER(TRIM(COALESCE(a.status, ''))) = LOWER(?)", status)
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("counting JustApps entries: %w", err)
	}

	query = query.
		OrderExpr("a.is_featured DESC").
		OrderExpr("LOWER(a.name) ASC").
		OrderExpr("a.id ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Scan(ctx); err != nil {
		return nil, 0, fmt.Errorf("loading JustApps entries: %w", err)
	}
	return apps, total, nil
}

const searchableAppText = `LOWER(CONCAT_WS(' ',
	COALESCE(a.name, ''),
	COALESCE(a.description, ''),
	COALESCE(a.license, ''),
	COALESCE(array_to_string(a.categories, ' '), ''),
	COALESCE(array_to_string(a.tech_stack, ' '), ''),
	COALESCE(array_to_string(a.tags, ' '), ''),
	COALESCE(array_to_string(a.collections, ' '), ''),
	COALESCE(a.custom_fields::text, ''),
	COALESCE(a.markdown_content, ''),
	CASE WHEN a.has_deployment_assistant AND a.show_docker THEN COALESCE(a.custom_docker_command, '') ELSE '' END,
	CASE WHEN a.has_deployment_assistant AND a.show_compose THEN COALESCE(a.custom_compose_command, '') ELSE '' END,
	CASE WHEN a.has_deployment_assistant AND a.show_helm THEN COALESCE(a.custom_helm_command, '') ELSE '' END,
	COALESCE(a.reuse_requirements, '')
))`

func (r catalogReader) loadPublicApp(ctx context.Context, id string) (models.Apps, error) {
	trimmedID := strings.TrimSpace(id)
	if trimmedID == "" {
		return models.Apps{}, errors.New("id is required")
	}
	if r.db == nil {
		return models.Apps{}, errors.New("JustApps database is not configured")
	}

	var app models.Apps
	err := r.db.NewSelect().Model(&app).
		Where("a.id = ?", trimmedID).
		Where("LOWER(TRIM(COALESCE(a.status, ''))) NOT IN ('draft', 'entwurf')").
		Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return models.Apps{}, ErrAppNotFound
	}
	if err != nil {
		return models.Apps{}, fmt.Errorf("loading JustApps entry: %w", err)
	}

	app.Status = apphandlers.NormalizeAppStatus(app.Status)
	return app, nil
}

func (r catalogReader) publicAppDetails(ctx context.Context, app models.Apps) (AppDetails, error) {
	relatedApps, err := r.loadRelatedApps(ctx, app.ID)
	if err != nil {
		return AppDetails{}, err
	}
	appGroups, err := r.loadAppGroups(ctx, app.ID)
	if err != nil {
		return AppDetails{}, err
	}

	details := AppDetails{
		AppSummary:        publicAppSummary(app),
		Icon:              app.Icon,
		LiveDemos:         app.LiveDemos,
		Repositories:      app.Repositories,
		CustomLinks:       app.CustomLinks,
		MarkdownContent:   app.MarkdownContent,
		CustomFields:      app.CustomFields,
		ReuseRequirements: app.ReuseRequirements,
		ShowDocker:        app.ShowDocker,
		ShowCompose:       app.ShowCompose,
		ShowHelm:          app.ShowHelm,
		Changelog:         app.Changelog,
		RelatedApps:       relatedApps,
		AppGroups:         appGroups,
		CreatedAt:         formatTime(app.CreatedAt),
		UpdatedAt:         formatTime(app.UpdatedAt),
	}

	if app.HasDeploymentAssistant {
		details.DeploymentVariants = publicDeploymentVariants(app)
		if app.ShowDocker {
			details.DockerRepository = app.DockerRepo
			details.CustomDockerCommand = app.CustomDockerCommand
			details.CustomDockerNote = app.CustomDockerNote
		}
		if app.ShowCompose {
			details.CustomComposeCommand = app.CustomComposeCommand
			details.CustomComposeNote = app.CustomComposeNote
		}
		if app.ShowHelm {
			details.HelmRepository = app.HelmRepo
			details.CustomHelmCommand = app.CustomHelmCommand
			details.CustomHelmNote = app.CustomHelmNote
			details.CustomHelmValues = app.CustomHelmValues
		}
	}

	return details, nil
}

func publicDeploymentVariants(app models.Apps) []models.DeploymentVariant {
	variants := make([]models.DeploymentVariant, 0, len(app.DeploymentVariants))
	for _, variant := range app.DeploymentVariants {
		publicVariant := variant
		if !app.ShowDocker {
			publicVariant.DockerCommand = ""
			publicVariant.DockerNote = ""
		}
		if !app.ShowCompose {
			publicVariant.ComposeCommand = ""
			publicVariant.ComposeNote = ""
		}
		if !app.ShowHelm {
			publicVariant.HelmCommand = ""
			publicVariant.HelmNote = ""
			publicVariant.HelmValues = ""
		}
		variants = append(variants, publicVariant)
	}
	return variants
}

type relatedAppRow struct {
	ID   string `bun:"id"`
	Name string `bun:"name"`
	Icon string `bun:"icon"`
}

func (r catalogReader) loadRelatedApps(ctx context.Context, appID string) ([]models.AppRelationSummary, error) {
	rows := make([]relatedAppRow, 0)
	err := r.db.NewRaw(`
		SELECT DISTINCT a.id, a.name, a.icon
		FROM apps a
		JOIN app_relations relation ON relation.related_app_id = a.id
		WHERE relation.app_id = ?
		  AND LOWER(TRIM(COALESCE(a.status, ''))) NOT IN ('draft', 'entwurf')
		UNION
		SELECT DISTINCT a.id, a.name, a.icon
		FROM apps a
		JOIN app_relations relation ON relation.app_id = a.id
		WHERE relation.related_app_id = ?
		  AND LOWER(TRIM(COALESCE(a.status, ''))) NOT IN ('draft', 'entwurf')
		ORDER BY name ASC, id ASC
	`, appID, appID).Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("loading related JustApps entries: %w", err)
	}

	result := make([]models.AppRelationSummary, 0, len(rows))
	for _, row := range rows {
		result = append(result, models.AppRelationSummary{ID: row.ID, Name: row.Name, Icon: row.Icon})
	}
	return result, nil
}

type appGroupRow struct {
	ID   string `bun:"id"`
	Name string `bun:"name"`
	Icon string `bun:"icon"`
}

func (r catalogReader) loadAppGroups(ctx context.Context, appID string) ([]models.AppGroupSummary, error) {
	rows := make([]appGroupRow, 0)
	err := r.db.NewRaw(`
		SELECT g.id::text, g.name, g.icon
		FROM app_groups g
		JOIN app_group_members member ON member.app_group_id = g.id
		WHERE member.app_id = ?
		ORDER BY LOWER(g.name) ASC, g.id ASC
	`, appID).Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("loading JustApps groups: %w", err)
	}

	result := make([]models.AppGroupSummary, 0, len(rows))
	for _, row := range rows {
		result = append(result, models.AppGroupSummary{ID: row.ID, Name: row.Name, Icon: row.Icon})
	}
	return result, nil
}

func (r catalogReader) readCatalog(ctx context.Context, req *mcpsdk.ReadResourceRequest) (*mcpsdk.ReadResourceResult, error) {
	if req == nil || req.Params == nil {
		return nil, errors.New("resource URI is required")
	}

	apps, total, err := r.queryApps(ctx, SearchAppsInput{}, maxCatalogResourceItems)
	if err != nil {
		return nil, err
	}

	document := struct {
		Apps      []AppSummary `json:"apps"`
		Total     int          `json:"total"`
		Truncated bool         `json:"truncated"`
	}{
		Apps:      make([]AppSummary, 0, len(apps)),
		Total:     total,
		Truncated: total > len(apps),
	}
	for _, app := range apps {
		document.Apps = append(document.Apps, publicAppSummary(app))
	}

	return jsonResourceResult(req.Params.URI, document)
}

func (r catalogReader) readApp(ctx context.Context, req *mcpsdk.ReadResourceRequest) (*mcpsdk.ReadResourceResult, error) {
	if req == nil || req.Params == nil {
		return nil, errors.New("resource URI is required")
	}

	appID, ok := appIDFromResourceURI(req.Params.URI)
	if !ok {
		return nil, mcpsdk.ResourceNotFoundError(req.Params.URI)
	}

	app, err := r.loadPublicApp(ctx, appID)
	if errors.Is(err, ErrAppNotFound) {
		return nil, mcpsdk.ResourceNotFoundError(req.Params.URI)
	}
	if err != nil {
		return nil, err
	}
	details, err := r.publicAppDetails(ctx, app)
	if err != nil {
		return nil, err
	}

	return jsonResourceResult(req.Params.URI, details)
}

func jsonResourceResult(uri string, value any) (*mcpsdk.ReadResourceResult, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("encoding JustApps MCP resource: %w", err)
	}
	return &mcpsdk.ReadResourceResult{
		Contents: []*mcpsdk.ResourceContents{{
			URI:      uri,
			MIMEType: "application/json",
			Text:     string(data),
		}},
	}, nil
}

func publicAppSummary(app models.Apps) AppSummary {
	return AppSummary{
		ID:                     app.ID,
		Name:                   app.Name,
		Description:            app.Description,
		Categories:             app.Categories,
		TechStack:              app.TechStack,
		Tags:                   app.Tags,
		Collections:            app.Collections,
		Status:                 apphandlers.NormalizeAppStatus(app.Status),
		Version:                app.Version,
		License:                app.License,
		LiveURL:                app.LiveUrl,
		DocsURL:                app.DocsUrl,
		RepoURL:                app.RepoUrl,
		IsFeatured:             app.IsFeatured,
		RatingAverage:          app.RatingAvg,
		RatingCount:            app.RatingCount,
		IsReuse:                app.IsReuse,
		HasDeploymentAssistant: app.HasDeploymentAssistant,
	}
}

func normalizeSearchLimit(limit int) (int, error) {
	if limit == 0 {
		return defaultSearchLimit, nil
	}
	if limit < 1 || limit > maxSearchLimit {
		return 0, fmt.Errorf("limit must be between 1 and %d", maxSearchLimit)
	}
	return limit, nil
}

func searchTerms(query string) []string {
	terms := make([]string, 0, 8)
	seen := make(map[string]struct{}, 8)
	for _, term := range strings.Fields(strings.ToLower(strings.TrimSpace(query))) {
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}
		if _, exists := seen[term]; exists {
			continue
		}
		seen[term] = struct{}{}
		terms = append(terms, term)
		if len(terms) == 8 {
			break
		}
	}
	return terms
}

func escapeLike(value string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(value)
}

func appIDFromResourceURI(rawURI string) (string, bool) {
	parsed, err := url.Parse(rawURI)
	if err != nil || parsed.Scheme != "justapps" || parsed.Host != "apps" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false
	}

	escapedPath := parsed.EscapedPath()
	if !strings.HasPrefix(escapedPath, "/") {
		return "", false
	}
	id, err := url.PathUnescape(strings.TrimPrefix(escapedPath, "/"))
	if err != nil || id == "" || strings.Contains(id, "/") {
		return "", false
	}
	return id, true
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}
