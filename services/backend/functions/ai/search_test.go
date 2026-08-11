package ai

import (
	"errors"
	"testing"
)

func TestParseSearchPlanNormalizesValues(t *testing.T) {
	plan, err := parseSearchPlan("```json\n{\"terms\":[\"Karten\",\"karten\",\"GIS\"],\"categories\":[\"Geodaten\"],\"techStack\":[\"QGIS\"],\"intent\":\"Geodaten anzeigen\"}\n```")
	if err != nil {
		t.Fatalf("parseSearchPlan returned error: %v", err)
	}
	if len(plan.Terms) != 2 || plan.Terms[0] != "karten" || plan.Terms[1] != "gis" {
		t.Fatalf("unexpected terms: %#v", plan.Terms)
	}
	if plan.Intent != "Geodaten anzeigen" {
		t.Fatalf("unexpected intent: %q", plan.Intent)
	}
}

func TestParseSearchPlanRequiresTerms(t *testing.T) {
	_, err := parseSearchPlan(`{"categories":["Kommunikation"]}`)
	if !errors.Is(err, ErrAIInvalidPayload) {
		t.Fatalf("expected ErrAIInvalidPayload, got %v", err)
	}
}
