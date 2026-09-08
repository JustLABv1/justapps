package mcp

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"justapps-backend/pkg/models"
)

func TestHandlerAdvertisesCatalogToolsAndResources(t *testing.T) {
	server := httptest.NewServer(NewHandler(nil))
	defer server.Close()

	client := mcpsdk.NewClient(&mcpsdk.Implementation{Name: "test-client", Version: "1.0.0"}, nil)
	session, err := client.Connect(context.Background(), &mcpsdk.StreamableClientTransport{
		Endpoint:             server.URL,
		DisableStandaloneSSE: true,
		MaxRetries:           -1,
	}, nil)
	if err != nil {
		t.Fatalf("connect MCP client: %v", err)
	}
	defer session.Close()

	tools, err := session.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	if !hasTool(tools.Tools, "search_apps") || !hasTool(tools.Tools, "get_app") {
		t.Fatalf("tools = %#v, want search_apps and get_app", tools.Tools)
	}

	resources, err := session.ListResources(context.Background(), nil)
	if err != nil {
		t.Fatalf("list resources: %v", err)
	}
	if len(resources.Resources) != 1 || resources.Resources[0].URI != catalogResourceURI {
		t.Fatalf("resources = %#v, want catalog resource", resources.Resources)
	}

	templates, err := session.ListResourceTemplates(context.Background(), nil)
	if err != nil {
		t.Fatalf("list resource templates: %v", err)
	}
	if len(templates.ResourceTemplates) != 1 || templates.ResourceTemplates[0].URITemplate != "justapps://apps/{id}" {
		t.Fatalf("resource templates = %#v, want app template", templates.ResourceTemplates)
	}
}

func TestPublicAppSummaryDoesNotExposeSensitiveRelations(t *testing.T) {
	ownerID := uuid.New()
	app := models.Apps{
		ID:      "secure-app",
		Name:    "Secure App",
		OwnerID: ownerID,
		Owner:   &models.Users{ID: ownerID, Email: "owner@example.org", Password: "password-hash"},
		Status:  "draft",
	}

	result := publicAppSummary(app)
	if result.ID != app.ID || result.Status != "Entwurf" {
		t.Fatalf("summary = %#v", result)
	}
	resultJSON, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("marshal summary: %v", err)
	}
	if strings.Contains(string(resultJSON), "password-hash") || strings.Contains(string(resultJSON), "owner@example.org") {
		t.Fatalf("summary contains sensitive owner data: %s", resultJSON)
	}
}

func TestAppIDFromResourceURI(t *testing.T) {
	tests := []struct {
		uri string
		id  string
		ok  bool
	}{
		{uri: "justapps://apps/my-app", id: "my-app", ok: true},
		{uri: "justapps://apps/my%20app", id: "my app", ok: true},
		{uri: "justapps://catalog", ok: false},
		{uri: "justapps://apps/my-app?secret=yes", ok: false},
		{uri: "https://apps.example.org/my-app", ok: false},
		{uri: "justapps://apps/a/b", ok: false},
	}

	for _, test := range tests {
		id, ok := appIDFromResourceURI(test.uri)
		if id != test.id || ok != test.ok {
			t.Errorf("appIDFromResourceURI(%q) = (%q, %v), want (%q, %v)", test.uri, id, ok, test.id, test.ok)
		}
	}
}

func TestNormalizeSearchLimit(t *testing.T) {
	if limit, err := normalizeSearchLimit(0); err != nil || limit != defaultSearchLimit {
		t.Fatalf("default limit = (%d, %v)", limit, err)
	}
	if _, err := normalizeSearchLimit(maxSearchLimit + 1); err == nil {
		t.Fatal("expected over-limit search to fail")
	}
}

func TestPublicDeploymentVariantsHonorVisibilityFlags(t *testing.T) {
	app := models.Apps{
		ShowDocker:  false,
		ShowCompose: true,
		ShowHelm:    false,
		DeploymentVariants: []models.DeploymentVariant{{
			Name:           "Default",
			Description:    "Public description",
			DockerCommand:  "docker secret",
			DockerNote:     "docker note",
			ComposeCommand: "compose command",
			ComposeNote:    "compose note",
			HelmCommand:    "helm secret",
			HelmNote:       "helm note",
			HelmValues:     "helm values secret",
		}},
	}

	variants := publicDeploymentVariants(app)
	if len(variants) != 1 {
		t.Fatalf("variants = %#v, want one variant", variants)
	}
	variant := variants[0]
	if variant.Name != "Default" || variant.Description != "Public description" {
		t.Fatalf("public metadata was changed: %#v", variant)
	}
	if variant.DockerCommand != "" || variant.DockerNote != "" || variant.HelmCommand != "" || variant.HelmNote != "" || variant.HelmValues != "" {
		t.Fatalf("hidden deployment data was returned: %#v", variant)
	}
	if variant.ComposeCommand != "compose command" || variant.ComposeNote != "compose note" {
		t.Fatalf("visible compose data was removed: %#v", variant)
	}
}

func hasTool(tools []*mcpsdk.Tool, name string) bool {
	for _, tool := range tools {
		if tool.Name == name {
			return true
		}
	}
	return false
}
