package migrations

import (
	"context"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
INSERT INTO role_permissions (role_key, permission) VALUES
    ('moderator', 'faq:insights:view'),
    ('moderator', 'faq:questions:delete'),
    ('moderator', 'faq:answers:delete'),
    ('moderator', 'faq:answers:pin'),
    ('moderator', 'faq:answers:recommend'),
    ('moderator', 'apps:drafts:view'),
    ('moderator', 'apps:edit'),
    ('moderator', 'apps:delete'),
    ('moderator', 'apps:health:view')
ON CONFLICT DO NOTHING;
DELETE FROM role_permissions WHERE role_key = 'moderator' AND permission IN ('faq:moderate', 'apps:moderate');
`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DELETE FROM role_permissions WHERE permission IN (
    'faq:insights:view', 'faq:questions:delete', 'faq:answers:delete', 'faq:answers:pin', 'faq:answers:recommend',
    'apps:drafts:view', 'apps:edit', 'apps:delete', 'apps:health:view'
);`)
		return err
	})
}
