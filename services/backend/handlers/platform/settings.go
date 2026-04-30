package platform

import (
	"errors"

	"justapps-backend/config"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// settingsResponse wraps PlatformSettings with runtime config values (not stored in DB).
type settingsResponse struct {
	models.PlatformSettings
	DisableLocalAuth    bool `json:"disableLocalAuth"`
	DisableRegistration bool `json:"disableRegistration"`
	OIDCEnabled         bool `json:"oidcEnabled"`
}

// defaultDetailFields is the built-in field schema used when none has been configured yet.
var defaultDetailFields = []models.DetailFieldDef{
	{Key: "focus", Label: "Themenfeld", Icon: "Layers"},
	{Key: "app_type", Label: "Anwendungstyp", Icon: "Globe"},
	{Key: "use_case", Label: "Anwendungsfall", Icon: "FileCode"},
	{Key: "visualization", Label: "Visualisierung", Icon: "Eye"},
	{Key: "deployment", Label: "Deployment", Icon: "Server"},
	{Key: "infrastructure", Label: "Infrastruktur", Icon: "LayoutDashboard"},
	{Key: "database", Label: "Datenbasis", Icon: "Database"},
	{Key: "transferability", Label: "Übertragbarkeit", Icon: "ArrowRightLeft"},
	{Key: "authority", Label: "Behörde", Icon: "Globe"},
	{Key: "contact_person", Label: "Ansprechpartner", Icon: "User"},
	{Key: "additional_info", Label: "Sonstiges", Icon: "ClipboardList"},
}

const defaultBrandPreset = "deutschland"

// GetSettings - Fetches the platform settings. Open to all users.
// Note: We use *models.PlatformSettings(nil) in Count/Select to ensure Bun knows the model if struct is empty
func GetSettings(c *gin.Context, db *bun.DB) {
	var settings models.PlatformSettings

	// Check if exists, if not create default
	count, _ := db.NewSelect().Model((*models.PlatformSettings)(nil)).Count(c)
	if count == 0 {
		settings = models.PlatformSettings{
			ID:                     "default",
			AIEnabled:              true,
			AllowAppSubmissions:    true,
			RequireAuthForAppStore: false,
			AllowAnonymousAI:       false,
			ShowFlagBar:            true,
			TopBarPreset:           defaultBrandPreset,
			HeroTitlePreset:        defaultBrandPreset,
			DetailFields:           defaultDetailFields,
			EnableLinkProbing:      true,
		}
		db.NewInsert().Model(&settings).Exec(c)
	} else {
		err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c)
		if err != nil {
			httperror.InternalServerError(c, "Failed to retrieve settings", err)
			return
		}
	}

	// Fresh installs may still have NULL arrays if the row was created before
	// defaults were enforced in the base schema. Normalize the response so the
	// frontend always receives arrays.
	if len(settings.DetailFields) == 0 {
		settings.DetailFields = defaultDetailFields
	}
	if settings.FooterLinks == nil {
		settings.FooterLinks = []models.FooterLink{}
	}
	if settings.TopBarColors == nil {
		settings.TopBarColors = []string{}
	}
	if settings.HeroTitleColors == nil {
		settings.HeroTitleColors = []string{}
	}
	if settings.PinnedApps == nil {
		settings.PinnedApps = []string{}
	}
	if settings.TopBarPreset == "" {
		settings.TopBarPreset = defaultBrandPreset
	}
	if settings.HeroTitlePreset == "" {
		settings.HeroTitlePreset = defaultBrandPreset
	}

	c.JSON(200, settingsResponse{
		PlatformSettings:    settings,
		DisableLocalAuth:    config.Config != nil && config.Config.OIDC.DisableLocalAuth,
		DisableRegistration: config.Config != nil && config.Config.OIDC.DisableRegistration,
		OIDCEnabled:         config.Config != nil && config.Config.OIDC.Enabled,
	})
}

func UpdateSettings(c *gin.Context, db *bun.DB) {
	// Check admin role
	role := c.GetString("role")
	if role != "admin" {
		httperror.Forbidden(c, "Only admins can update platform settings", errors.New("admin role required"))
		return
	}

	var req models.PlatformSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}
	req.ID = "default"

	_, err := db.NewUpdate().
		Model(&req).
		Column(
			"ai_enabled", "allow_app_submissions", "require_auth_for_app_store", "allow_anonymous_ai", "show_top_banner", "top_banner_text", "top_banner_type",
			"detail_fields",
			"store_name", "store_description", "logo_url", "logo_dark_url",
			"favicon_url", "accent_color", "hero_badge", "hero_title", "hero_title_preset", "hero_title_colors", "hero_subtitle",
			"footer_text", "footer_links", "show_flag_bar", "top_bar_preset", "top_bar_colors",
			"app_sort_field", "app_sort_direction", "pinned_apps",
			"enable_link_probing",
		).
		Where("id = ?", "default").
		Exec(c)

	if err != nil {
		httperror.InternalServerError(c, "Failed to update settings", err)
		return
	}

	callerID := c.GetString("user_id")
	audit.WriteAudit(c.Request.Context(), db, callerID, "settings.update", "updated platform settings")
	c.JSON(200, req)
}
