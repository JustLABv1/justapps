package gatekeeper

import (
	"context"

	"justwms-backend/pkg/models"

	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

func CheckAccountStatus(userId string, db *bun.DB) (bool, error) {
	ctx := context.Background()
	user := new(models.Users)
	err := db.NewSelect().Model(user).Where("id = ?", userId).Scan(ctx)
	if err != nil {
		return false, err
	}

	if user.Disabled {
		return true, nil
	} else {
		return false, nil
	}
}
