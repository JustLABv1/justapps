package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type UserFavorite struct {
	bun.BaseModel `bun:"table:user_favorites"`

	UserID    uuid.UUID `bun:"user_id,pk,type:uuid" json:"user_id"`
	AppID     string    `bun:"app_id,pk,type:text" json:"app_id"`
	CreatedAt time.Time `bun:"created_at,type:timestamptz,default:now()" json:"created_at"`
}
