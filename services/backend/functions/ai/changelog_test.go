package ai

import (
	"errors"
	"testing"
)

func TestParseChangelogSuggestionAcceptsJSONCodeFence(t *testing.T) {
	suggestion, err := parseChangelogSuggestion("```json\n{\"title\":\"Deployment aktualisiert\",\"summary\":\"Die Konfiguration wurde angepasst.\",\"changelog\":\"- Replica-Anzahl aktualisiert\"}\n```")
	if err != nil {
		t.Fatalf("parseChangelogSuggestion returned error: %v", err)
	}
	if suggestion.Title != "Deployment aktualisiert" {
		t.Fatalf("unexpected title: %q", suggestion.Title)
	}
	if suggestion.Changelog != "- Replica-Anzahl aktualisiert" {
		t.Fatalf("unexpected changelog: %q", suggestion.Changelog)
	}
}

func TestParseChangelogSuggestionRejectsIncompletePayload(t *testing.T) {
	_, err := parseChangelogSuggestion(`{"title":"Nur ein Titel"}`)
	if !errors.Is(err, ErrAIInvalidPayload) {
		t.Fatalf("expected ErrAIInvalidPayload, got %v", err)
	}
}

func TestRedactSensitiveDiff(t *testing.T) {
	diff := "+password: super-secret\n+replicas: 2\n+authorization: Bearer abc"
	redacted := redactSensitiveDiff(diff)
	if redacted == diff || redacted != "+password: <redacted>\n+replicas: 2\n+authorization: <redacted>" {
		t.Fatalf("unexpected redacted diff: %q", redacted)
	}
}
