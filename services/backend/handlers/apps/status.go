package apps

import (
	"strings"

	"justapps-backend/pkg/models"
)

const canonicalDraftStatus = "Entwurf"

func NormalizeAppStatus(status string) string {
	trimmed := strings.TrimSpace(status)
	if trimmed == "" {
		return ""
	}

	switch strings.ToLower(trimmed) {
	case "draft", "entwurf":
		return canonicalDraftStatus
	default:
		return trimmed
	}
}

func IsDraftStatus(status string) bool {
	return NormalizeAppStatus(status) == canonicalDraftStatus
}

func normalizeAppModelStatus(app *models.Apps) {
	if app == nil {
		return
	}

	app.Status = NormalizeAppStatus(app.Status)
}

func isDraftApp(app models.Apps) bool {
	return IsDraftStatus(app.Status)
}
