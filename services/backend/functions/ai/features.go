package ai

import (
	"context"
	"database/sql"
	"errors"

	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

// IsEnabled returns the platform-level AI feature flag. Missing settings keep
// the historical default of having AI enabled.
func IsEnabled(ctx context.Context, db *bun.DB) (bool, error) {
	if db == nil {
		return true, nil
	}

	var settings models.PlatformSettings
	if err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	return settings.AIEnabled, nil
}
