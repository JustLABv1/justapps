package audit

import (
	"context"
	"strings"

	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func ActorID(value any, fallback string) string {
	switch v := value.(type) {
	case string:
		if normalized := strings.TrimSpace(v); normalized != "" {
			return normalized
		}
	case interface{ String() string }:
		if normalized := strings.TrimSpace(v.String()); normalized != "" {
			return normalized
		}
	}

	if normalized := strings.TrimSpace(fallback); normalized != "" {
		return normalized
	}

	return "unknown"
}

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
