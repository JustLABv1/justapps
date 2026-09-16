package auths

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// recordOIDCLogin updates the login activity only after OIDC authentication and
// session creation succeeded. Callers deliberately treat an update failure as
// non-fatal so an unavailable activity field cannot block a valid login.
func recordOIDCLogin(ctx context.Context, db *bun.DB, userID uuid.UUID, loggedInAt time.Time) error {
	_, err := db.NewUpdate().TableExpr("users").
		Set("last_login_at = ?", loggedInAt).
		Where("id = ?", userID).
		Exec(ctx)
	return err
}
