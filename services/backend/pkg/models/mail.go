package models

import (
	"time"

	"github.com/uptrace/bun"
)

// MailSettings is the platform's one SMTP configuration and the schedule of
// the weekly summary mail. The password never leaves the backend.
type MailSettings struct {
	bun.BaseModel `bun:"table:mail_settings,alias:ms"`

	ID                   string     `bun:"id,pk" json:"-"`
	Enabled              bool       `bun:"enabled,notnull" json:"enabled"`
	Host                 string     `bun:"host,notnull" json:"host"`
	Port                 int        `bun:"port,notnull" json:"port"`
	Security             string     `bun:"security,notnull" json:"security"`
	Username             string     `bun:"username,notnull" json:"username"`
	EncryptedPassword    string     `bun:"encrypted_password,notnull" json:"-"`
	PasswordNonce        string     `bun:"password_nonce,notnull" json:"-"`
	PasswordKeyVersion   string     `bun:"password_key_version,notnull" json:"-"`
	FromAddress          string     `bun:"from_address,notnull" json:"fromAddress"`
	FromName             string     `bun:"from_name,notnull" json:"fromName"`
	SiteURL              string     `bun:"site_url,notnull" json:"siteUrl"`
	DigestEnabled        bool       `bun:"digest_enabled,notnull" json:"digestEnabled"`
	DigestWeekday        int        `bun:"digest_weekday,notnull" json:"digestWeekday"`
	DigestHour           int        `bun:"digest_hour,notnull" json:"digestHour"`
	LastDigestWeek       string     `bun:"last_digest_week,notnull" json:"lastDigestWeek"`
	LastDigestSentAt     *time.Time `bun:"last_digest_sent_at" json:"lastDigestSentAt"`
	LastDigestRecipients int        `bun:"last_digest_recipients,notnull" json:"lastDigestRecipients"`
	UpdatedAt            time.Time  `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}
