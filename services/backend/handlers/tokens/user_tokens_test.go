package tokens

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"justapps-backend/pkg/models"

	"github.com/google/uuid"
)

func TestSanitizeUserTokenDoesNotExposeSecret(t *testing.T) {
	secret := "eyJhbGciOiJIUzI1NiJ9.secret.payload"
	token := models.Tokens{
		ID:          uuid.New(),
		Key:         secret,
		Description: "MCP agent",
		Type:        userTokenType,
		CreatedAt:   time.Date(2026, time.January, 2, 3, 4, 5, 0, time.UTC),
		ExpiresAt:   time.Date(2027, time.January, 2, 3, 4, 5, 0, time.UTC),
	}

	response := sanitizeUserToken(token)
	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal sanitized token: %v", err)
	}
	if strings.Contains(string(encoded), secret) {
		t.Fatalf("sanitized token contains the full secret: %s", encoded)
	}
	if response.KeyPreview != secret[:12]+"…" {
		t.Fatalf("key preview = %q, want a 12-character preview", response.KeyPreview)
	}
}

func TestTokenKeyPreviewHandlesShortValues(t *testing.T) {
	if got := tokenKeyPreview("short"); got != "short" {
		t.Fatalf("short token preview = %q, want %q", got, "short")
	}
}
