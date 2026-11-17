package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// AppChange records what one save in the editor changed, in plain field keys
// (see appupdates.ChangedFields).
type AppChange struct {
	bun.BaseModel `bun:"table:app_changes,alias:ac"`

	ID            uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	AppID         string     `bun:"app_id,notnull" json:"appId"`
	UserID        *uuid.UUID `bun:"user_id,type:uuid" json:"userId,omitempty"`
	Fields        []string   `bun:"fields,array" json:"fields"`
	VersionBefore string     `bun:"version_before,notnull" json:"versionBefore"`
	VersionAfter  string     `bun:"version_after,notnull" json:"versionAfter"`
	Note          string     `bun:"note,notnull" json:"note"`
	CreatedAt     time.Time  `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
}
