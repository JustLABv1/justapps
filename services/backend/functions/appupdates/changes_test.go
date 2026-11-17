package appupdates

import (
	"slices"
	"testing"

	"justapps-backend/pkg/models"
)

func TestChangedFieldsIgnoresPlatformSettingsAndEmptyLists(t *testing.T) {
	before := models.Apps{Name: "Geo", Description: "Karten", IsFeatured: false}
	after := before
	after.IsFeatured = true
	after.IsHidden = true
	after.CustomFields = []models.AppField{}
	after.DeploymentVariants = nil
	if fields := ChangedFields(before, after); len(fields) != 0 {
		t.Fatalf("expected no reader-facing change, got %v", fields)
	}
}

func TestChangedFieldsNamesWhatChanged(t *testing.T) {
	before := models.Apps{Name: "Geo", Version: "1.2", CustomHelmValues: "a: 1", Tags: []string{"gis"}}
	after := before
	after.Version = "1.3"
	after.CustomHelmValues = "a: 2"
	after.Tags = []string{"gis", "karten"}
	after.Changelog = "OIDC-Login"
	got := ChangedFields(before, after)
	want := []string{FieldInstallation, FieldCategories, FieldVersion, FieldChangelog}
	if !slices.Equal(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}
