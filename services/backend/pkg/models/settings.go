package models

import "github.com/uptrace/bun"

// DetailFieldDef defines a single field in the "Fachliche Details" schema.
// Admins manage this list; apps store values by key in CustomFields.
type DetailFieldDef struct {
	Key   string `json:"key"`   // Unique machine key, e.g. "focus"
	Label string `json:"label"` // Display label, e.g. "Themenfeld"
	Icon  string `json:"icon"`  // Lucide icon name, e.g. "Layers" (optional)
}

// FooterLink is a single link shown in the footer.
type FooterLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type PlatformSettings struct {
	bun.BaseModel `bun:"table:platform_settings,alias:ps"`

	ID                  string `bun:"id,pk" json:"id"` // Singleton: "default"
	AllowAppSubmissions bool   `bun:"allow_app_submissions,notnull,default:true" json:"allowAppSubmissions"`
	ShowTopBanner       bool   `bun:"show_top_banner,notnull,default:false" json:"showTopBanner"`
	TopBannerText       string `bun:"top_banner_text" json:"topBannerText"`
	TopBannerType       string `bun:"top_banner_type,notnull,default:'info'" json:"topBannerType"`
	// DetailFields is the admin-configurable schema for the "Fachliche Details" tab.
	DetailFields []DetailFieldDef `bun:"detail_fields,type:jsonb,notnull,default:'[]'" json:"detailFields"`

	// Branding
	StoreName        string       `bun:"store_name" json:"storeName"`
	StoreDescription string       `bun:"store_description" json:"storeDescription"`
	LogoUrl          string       `bun:"logo_url" json:"logoUrl"`
	LogoDarkUrl      string       `bun:"logo_dark_url" json:"logoDarkUrl"`
	FaviconUrl       string       `bun:"favicon_url" json:"faviconUrl"`
	AccentColor      string       `bun:"accent_color" json:"accentColor"`
	HeroBadge        string       `bun:"hero_badge" json:"heroBadge"`
	HeroTitle        string       `bun:"hero_title" json:"heroTitle"`
	HeroSubtitle     string       `bun:"hero_subtitle" json:"heroSubtitle"`
	FooterText       string       `bun:"footer_text" json:"footerText"`
	FooterLinks      []FooterLink `bun:"footer_links,type:jsonb,notnull,default:'[]'" json:"footerLinks"`
	ShowFlagBar      bool         `bun:"show_flag_bar,notnull,default:true" json:"showFlagBar"`

	// App sort configuration (admin-configurable)
	// Supported values for AppSortField: name, rating_avg, updated_at, status, authority
	AppSortField     string   `bun:"app_sort_field,notnull,default:'name'" json:"appSortField"`
	AppSortDirection string   `bun:"app_sort_direction,notnull,default:'asc'" json:"appSortDirection"`
	PinnedApps       []string `bun:"pinned_apps,array,notnull,default:'{}'" json:"pinnedApps"`
}
