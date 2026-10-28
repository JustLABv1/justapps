package models

import (
	"encoding/json"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"time"
)

type PrivateSpace struct {
	bun.BaseModel `bun:"table:private_spaces,alias:ps"`
	ID            uuid.UUID `bun:"id,pk" json:"id"`
	Name          string    `json:"name"`
	OwnerID       uuid.UUID `bun:"owner_id" json:"ownerId"`
	CreatedAt     time.Time `bun:"created_at,nullzero,default:current_timestamp" json:"createdAt"`
}

type PrivateSpaceMember struct {
	bun.BaseModel  `bun:"table:private_space_members"`
	SpaceID        uuid.UUID `bun:"space_id,pk" json:"spaceId"`
	UserID         uuid.UUID `bun:"user_id,pk" json:"userId"`
	Accepted       bool      `json:"accepted"`
	ManualInvited  bool      `bun:"manual_invited" json:"manualInvited"`
	ManualAccepted bool      `bun:"manual_accepted" json:"manualAccepted"`
}

type PrivateSpaceGroupMapping struct {
	bun.BaseModel `bun:"table:private_space_group_mappings,alias:sgm"`
	ID            uuid.UUID `bun:"id,pk" json:"id"`
	SpaceID       uuid.UUID `bun:"space_id" json:"spaceId"`
	ProviderKey   string    `bun:"provider_key" json:"providerKey"`
	Issuer        string    `json:"issuer"`
	GroupName     string    `bun:"group_name" json:"groupName"`
}

// Old backups predate separate manual and group-derived membership sources.
func (m *PrivateSpaceMember) UnmarshalJSON(data []byte) error {
	type alias PrivateSpaceMember
	var raw struct {
		alias
		ManualInvited  *bool `json:"manualInvited"`
		ManualAccepted *bool `json:"manualAccepted"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*m = PrivateSpaceMember(raw.alias)
	if raw.ManualInvited == nil {
		m.ManualInvited = true
	} else {
		m.ManualInvited = *raw.ManualInvited
	}
	if raw.ManualAccepted == nil {
		m.ManualAccepted = m.Accepted
	} else {
		m.ManualAccepted = *raw.ManualAccepted
	}
	return nil
}
