package apps

import (
	"regexp"
	"strings"

	"justapps-backend/pkg/models"
)

var (
	allowedBannerTypes = map[string]bool{
		"info":    true,
		"warning": true,
		"danger":  true,
		"custom":  true,
	}
	hexColorRe = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

// normalizeAppBanner validates and normalises the three banner fields on app.
// It also handles the legacy knownIssue field: if BannerText is empty and
// KnownIssue is not, the content is promoted to a 'warning' banner.
func normalizeAppBanner(app *models.Apps) {
	if app == nil {
		return
	}

	// Legacy migration: promote knownIssue to a warning banner
	if strings.TrimSpace(app.KnownIssue) != "" && strings.TrimSpace(app.BannerText) == "" {
		app.BannerText = strings.TrimSpace(app.KnownIssue)
		app.BannerType = "warning"
	}

	app.BannerText = strings.TrimSpace(app.BannerText)
	app.BannerType = strings.TrimSpace(strings.ToLower(app.BannerType))
	app.BannerColor = strings.TrimSpace(app.BannerColor)
	app.BannerTitle = strings.TrimSpace(app.BannerTitle)

	// If text is empty, clear type, color, and title
	if app.BannerText == "" {
		app.BannerType = ""
		app.BannerColor = ""
		app.BannerTitle = ""
		return
	}

	// Validate type; fall back to info for unrecognised values
	if !allowedBannerTypes[app.BannerType] {
		app.BannerType = "info"
	}

	// Preset types don't use a custom color
	if app.BannerType != "custom" {
		app.BannerColor = ""
		return
	}

	// Custom type requires a valid #RRGGBB hex color; clear if invalid
	if !hexColorRe.MatchString(app.BannerColor) {
		app.BannerColor = ""
	}
}
