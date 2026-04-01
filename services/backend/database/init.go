package database

import (
	"context"
	"database/sql"
	"fmt"
	"runtime"
	"strconv"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bunotel"
	"github.com/uptrace/bun/migrate"

	"justapps-backend/database/migrations"

	log "github.com/sirupsen/logrus"
)

func StartPostgres(dbServer string, dbPort int, dbUser string, dbPass string, dbName string) *bun.DB {
	log.Info("Connecting to PostgreSQL database...")

	pgconn := pgdriver.NewConnector(
		pgdriver.WithAddr(dbServer+":"+strconv.Itoa(dbPort)),
		pgdriver.WithUser(dbUser),
		pgdriver.WithPassword(dbPass),
		pgdriver.WithDatabase(dbName),
		pgdriver.WithApplicationName("exflow"),
		pgdriver.WithTLSConfig(nil),
	)

	sqldb := sql.OpenDB(pgconn)
	db := bun.NewDB(sqldb, pgdialect.New(), bun.WithDiscardUnknownColumns())
	db.AddQueryHook(bunotel.NewQueryHook(bunotel.WithDBName(dbName)))

	maxOpenConns := 4 * runtime.GOMAXPROCS(0)
	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxOpenConns)

	// Create a new migrator
	migrator := migrate.NewMigrator(db, migrations.Migrations)

	// Run migrations
	ctx := context.Background()
	if err := migrator.Init(ctx); err != nil {
		log.Fatal(err)
	}

	if err := migrator.Lock(ctx); err != nil {
		log.Fatal(err)
	}
	defer migrator.Unlock(ctx)

	group, err := migrator.Migrate(ctx)
	if err != nil {
		log.Fatal(err)
	}

	log.Info("Database connected successfully")

	if group.ID == 0 {
		log.Info("No migrations to run.")
	} else {
		log.Infof("Migrated to %s\n", group)
	}

	if err := ensureAppsCreatedAtColumn(ctx, db); err != nil {
		log.Fatal(err)
	}

	SeedDatabase(db)

	return db
}

func StartDatabase(dbDriver string, dbServer string, dbPort int, dbUser, dbPass, dbName string) *bun.DB {
	log.Info("Starting database connection...")
	switch dbDriver {
	case "postgres":
		return StartPostgres(dbServer, dbPort, dbUser, dbPass, dbName)
	default:
		log.Fatalf("Unsupported database type: %s", dbDriver)
		return nil
	}
}

func ensureAppsCreatedAtColumn(ctx context.Context, db *bun.DB) error {
	_, err := db.ExecContext(ctx, `
		ALTER TABLE apps
			ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
	`)
	if err != nil {
		return fmt.Errorf("ensure apps.created_at column exists: %w", err)
	}

	_, err = db.ExecContext(ctx, `
		UPDATE apps AS a
		SET created_at = audit_rows.created_at
		FROM (
			SELECT substring(details from '\\(([^)]+)\\)$') AS app_id, MIN(created_at) AS created_at
			FROM audit
			WHERE operation = 'app.create'
			  AND details ~ '\\([0-9a-fA-F-]{36}\\)$'
			GROUP BY 1
		) AS audit_rows
		WHERE a.id = audit_rows.app_id
		  AND a.created_at IS NULL
	`)
	if err != nil {
		return fmt.Errorf("backfill apps.created_at from audit: %w", err)
	}

	_, err = db.ExecContext(ctx, `
		UPDATE apps
		SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)
		WHERE created_at IS NULL
	`)
	if err != nil {
		return fmt.Errorf("fallback backfill for apps.created_at: %w", err)
	}

	_, err = db.ExecContext(ctx, `
		ALTER TABLE apps
			ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
			ALTER COLUMN created_at SET NOT NULL
	`)
	if err != nil {
		return fmt.Errorf("finalize apps.created_at column: %w", err)
	}

	return nil
}
