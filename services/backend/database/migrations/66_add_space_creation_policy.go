package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
 CREATE TABLE space_creation_policy(id TEXT PRIMARY KEY DEFAULT 'default' CHECK(id='default'), mode TEXT NOT NULL DEFAULT 'allowed_users' CHECK(mode IN ('everyone','oidc_group','admins','allowed_users')), provider_key TEXT NOT NULL DEFAULT '', issuer TEXT NOT NULL DEFAULT '', group_name TEXT NOT NULL DEFAULT '');
 INSERT INTO space_creation_policy(id) VALUES ('default');
 CREATE TABLE user_oidc_groups(user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider_key TEXT NOT NULL,issuer TEXT NOT NULL,group_name TEXT NOT NULL,PRIMARY KEY(user_id,provider_key,issuer,group_name));
 `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP TABLE user_oidc_groups;DROP TABLE space_creation_policy;`)
		return err
	})
}
