package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"golang.org/x/crypto/bcrypt"
)

type Users struct {
	bun.BaseModel `bun:"table:users"`

	ID             uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Username       string    `bun:"username,type:text,notnull" json:"username"`
	Email          string    `bun:"email,type:text,notnull" json:"email"`
	Password       string    `bun:"password,type:text,notnull" json:"password"`
	Role           string    `bun:"role,type:text,notnull,default:'user'" json:"role"`
	AuthType       string    `bun:"auth_type,type:text,default:'local'" json:"authType"`
	CanSubmitApps  bool      `bun:"can_submit_apps,type:bool,default:true" json:"canSubmitApps"`
	Disabled       bool      `bun:"disabled,type:bool,default:false" json:"disabled"`
	DisabledReason string    `bun:"disabled_reason,type:text,default:''" json:"disabled_reason"`
	CreatedAt      time.Time  `bun:"created_at,type:timestamptz,default:now()" json:"created_at"`
	UpdatedAt      time.Time  `bun:"updated_at,type:timestamptz" json:"updated_at"`
	LastLoginAt    *time.Time `bun:"last_login_at,type:timestamptz,nullzero" json:"lastLoginAt"`
}

func (user *Users) HashPassword(password string) error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	if err != nil {
		return err
	}
	user.Password = string(bytes)
	return nil
}
func (user *Users) CheckPassword(providedPassword string) error {
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(providedPassword))
	if err != nil {
		return err
	}
	return nil
}
