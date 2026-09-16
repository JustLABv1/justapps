package models

import (
	"time"

	"github.com/uptrace/bun"
)

type Role struct {
	bun.BaseModel `bun:"table:roles"`

	Key         string    `bun:"key,pk" json:"key"`
	Name        string    `bun:"name,notnull" json:"name"`
	Description string    `bun:"description,notnull" json:"description"`
	IsSystem    bool      `bun:"is_system,notnull" json:"isSystem"`
	CreatedAt   time.Time `bun:"created_at,notnull,default:now()" json:"createdAt"`
	UpdatedAt   time.Time `bun:"updated_at,notnull,default:now()" json:"updatedAt"`
	Permissions []string  `bun:"-" json:"permissions"`
	UserCount   int       `bun:"-" json:"userCount"`
}

type RolePermission struct {
	bun.BaseModel `bun:"table:role_permissions"`

	RoleKey    string `bun:"role_key,pk"`
	Permission string `bun:"permission,pk"`
}
