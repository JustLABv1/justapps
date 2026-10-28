package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
   ALTER TABLE private_space_members ADD COLUMN manual_invited BOOLEAN NOT NULL DEFAULT true;
   ALTER TABLE private_space_members ADD COLUMN manual_accepted BOOLEAN NOT NULL DEFAULT false;
   UPDATE private_space_members SET manual_accepted = accepted;
   CREATE TABLE private_space_group_mappings (
    id UUID PRIMARY KEY, space_id UUID NOT NULL REFERENCES private_spaces(id) ON DELETE CASCADE,
    provider_key TEXT NOT NULL, issuer TEXT NOT NULL, group_name TEXT NOT NULL,
    UNIQUE(space_id,provider_key,issuer,group_name)
   );
   CREATE TABLE private_space_oidc_grants (
    mapping_id UUID NOT NULL REFERENCES private_space_group_mappings(id) ON DELETE CASCADE,
    space_id UUID NOT NULL, user_id UUID NOT NULL,
    PRIMARY KEY(mapping_id,user_id),
    FOREIGN KEY(space_id,user_id) REFERENCES private_space_members(space_id,user_id) ON DELETE CASCADE
   );
   CREATE INDEX ON private_space_oidc_grants(user_id);
  `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DELETE FROM private_space_members WHERE NOT manual_invited; UPDATE private_space_members SET accepted = manual_accepted; DROP TABLE private_space_oidc_grants; DROP TABLE private_space_group_mappings; ALTER TABLE private_space_members DROP COLUMN manual_invited, DROP COLUMN manual_accepted;`)
		return err
	})
}
