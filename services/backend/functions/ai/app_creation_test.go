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
