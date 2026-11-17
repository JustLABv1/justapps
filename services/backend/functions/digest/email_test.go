package digest

import (
	"strings"
	"testing"
)

func TestRenderEmailEscapesAndLinks(t *testing.T) {
	week, _ := ParseWeek("2026-W46")
	d := Digest{
		Week:    week.String(),
		Label:   week.Label(),
		NewApps: []AppEntry{{ID: "geo", Name: "<b>Geo</b>", Categories: []string{"Karten"}}},
	}
	email, err := RenderEmail(d, "Test Store", "https://apps.example.org/")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(email.HTML, "<b>Geo</b>") {
		t.Fatal("app name was not escaped")
	}
	if !strings.Contains(email.HTML, "https://apps.example.org/apps/geo") {
		t.Fatal("app link missing")
	}
	if !strings.Contains(email.Text, "https://apps.example.org/neuigkeiten?woche=2026-W46") {
		t.Fatal("page link missing in text part")
	}
	if !strings.HasPrefix(email.Subject, "Test Store · Wochenrückblick KW 46") {
		t.Fatalf("subject = %q", email.Subject)
	}
}

func TestWhatsNewPrefersTheMaintainersWords(t *testing.T) {
	app := AppEntry{Fields: []string{"installation", "docs", "version"}, VersionBefore: "2.3", Version: "2.4"}
	if got := app.WhatsNew(); got != "Installation und Dokumentation überarbeitet" {
		t.Fatalf("parts = %q", got)
	}
	if got := app.VersionLabel(); got != "2.3 → 2.4" {
		t.Fatalf("version = %q", got)
	}
	app.Note = "OIDC-Login für Teams"
	if got := app.WhatsNew(); got != "OIDC-Login für Teams" {
		t.Fatalf("note = %q", got)
	}
}
