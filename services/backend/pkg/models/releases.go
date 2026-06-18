package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type AppRelease struct {
	bun.BaseModel `bun:"table:app_releases,alias:ar"`

	ID            uuid.UUID             `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	AppID         string                `bun:"app_id,notnull" json:"appId"`
	Version       string                `bun:"version,notnull,default:''" json:"version"`
	ReleaseType   string                `bun:"release_type,notnull,default:'patch'" json:"releaseType"`
	Source        string                `bun:"source,notnull,default:'git_sync'" json:"source"`
	Title         string                `bun:"title,notnull,default:''" json:"title"`
	Summary       string                `bun:"summary,notnull,default:''" json:"summary"`
	ChangedAreas  []string              `bun:"changed_areas,type:jsonb,notnull,default:'[]'" json:"changedAreas"`
	ChangeDetails []ReleaseChangeDetail `bun:"change_details,type:jsonb,notnull,default:'[]'" json:"changeDetails"`
	DiffPreview   string                `bun:"diff_preview,notnull,default:''" json:"diffPreview"`
	Fingerprint   string                `bun:"fingerprint,notnull,default:''" json:"fingerprint"`
	PublishedAt   time.Time             `bun:"published_at,notnull,default:current_timestamp" json:"publishedAt"`
	CreatedAt     time.Time             `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
}

type ReleaseChangeDetail struct {
	Area       string `json:"area"`
	Field      string `json:"field"`
	Label      string `json:"label"`
	Language   string `json:"language"`
	Preview    string `json:"preview"`
	Diff       string `json:"diff"`
	BeforeText string `json:"beforeText"`
	AfterText  string `json:"afterText"`
}

type UserUpdatePreferences struct {
	bun.BaseModel `bun:"table:user_update_preferences,alias:uup"`

	UserID                 uuid.UUID `bun:"user_id,pk,type:uuid" json:"userId"`
	NotifyFavoritedApps    bool      `bun:"notify_favorited_apps,notnull,default:true" json:"notifyFavoritedApps"`
	NotifyRecentlyViewed   bool      `bun:"notify_recently_viewed_apps,notnull,default:true" json:"notifyRecentlyViewedApps"`
	NotifyOwnedManagedApps bool      `bun:"notify_owned_managed_apps,notnull,default:true" json:"notifyOwnedManagedApps"`
	CreatedAt              time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt              time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type UserRecentlyViewedApp struct {
	bun.BaseModel `bun:"table:user_recently_viewed_apps,alias:urva"`

	UserID    uuid.UUID `bun:"user_id,pk,type:uuid" json:"userId"`
	AppID     string    `bun:"app_id,pk,type:text" json:"appId"`
	ViewedAt  time.Time `bun:"viewed_at,notnull,default:current_timestamp" json:"viewedAt"`
	CreatedAt time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type UserReleaseInboxItem struct {
	bun.BaseModel `bun:"table:user_release_inbox_items,alias:urii"`

	ID        uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID  `bun:"user_id,notnull,type:uuid" json:"userId"`
	ReleaseID uuid.UUID  `bun:"release_id,notnull,type:uuid" json:"releaseId"`
	AppID     string     `bun:"app_id,notnull,type:text" json:"appId"`
	Reason    string     `bun:"reason,notnull,default:''" json:"reason"`
	SeenAt    *time.Time `bun:"seen_at,nullzero" json:"seenAt,omitempty"`
	CreatedAt time.Time  `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
}

type ReleaseInboxListItem struct {
	ID            uuid.UUID             `json:"id"`
	ReleaseID     uuid.UUID             `json:"releaseId"`
	AppID         string                `json:"appId"`
	AppName       string                `json:"appName"`
	AppIcon       string                `json:"appIcon"`
	Version       string                `json:"version"`
	ReleaseType   string                `json:"releaseType"`
	Title         string                `json:"title"`
	Summary       string                `json:"summary"`
	ChangedAreas  []string              `json:"changedAreas"`
	ChangeDetails []ReleaseChangeDetail `json:"changeDetails"`
	DiffPreview   string                `json:"diffPreview"`
	Reason        string                `json:"reason"`
	PublishedAt   time.Time             `json:"publishedAt"`
	SeenAt        *time.Time            `json:"seenAt,omitempty"`
}
