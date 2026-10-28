package models

import (
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
	bun.BaseModel `bun:"table:private_space_members"`
	SpaceID       uuid.UUID `bun:"space_id,pk" json:"spaceId"`
	UserID        uuid.UUID `bun:"user_id,pk" json:"userId"`
	Accepted      bool      `json:"accepted"`
}
