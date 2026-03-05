package models

import "github.com/uptrace/bun"

type PlatformSettings struct {
	bun.BaseModel `bun:"table:platform_settings,alias:ps"`

	ID                  string `bun:"id,pk" json:"id"` // Singleton: "default"
	AllowAppSubmissions bool   `bun:"allow_app_submissions,notnull,default:true" json:"allowAppSubmissions"`
	ShowTopBanner       bool   `bun:"show_top_banner,notnull,default:false" json:"showTopBanner"`
	TopBannerText       string `bun:"top_banner_text" json:"topBannerText"`
}
