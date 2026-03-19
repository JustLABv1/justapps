package models

import (
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// AppRelation represents a bidirectional relationship between two apps.
// Both (app_id → related_app_id) and (related_app_id → app_id) are stored
// so each app can query its related apps without a UNION.
type AppRelation struct {
	bun.BaseModel `bun:"table:app_relations"`

	AppID        string `bun:"app_id,pk" json:"appId"`
	RelatedAppID string `bun:"related_app_id,pk" json:"relatedAppId"`

	// Preloaded relations
	App        *Apps `bun:"rel:belongs-to,join:app_id=id" json:"app,omitempty"`
	RelatedApp *Apps `bun:"rel:belongs-to,join:related_app_id=id" json:"relatedApp,omitempty"`
}

// AppGroup is a named collection of apps that share a common purpose or theme.
type AppGroup struct {
	bun.BaseModel `bun:"table:app_groups"`

	ID          uuid.UUID        `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name        string           `bun:"name,notnull" json:"name"`
	Description string           `bun:"description,notnull,default:''" json:"description"`
	Members     []AppGroupMember `bun:"rel:has-many,join:id=app_group_id" json:"members,omitempty"`
}

// AppGroupMember links an app to a group.
type AppGroupMember struct {
	bun.BaseModel `bun:"table:app_group_members"`

	AppGroupID uuid.UUID `bun:"app_group_id,pk,type:uuid" json:"appGroupId"`
	AppID      string    `bun:"app_id,pk" json:"appId"`

	App *Apps `bun:"rel:belongs-to,join:app_id=id" json:"app,omitempty"`
}
