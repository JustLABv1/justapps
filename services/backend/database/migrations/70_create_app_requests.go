package migrations

import (
	"context"

	"github.com/uptrace/bun"
)

// Bedarfsmeldungen: what people are looking for. A request gets votes, and
// moderators or the owner of the linked app move it along (open → planned →
// fulfilled, or closed).
func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
 CREATE TABLE IF NOT EXISTS app_requests (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID NOT NULL,
   title TEXT NOT NULL,
   description TEXT NOT NULL DEFAULT '',
   status TEXT NOT NULL DEFAULT 'open',
   linked_app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
   response TEXT NOT NULL DEFAULT '',
   responded_by UUID,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 CREATE INDEX IF NOT EXISTS app_requests_status_idx ON app_requests (status, created_at DESC);
 CREATE TABLE IF NOT EXISTS app_request_votes (
   request_id UUID NOT NULL REFERENCES app_requests(id) ON DELETE CASCADE,
   user_id UUID NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   PRIMARY KEY (request_id, user_id)
 );
 `)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS app_request_votes; DROP TABLE IF EXISTS app_requests;`)
		return err
	})
}
