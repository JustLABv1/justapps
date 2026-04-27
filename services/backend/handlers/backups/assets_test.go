package backups

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"justapps-backend/pkg/models"
)

func TestExportAssetsFromReferencesIncludesOnlyReferencedUploads(t *testing.T) {
	dataPath := t.TempDir()
	uploadDir := filepath.Join(dataPath, "uploads")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	files := map[string]string{
		"app-icon.png":   "app",
		"group-icon.png": "group",
		"orphan.png":     "orphan",
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(uploadDir, name), []byte(content), 0644); err != nil {
			t.Fatalf("WriteFile(%q) error = %v", name, err)
		}
	}

	assets, warnings, err := exportAssetsFromReferences(dataPath, []string{
		"/uploads/app-icon.png",
		"https://example.test/api/v1/uploads/group-icon.png",
		"/uploads/missing.png",
		"/uploads/app-icon.png",
		"sparkles",
		"",
	})
	if err != nil {
		t.Fatalf("exportAssetsFromReferences() error = %v", err)
	}
	if len(assets) != 2 {
		t.Fatalf("expected 2 assets, got %d", len(assets))
	}
	if assets[0].RelativePath != "uploads/app-icon.png" {
		t.Fatalf("first asset path = %q, want %q", assets[0].RelativePath, "uploads/app-icon.png")
	}
	if assets[1].RelativePath != "uploads/group-icon.png" {
		t.Fatalf("second asset path = %q, want %q", assets[1].RelativePath, "uploads/group-icon.png")
	}
	if len(warnings) != 1 || warnings[0] != "Referenced uploaded asset is missing: /uploads/missing.png" {
		t.Fatalf("warnings = %#v", warnings)
	}
}

func TestRestoreAssetsUsesRelativePathAndLegacyFilenameFallback(t *testing.T) {
	dataPath := t.TempDir()
	assets := []models.BackupAsset{
		{
			Filename:      "nested-icon.png",
			RelativePath:  "uploads/groups/nested-icon.png",
			ContentBase64: base64.StdEncoding.EncodeToString([]byte("nested")),
		},
		{
			Filename:      "legacy.png",
			ContentBase64: base64.StdEncoding.EncodeToString([]byte("legacy")),
		},
		{
			Filename:      "bad.png",
			RelativePath:  "../bad.png",
			ContentBase64: base64.StdEncoding.EncodeToString([]byte("bad")),
		},
	}

	stats, warnings, err := restoreAssets(dataPath, assets, false)
	if err != nil {
		t.Fatalf("restoreAssets() error = %v", err)
	}
	if stats.Created != 2 || stats.Updated != 0 || stats.Skipped != 1 {
		t.Fatalf("stats = %#v", stats)
	}
	if len(warnings) != 1 || warnings[0] != "Skipped an uploaded asset because its path was invalid." {
		t.Fatalf("warnings = %#v", warnings)
	}

	nestedContent, err := os.ReadFile(filepath.Join(dataPath, "uploads", "groups", "nested-icon.png"))
	if err != nil {
		t.Fatalf("ReadFile(nested) error = %v", err)
	}
	if string(nestedContent) != "nested" {
		t.Fatalf("nested content = %q", string(nestedContent))
	}

	legacyContent, err := os.ReadFile(filepath.Join(dataPath, "uploads", "legacy.png"))
	if err != nil {
		t.Fatalf("ReadFile(legacy) error = %v", err)
	}
	if string(legacyContent) != "legacy" {
		t.Fatalf("legacy content = %q", string(legacyContent))
	}
}
