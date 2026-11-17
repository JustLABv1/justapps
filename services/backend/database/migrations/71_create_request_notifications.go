package migrations

import (
	"context"
	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `CREATE TABLE user_request_notifications (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID NOT NULL,
   request_id UUID NOT NULL REFERENCES app_requests(id) ON DELETE CASCADE,
   kind TEXT NOT NULL CHECK (kind IN ('response', 'fulfilled')),
   response TEXT NOT NULL DEFAULT '',
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   seen_at TIMESTAMPTZ
  );
  CREATE INDEX user_request_notifications_user_idx ON user_request_notifications (user_id, created_at DESC);
  CREATE INDEX user_request_notifications_unread_idx ON user_request_notifications (user_id) WHERE seen_at IS NULL;`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS user_request_notifications`)
		return err
	})
}
