package audit

import (
	"context"

	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

// WriteAudit inserts a single audit record. Failures are logged but never fatal
// so that an audit write error never blocks the primary operation.
func WriteAudit(ctx context.Context, db *bun.DB, userID, operation, details string) {
	entry := &models.Audit{
		UserID:    userID,
		Operation: operation,
		Details:   details,
	}
	if _, err := db.NewInsert().Model(entry).Exec(ctx); err != nil {
		log.WithError(err).Warnf("audit: failed to write log for operation %q (user %s)", operation, userID)
	}
}
