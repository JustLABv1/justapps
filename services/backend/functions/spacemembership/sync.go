package spacemembership

import (
	"context"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"justapps-backend/pkg/models"
	"strings"
)

// Reconcile keeps manual invitations and group access as independent sources.
// scope is an internal SQL predicate, never user input.
func Reconcile(ctx context.Context, tx bun.Tx, scope string, args ...interface{}) error {
	if _, err := tx.NewRaw(`UPDATE private_space_members m SET accepted = m.manual_accepted OR EXISTS (SELECT 1 FROM private_space_oidc_grants g WHERE g.space_id = m.space_id AND g.user_id = m.user_id) WHERE `+scope, args...).Exec(ctx); err != nil {
		return err
	}
	_, err := tx.NewRaw(`DELETE FROM private_space_members m WHERE NOT m.manual_invited AND NOT EXISTS (SELECT 1 FROM private_space_oidc_grants g WHERE g.space_id = m.space_id AND g.user_id = m.user_id) AND `+scope, args...).Exec(ctx)
	return err
}

func NormalizeGroups(groups []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group != "" && !seen[group] {
			result = append(result, group)
			seen[group] = true
		}
	}
	return result
}

// Called only after ID-token signature, issuer, audience and nonce validation.
func SyncOIDCGroups(ctx context.Context, db *bun.DB, userID uuid.UUID, providerKey, issuer string, groups []string) error {
	groups = NormalizeGroups(groups)
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// Serialize concurrent logins for the same account.
		var user models.Users
		if err := tx.NewSelect().Model(&user).Column("id").Where("id = ?", userID).For("UPDATE").Scan(ctx); err != nil {
			return err
		}
		if _, err := tx.NewRaw(`DELETE FROM user_oidc_groups WHERE user_id = ? AND provider_key = ?`, userID, providerKey).Exec(ctx); err != nil {
			return err
		}
		for _, group := range groups {
			if _, err := tx.NewRaw(`INSERT INTO user_oidc_groups(user_id,provider_key,issuer,group_name) VALUES (?,?,?,?)`, userID, providerKey, issuer, group).Exec(ctx); err != nil {
				return err
			}
		}
		if _, err := tx.NewRaw(`DELETE FROM private_space_oidc_grants g USING private_space_group_mappings m WHERE g.mapping_id = m.id AND g.user_id = ? AND m.provider_key = ?`, userID, providerKey).Exec(ctx); err != nil {
			return err
		}
		if len(groups) > 0 {
			mappings := make([]models.PrivateSpaceGroupMapping, 0)
			// Shared locks prevent mapping deletion racing with a successful grant.
			if err := tx.NewSelect().Model(&mappings).Where("provider_key = ? AND issuer = ? AND group_name IN (?)", providerKey, issuer, bun.In(groups)).For("SHARE").Scan(ctx); err != nil {
				return err
			}
			for _, mapping := range mappings {
				if _, err := tx.NewRaw(`INSERT INTO private_space_members (space_id,user_id,accepted,manual_invited,manual_accepted) VALUES (?,?,true,false,false) ON CONFLICT (space_id,user_id) DO NOTHING`, mapping.SpaceID, userID).Exec(ctx); err != nil {
					return err
				}
				if _, err := tx.NewRaw(`INSERT INTO private_space_oidc_grants (mapping_id,space_id,user_id) VALUES (?,?,?) ON CONFLICT DO NOTHING`, mapping.ID, mapping.SpaceID, userID).Exec(ctx); err != nil {
					return err
				}
			}
		}
		return Reconcile(ctx, tx, "m.user_id = ?", userID)
	})
}
