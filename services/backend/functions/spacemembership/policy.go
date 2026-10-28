package spacemembership

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/uptrace/bun"
	"justapps-backend/pkg/models"
)

func ValidCreationMode(mode string) bool {
	switch mode {
	case "everyone", "oidc_group", "admins", "allowed_users":
		return true
	}
	return false
}
func CreationDecision(mode string, user models.Users, groupMember bool) bool {
	if user.Disabled {
		return false
	}
	if user.Role == "admin" {
		return true
	}
	switch mode {
	case "everyone":
		return true
	case "allowed_users":
		return user.CanCreateSpaces
	case "oidc_group":
		return groupMember
	default:
		return false
	}
}
func LoadCreationPolicy(ctx context.Context, db *bun.DB) (models.SpaceCreationPolicy, error) {
	policy := models.SpaceCreationPolicy{}
	err := db.NewSelect().Model(&policy).Where("id = ?", "default").Scan(ctx)
	if err == sql.ErrNoRows {
		return models.SpaceCreationPolicy{ID: "default", Mode: "allowed_users"}, nil
	}
	return policy, err
}
func CanCreate(ctx context.Context, db *bun.DB, user models.Users) (bool, error) {
	if user.Disabled {
		return false, nil
	}
	if user.Role == "admin" {
		return true, nil
	}
	policy, err := LoadCreationPolicy(ctx, db)
	if err != nil {
		return false, err
	}
	if !ValidCreationMode(policy.Mode) {
		return false, fmt.Errorf("invalid space creation policy %q", policy.Mode)
	}
	member := false
	if policy.Mode == "oidc_group" {
		member, err = db.NewSelect().TableExpr("user_oidc_groups ug").Join("JOIN oidc_provider_settings p ON p.provider_key = ug.provider_key AND RTRIM(p.issuer, '/') = ug.issuer AND p.enabled").Where("ug.user_id = ? AND ug.provider_key = ? AND ug.issuer = ? AND ug.group_name = ?", user.ID, policy.ProviderKey, policy.Issuer, policy.GroupName).Exists(ctx)
		if err != nil {
			return false, err
		}
	}
	return CreationDecision(policy.Mode, user, member), nil
}
