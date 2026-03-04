package migrations

import (
	"app-store-backend/pkg/models"
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Creating platform_settings table...")

		_, err := db.NewCreateTable().Model((*models.PlatformSettings)(nil)).IfNotExists().Exec(ctx)
		if err != nil {
			return err
		}

		// Insert default settings if not exists
		settings := &models.PlatformSettings{
			ID:                  "default",
			AllowAppSubmissions: true,
		}
		_, err = db.NewInsert().Model(settings).On("CONFLICT (id) DO NOTHING").Exec(ctx)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Dropping platform_settings table...")
		_, err := db.NewDropTable().Model((*models.PlatformSettings)(nil)).IfExists().Exec(ctx)
		return err
	})
}
