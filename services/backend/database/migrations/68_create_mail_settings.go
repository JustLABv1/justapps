package migrations

import (
	"context"

	"github.com/uptrace/bun"
)

// Outgoing mail for the weekly summary ("Wochenrückblick"): one SMTP
// configuration for the platform, and an opt-in per user. The password is
// stored encrypted like provider tokens.
func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
 CREATE TABLE IF NOT EXISTS mail_settings (
   id TEXT PRIMARY KEY DEFAULT 'default',
   enabled BOOLEAN NOT NULL DEFAULT false,
   host TEXT NOT NULL DEFAULT '',
   port INTEGER NOT NULL DEFAULT 587,
   security TEXT NOT NULL DEFAULT 'starttls',
   username TEXT NOT NULL DEFAULT '',
   encrypted_password TEXT NOT NULL DEFAULT '',
   password_nonce TEXT NOT NULL DEFAULT '',
   password_key_version TEXT NOT NULL DEFAULT '',
   from_address TEXT NOT NULL DEFAULT '',
   from_name TEXT NOT NULL DEFAULT '',
   site_url TEXT NOT NULL DEFAULT '',
   digest_enabled BOOLEAN NOT NULL DEFAULT false,
   digest_weekday INTEGER NOT NULL DEFAULT 1,
   digest_hour INTEGER NOT NULL DEFAULT 8,
   last_digest_week TEXT NOT NULL DEFAULT '',
   last_digest_sent_at TIMESTAMPTZ,
   last_digest_recipients INTEGER NOT NULL DEFAULT 0,
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 ALTER TABLE user_update_preferences ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN NOT NULL DEFAULT false;
 `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE user_update_preferences DROP COLUMN IF EXISTS weekly_digest; DROP TABLE IF EXISTS mail_settings;`)
		return err
	})
}
