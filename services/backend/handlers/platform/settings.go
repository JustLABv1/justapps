package platform

import (
	"errors"

	"just-apps-backend/functions/httperror"
	"just-apps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// GetSettings - Fetches the platform settings. Open to all users.
// Note: We use *models.PlatformSettings(nil) in Count/Select to ensure Bun knows the model if struct is empty
func GetSettings(c *gin.Context, db *bun.DB) {
	var settings models.PlatformSettings

	// Check if exists, if not create default
	count, _ := db.NewSelect().Model((*models.PlatformSettings)(nil)).Count(c)
	if count == 0 {
		settings = models.PlatformSettings{ID: "default", AllowAppSubmissions: true, ShowFlagBar: true}
		db.NewInsert().Model(&settings).Exec(c)
	} else {
		err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c)
		if err != nil {
			httperror.InternalServerError(c, "Failed to retrieve settings", err)
			return
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

	type UpdateRequest struct {
		AllowAppSubmissions bool   `json:"allowAppSubmissions"`
		ShowTopBanner       bool   `json:"showTopBanner"`
		TopBannerText       string `json:"topBannerText"`
		// Branding
		StoreName        string `json:"storeName"`
		StoreDescription string `json:"storeDescription"`
		LogoUrl          string `json:"logoUrl"`
		LogoDarkUrl      string `json:"logoDarkUrl"`
		FaviconUrl       string `json:"faviconUrl"`
		AccentColor      string `json:"accentColor"`
		HeroTitle        string `json:"heroTitle"`
		HeroSubtitle     string `json:"heroSubtitle"`
		FooterText       string `json:"footerText"`
		ShowFlagBar      bool   `json:"showFlagBar"`
	}
	var req UpdateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Invalid input", err)
		return
	}

	settings := models.PlatformSettings{
		ID:                  "default",
		AllowAppSubmissions: req.AllowAppSubmissions,
		ShowTopBanner:       req.ShowTopBanner,
		TopBannerText:       req.TopBannerText,
		StoreName:           req.StoreName,
		StoreDescription:    req.StoreDescription,
		LogoUrl:             req.LogoUrl,
		LogoDarkUrl:         req.LogoDarkUrl,
		FaviconUrl:          req.FaviconUrl,
		AccentColor:         req.AccentColor,
		HeroTitle:           req.HeroTitle,
		HeroSubtitle:        req.HeroSubtitle,
		FooterText:          req.FooterText,
		ShowFlagBar:         req.ShowFlagBar,
	}

	_, err := db.NewUpdate().
		Model(&settings).
		Column(
			"allow_app_submissions", "show_top_banner", "top_banner_text",
			"store_name", "store_description", "logo_url", "logo_dark_url",
			"favicon_url", "accent_color", "hero_title", "hero_subtitle",
			"footer_text", "show_flag_bar",
		).
		Where("id = ?", "default").
		Exec(c)

	if err != nil {
		httperror.InternalServerError(c, "Failed to update settings", err)
		return
	}

	c.JSON(200, settings)
}
