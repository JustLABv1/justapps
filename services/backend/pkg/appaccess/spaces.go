package appaccess

import (
	"context"
	"github.com/uptrace/bun"
)

// SpaceSQL deliberately has no platform-role bypass: membership controls privacy.
func SpaceSQL(alias string) string {
	return "(" + alias + ".space_id IS NULL OR " + alias + ".owner_id::text = ? OR EXISTS (SELECT 1 FROM private_spaces ps WHERE ps.id = " + alias + ".space_id AND (ps.owner_id::text = ? OR EXISTS (SELECT 1 FROM private_space_members sm WHERE sm.space_id = ps.id AND sm.user_id::text = ? AND sm.accepted))))"
}
func FilterSpaces(q *bun.SelectQuery, alias, userID string) *bun.SelectQuery {
	return q.Where(SpaceSQL(alias), userID, userID, userID)
}
func HasSpace(ctx context.Context, db *bun.DB, spaceID, userID string) (bool, error) {
	return db.NewSelect().TableExpr("private_spaces ps").Where("ps.id::text = ?", spaceID).Where("ps.owner_id::text = ? OR EXISTS (SELECT 1 FROM private_space_members sm WHERE sm.space_id = ps.id AND sm.user_id::text = ? AND sm.accepted)", userID, userID).Exists(ctx)
}
