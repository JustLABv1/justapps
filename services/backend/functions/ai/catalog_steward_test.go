package ai

import (
	"strings"
	"testing"
	"time"
)

func TestParseCatalogStewardReportFiltersUntrustedFindings(t *testing.T) {
	report, err := parseCatalogStewardReport(`{"summary":"Zwei Punkte sollten geprüft werden.","findings":[{"appId":"app-one","appName":"App One","kind":"missing-documentation","severity":"hoch","title":"Dokumentation fehlt","summary":"Es gibt keine verwertbare Dokumentation.","evidence":["Markdown und Dokumentations-URL fehlen"],"suggestions":["README oder Markdown ergänzen"],"relatedAppIds":["app-two","unknown"]},{"appId":"invented","appName":"Nicht vorhanden","kind":"missing-owner","severity":"high","title":"Nicht zulässig","summary":"Nicht aus den Daten belegt.","evidence":["untrusted"],"suggestions":["ignorieren"]},{"appId":"app-one","kind":"invented-kind","title":"Nicht zulässig","summary":"Nicht zulässig","evidence":["untrusted"],"suggestions":["ignorieren"]}]}`, map[string]string{
		"app-one": "App One",
		"app-two": "App Two",
	})
	if err != nil {
		t.Fatalf("parseCatalogStewardReport returned error: %v", err)
	}
	if len(report.Findings) != 1 {
		t.Fatalf("expected one trusted finding, got %#v", report.Findings)
	}
	if report.Findings[0].Severity != "high" {
		t.Fatalf("expected normalized high severity, got %q", report.Findings[0].Severity)
	}
	if len(report.Findings[0].RelatedAppIDs) != 1 || report.Findings[0].RelatedAppIDs[0] != "app-two" {
		t.Fatalf("unexpected related app ids: %#v", report.Findings[0].RelatedAppIDs)
	}
}

func TestParseCatalogStewardReportRequiresEvidenceAndSuggestions(t *testing.T) {
	report, err := parseCatalogStewardReport(`{"summary":"Prüfung abgeschlossen.","findings":[{"appId":"app-one","kind":"missing-owner","title":"Owner fehlt","summary":"Die App hat keinen Owner."}]}`, map[string]string{"app-one": "App One"})
	if err != nil {
		t.Fatalf("parseCatalogStewardReport returned error: %v", err)
	}
	if len(report.Findings) != 0 {
		t.Fatalf("expected incomplete finding to be discarded: %#v", report.Findings)
	}
}

func TestBuildCatalogStewardPromptRedactsSensitiveValues(t *testing.T) {
	prompt := buildCatalogStewardPrompt([]byte(`[{"id":"app-one","description":"token=do-not-send"}]`), fixedStewardTestTime())
	if strings.Contains(prompt, "do-not-send") {
		t.Fatalf("prompt contains a sensitive value: %s", prompt)
	}
}

func fixedStewardTestTime() (value time.Time) {
	return time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)
}
