package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
   CREATE TABLE private_spaces (
    id UUID PRIMARY KEY, name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE TABLE private_space_members (
    space_id UUID NOT NULL REFERENCES private_spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY(space_id, user_id)
   );
   CREATE INDEX ON private_space_members(user_id);
   ALTER TABLE apps ADD COLUMN IF NOT EXISTS space_id UUID;
 ALTER TABLE apps ADD CONSTRAINT apps_space_id_fkey FOREIGN KEY (space_id) REFERENCES private_spaces(id) ON DELETE RESTRICT;
   CREATE INDEX ON apps(space_id);
  `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `ALTER TABLE apps DROP COLUMN space_id; DROP TABLE private_space_members; DROP TABLE private_spaces;`)
		return err
	})
}
