package migrations

import (
	"context"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS roles (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS role_permissions (
    role_key TEXT NOT NULL REFERENCES roles(key) ON UPDATE CASCADE ON DELETE CASCADE,
    permission TEXT NOT NULL,
    PRIMARY KEY (role_key, permission)
);
INSERT INTO roles (key, name, description, is_system) VALUES
    ('user', 'Benutzer', 'Standardzugriff ohne Moderationsrechte.', TRUE),
    ('moderator', 'Moderator', 'Moderiert FAQ-Inhalte und Apps.', TRUE),
    ('admin', 'Administrator', 'Uneingeschränkter Zugriff auf Plattform und Verwaltung.', TRUE)
ON CONFLICT (key) DO NOTHING;
INSERT INTO role_permissions (role_key, permission) VALUES
    ('moderator', 'faq:moderate'),
    ('moderator', 'apps:moderate')
ON CONFLICT DO NOTHING;
`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS role_permissions; DROP TABLE IF EXISTS roles;`)
		return err
	})
}
