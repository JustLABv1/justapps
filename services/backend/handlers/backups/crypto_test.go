package backups

import (
	"encoding/json"
	"testing"
	"time"

	"justapps-backend/pkg/models"
)

func TestEncryptBackupManifestRoundTrip(t *testing.T) {
	t.Parallel()

	manifest := models.BackupManifest{
		SchemaVersion: schemaVersion,
		ExportedAt:    time.Date(2026, 4, 17, 10, 30, 0, 0, time.UTC),
		Mode:          models.BackupModeSafe,
		Sections:      []string{"apps", "settings"},
		Warnings:      []string{"safe mode"},
		Summary: []models.BackupSectionSummary{{
			Name:      "apps",
			ItemCount: 1,
		}},
	}

	payload, err := encryptBackupManifest(manifest, "correct horse battery")
	if err != nil {
		t.Fatalf("encryptBackupManifest() error = %v", err)
	}

	decoded, warnings, err := decodeBackupPayload(payload, "correct horse battery")
	if err != nil {
		t.Fatalf("decodeBackupPayload() error = %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %v", warnings)
	}
	if decoded.SchemaVersion != manifest.SchemaVersion {
		t.Fatalf("schemaVersion mismatch: got %q want %q", decoded.SchemaVersion, manifest.SchemaVersion)
	}
	if decoded.Mode != manifest.Mode {
		t.Fatalf("mode mismatch: got %q want %q", decoded.Mode, manifest.Mode)
	}
	if len(decoded.Sections) != len(manifest.Sections) {
		t.Fatalf("sections length mismatch: got %d want %d", len(decoded.Sections), len(manifest.Sections))
	}
}

func TestDecodeBackupPayloadRejectsWrongPassphrase(t *testing.T) {
	t.Parallel()

	manifest := models.BackupManifest{
		SchemaVersion: schemaVersion,
		ExportedAt:    time.Now().UTC(),
		Mode:          models.BackupModeFull,
		Sections:      []string{"users"},
	}

	payload, err := encryptBackupManifest(manifest, "correct horse battery")
	if err != nil {
		t.Fatalf("encryptBackupManifest() error = %v", err)
	}

	if _, _, err := decodeBackupPayload(payload, "wrong passphrase"); err == nil {
		t.Fatal("expected wrong passphrase to fail")
	}
}

func TestDecodeBackupPayloadSupportsLegacyManifest(t *testing.T) {
	t.Parallel()

	manifest := models.BackupManifest{
		SchemaVersion: schemaVersion,
		ExportedAt:    time.Now().UTC(),
		Mode:          models.BackupModeSafe,
		Sections:      []string{"apps"},
	}

	payload, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	decoded, warnings, err := decodeBackupPayload(payload, "")
	if err != nil {
		t.Fatalf("decodeBackupPayload() error = %v", err)
	}
	if decoded.SchemaVersion != manifest.SchemaVersion {
		t.Fatalf("schemaVersion mismatch: got %q want %q", decoded.SchemaVersion, manifest.SchemaVersion)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected legacy warning, got %v", warnings)
	}
}
