package ai

import (
	"errors"
	"testing"
)

func TestParseHealthCopilotSuggestionFiltersUnknownIssues(t *testing.T) {
	suggestion, err := parseHealthCopilotSuggestion(`{"summary":"Zwei Punkte sollten geprüft werden.","priority":"hoch","issues":[{"code":"repository-sync-error","title":"Sync prüfen","explanation":"Der letzte Abgleich ist fehlgeschlagen.","evidence":"Status: error","actions":["Zugangsdaten prüfen","Sync erneut starten"]},{"code":"invented","title":"Nicht zulässig","explanation":"Nicht aus den Daten belegt.","actions":["Ignorieren"]}]}`, []string{"repository-sync-error"})
	if err != nil {
		t.Fatalf("parseHealthCopilotSuggestion returned error: %v", err)
	}
	if suggestion.Priority != "high" {
		t.Fatalf("expected normalized high priority, got %q", suggestion.Priority)
	}
	if len(suggestion.Issues) != 1 || suggestion.Issues[0].Code != "repository-sync-error" {
		t.Fatalf("unexpected filtered issues: %#v", suggestion.Issues)
	}
}

func TestParseHealthCopilotSuggestionRejectsMissingSummary(t *testing.T) {
	_, err := parseHealthCopilotSuggestion(`{"priority":"low","issues":[]}`, nil)
	if !errors.Is(err, ErrAIInvalidPayload) {
		t.Fatalf("expected ErrAIInvalidPayload, got %v", err)
	}
}

func TestRedactSensitiveText(t *testing.T) {
	redacted := redactSensitiveText("status: error\npassword: secret-value\nreason: unavailable")
	if redacted != "status: error\npassword: <redacted>\nreason: unavailable" {
		t.Fatalf("unexpected redacted text: %q", redacted)
	}
}
