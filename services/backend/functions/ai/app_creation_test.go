package ai

import (
	"strings"
	"testing"
)

func TestParseAppCreationSuggestionNormalizesTechnicalID(t *testing.T) {
	suggestion, err := parseAppCreationSuggestion(`{"name":"Geo Portal","description":"Zeigt kommunale Karten.","categories":["Geodaten","Geodaten"],"tags":["GIS"],"techStack":["QGIS"],"id":"Geo Portal!"}`)
	if err != nil {
		t.Fatalf("parseAppCreationSuggestion returned error: %v", err)
	}
	if suggestion.ID != "geo-portal" {
		t.Fatalf("unexpected technical id: %q", suggestion.ID)
	}
	if len(suggestion.Categories) != 1 {
		t.Fatalf("expected duplicate categories to be removed: %#v", suggestion.Categories)
	}
}

func TestParseAppCreationSuggestionRequiresDescription(t *testing.T) {
	if _, err := parseAppCreationSuggestion(`{"name":"Nur ein Name"}`); err == nil {
		t.Fatal("expected an error for a missing description")
	}
}

func TestParseAppCreationSuggestionJoinsMarkdownSections(t *testing.T) {
	suggestion, err := parseAppCreationSuggestion(`{"name":"Portal","description":"Bündelt Informationen.","markdownContent":["# Überblick","## Nutzung"]}`)
	if err != nil {
		t.Fatalf("parseAppCreationSuggestion returned error: %v", err)
	}
	if suggestion.MarkdownContent != "# Überblick\n\n## Nutzung" {
		t.Fatalf("unexpected markdown content: %q", suggestion.MarkdownContent)
	}
}

func TestParseAppCreationSuggestionAcceptsFencedJSONWithTrailingText(t *testing.T) {
	suggestion, err := parseAppCreationSuggestion("Hinweis:\n```json\n{\"name\":\"Portal\",\"description\":\"Bündelt Informationen.\",\"markdownContent\":\"Nutze {die App} für den Einstieg.\"}\n```\nFertig.")
	if err != nil {
		t.Fatalf("parseAppCreationSuggestion returned error: %v", err)
	}
	if suggestion.MarkdownContent != "Nutze {die App} für den Einstieg." {
		t.Fatalf("unexpected markdown content: %q", suggestion.MarkdownContent)
	}
}

func TestParseAppCreationSuggestionRecoversFromMalformedMarkdownArray(t *testing.T) {
	suggestion, err := parseAppCreationSuggestion(`{"name":"Portal","description":"Bündelt Informationen.","markdownContent":["# Überblick","## Nutzung": "nicht sicher"],"categories":[]}`)
	if err != nil {
		t.Fatalf("parseAppCreationSuggestion returned error: %v", err)
	}
	if suggestion.MarkdownContent != "" {
		t.Fatalf("expected malformed markdown to be discarded, got %q", suggestion.MarkdownContent)
	}
	if len(suggestion.MissingFields) != 1 || suggestion.MissingFields[0] != "markdownContent" {
		t.Fatalf("expected markdownContent to be marked missing, got %#v", suggestion.MissingFields)
	}
}

func TestBuildAppCreationPromptRedactsSensitiveRepositoryValues(t *testing.T) {
	prompt := buildAppCreationPrompt(AppCreationAssistantInput{
		Brief: "Eine App mit token=do-not-send",
		Repository: AppCreationRepositoryInput{
			ReadmeContent:      "password: do-not-send",
			HelmValuesContent:  "apiKey: do-not-send",
			ComposeFileContent: "SECRET=do-not-send",
		},
	})
	if strings.Contains(prompt, "do-not-send") {
		t.Fatalf("prompt contains a sensitive value: %s", prompt)
	}
}
