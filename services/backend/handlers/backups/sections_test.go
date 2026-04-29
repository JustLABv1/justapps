package backups

import (
	"reflect"
	"testing"

	"justapps-backend/pkg/models"
)

func TestManifestAvailableSectionsPreservesPartialDeclaredScope(t *testing.T) {
	manifest := models.BackupManifest{
		Sections: []string{"apps", "assets"},
	}

	available, err := manifestAvailableSections(manifest)
	if err != nil {
		t.Fatalf("manifestAvailableSections() error = %v", err)
	}
	if !reflect.DeepEqual(available, []string{"apps", "assets"}) {
		t.Fatalf("available = %#v", available)
	}
	if isFullScope(available) {
		t.Fatal("partial manifest scope must not be treated as a full restore scope")
	}

	filtered, skipped := filterUnavailableSections(allSections, available)
	if !reflect.DeepEqual(filtered, []string{"apps", "assets"}) {
		t.Fatalf("filtered = %#v", filtered)
	}
	if len(skipped) != len(allSections)-2 {
		t.Fatalf("skipped = %#v", skipped)
	}
}

func TestParseSectionsAcceptsLegacyRepositoryNames(t *testing.T) {
	sections, err := parseSections("apps,gitLabProviders,gitLabAppLinks")
	if err != nil {
		t.Fatalf("parseSections() error = %v", err)
	}
	want := []string{"apps", "repositoryProviders", "repositoryAppLinks"}
	if !reflect.DeepEqual(sections, want) {
		t.Fatalf("sections = %#v, want %#v", sections, want)
	}
}
