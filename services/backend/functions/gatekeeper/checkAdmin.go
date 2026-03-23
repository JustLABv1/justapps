package gatekeeper

import (
	"context"

	"justapps-backend/pkg/models"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func CheckAdmin(userID uuid.UUID, db *bun.DB) (bool, error) {
	ctx := context.Background()
	user := new(models.Users)
	err := db.NewSelect().Model(user).Where("id = ?", userID).Scan(ctx)
	if err != nil {
		log.WithError(err).WithField("userID", userID).Error("CheckAdmin: Failed to find user")
		return false, err
	}

	if user.Role != "admin" {
		log.WithFields(log.Fields{
			"userID": userID,
			"role":   user.Role,
		}).Warn("CheckAdmin: User does not have admin role")
		return false, nil
	} else {
		return true, nil
	}
}
