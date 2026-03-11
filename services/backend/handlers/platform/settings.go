package platform

import (
	"errors"

	"just-apps-backend/functions/httperror"
	"just-apps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// defaultDetailFields is the built-in field schema used when none has been configured yet.
var defaultDetailFields = []models.DetailFieldDef{
	{Key: "focus",          Label: "Themenfeld",      Icon: "Layers"},
	{Key: "app_type",       Label: "Anwendungstyp",   Icon: "Globe"},
	{Key: "use_case",       Label: "Anwendungsfall",  Icon: "FileCode"},
	{Key: "visualization",  Label: "Visualisierung",  Icon: "Eye"},
	{Key: "deployment",     Label: "Deployment",      Icon: "Server"},
	{Key: "infrastructure", Label: "Infrastruktur",   Icon: "LayoutDashboard"},
	{Key: "database",       Label: "Datenbasis",      Icon: "Database"},
	{Key: "transferability",Label: "Übertragbarkeit", Icon: "ArrowRightLeft"},
	{Key: "authority",      Label: "Behörde",         Icon: "Globe"},
	{Key: "contact_person", Label: "Ansprechpartner", Icon: "User"},
	{Key: "additional_info",Label: "Sonstiges",       Icon: "ClipboardList"},
}

// GetSettings - Fetches the platform settings. Open to all users.
// Note: We use *models.PlatformSettings(nil) in Count/Select to ensure Bun knows the model if struct is empty
func GetSettings(c *gin.Context, db *bun.DB) {
	var settings models.PlatformSettings

	// Check if exists, if not create default
	count, _ := db.NewSelect().Model((*models.PlatformSettings)(nil)).Count(c)
	if count == 0 {
		settings = models.PlatformSettings{
			ID:                  "default",
			AllowAppSubmissions: true,
			ShowFlagBar:         true,
			DetailFields:        defaultDetailFields,
		}
		db.NewInsert().Model(&settings).Exec(c)
	} else {
		err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c)
		if err != nil {
			httperror.InternalServerError(c, "Failed to retrieve settings", err)
			return
		}
		// Ensure DetailFields is never nil/empty — seed defaults so the UI always has a schema
		if len(settings.DetailFields) == 0 {
			settings.DetailFields = defaultDetailFields
		}
	}

	c.JSON(200, settings)
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
			"allow_app_submissions", "show_top_banner", "top_banner_text",
			"detail_fields",
			"store_name", "store_description", "logo_url", "logo_dark_url",
			"favicon_url", "accent_color", "hero_badge", "hero_title", "hero_subtitle",
			"footer_text", "footer_links", "show_flag_bar",
		).
		Where("id = ?", "default").
		Exec(c)

	if err != nil {
		httperror.InternalServerError(c, "Failed to update settings", err)
		return
	}

	c.JSON(200, req)
}
