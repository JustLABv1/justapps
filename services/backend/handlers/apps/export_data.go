package apps

import (
	"context"

	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

func ExportAppsData(ctx context.Context, db *bun.DB) ([]models.Apps, error) {
	var appList []models.Apps
	if err := db.NewSelect().Model(&appList).Scan(ctx); err != nil {
		return nil, err
	}

	for index := range appList {
		normalizeAppModelStatus(&appList[index])
		normalizeAppDetailFields(&appList[index])
	}

	return appList, nil
}
