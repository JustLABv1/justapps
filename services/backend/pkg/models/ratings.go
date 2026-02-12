package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Rating struct {
	bun.BaseModel `bun:"table:ratings"`

	ID        uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	AppID     string    `bun:"app_id,notnull" json:"appId"`
	UserID    string    `bun:"user_id,notnull" json:"userId"`
	Username  string    `bun:"username" json:"username"`
	Rating    int       `bun:"rating,notnull" json:"rating"`
	Comment   string    `bun:"comment" json:"comment"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp" json:"createdAt"`
}
