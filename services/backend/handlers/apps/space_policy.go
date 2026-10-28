package apps

import (
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"justapps-backend/config"
	authfunc "justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/functions/spacemembership"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"
	"strings"
)

func GetSpaceCreationEligibility(c *gin.Context, db *bun.DB) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	var user models.Users
	if err := db.NewSelect().Model(&user).Column("id", "role", "disabled", "can_create_spaces").Where("id = ?", id).Scan(c); err != nil {
		httperror.InternalServerError(c, "Berechtigung konnte nicht geprüft werden", err)
		return
	}
	policy, err := spacemembership.LoadCreationPolicy(c, db)
	if err != nil {
		httperror.InternalServerError(c, "Regel konnte nicht geladen werden", err)
		return
	}
	allowed, err := spacemembership.CanCreate(c, db, user)
	if err != nil {
		httperror.InternalServerError(c, "Berechtigung konnte nicht geprüft werden", err)
		return
	}
	c.JSON(200, gin.H{"mode": policy.Mode, "canCreate": allowed})
}
func GetSpaceCreationPolicy(c *gin.Context, db *bun.DB) {
	if !requireSpaceAdmin(c) {
		return
	}
	policy, err := spacemembership.LoadCreationPolicy(c, db)
	if err != nil {
		httperror.InternalServerError(c, "Regel konnte nicht geladen werden", err)
		return
	}
	c.JSON(200, policy)
}
func SetSpaceCreationPolicy(c *gin.Context, db *bun.DB) {
	if !requireSpaceAdmin(c) {
		return
	}
	var policy models.SpaceCreationPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Regel", err)
		return
	}
	policy.ID = "default"
	policy.Mode = strings.TrimSpace(policy.Mode)
	if !spacemembership.ValidCreationMode(policy.Mode) {
		httperror.StatusBadRequest(c, "Unbekannte Erstellungsregel", errors.New("invalid policy mode"))
		return
	}
	if policy.Mode == "oidc_group" {
		policy.GroupName = strings.TrimSpace(policy.GroupName)
		if policy.GroupName == "" || len([]rune(policy.GroupName)) > 512 {
			httperror.StatusBadRequest(c, "Exakte OIDC-Gruppe erforderlich", errors.New("invalid group"))
			return
		}
		provider, found, err := authfunc.ResolveOIDCProvider(c, db, config.Config, policy.ProviderKey)
		if err != nil {
			httperror.InternalServerError(c, "Provider konnte nicht geladen werden", err)
			return
		}
		if !found {
			httperror.StatusBadRequest(c, "Aktiver OIDC-Provider erforderlich", errors.New("provider unavailable"))
			return
		}
		policy.ProviderKey = provider.Key
		policy.Issuer = provider.Issuer
	} else {
		policy.ProviderKey = ""
		policy.Issuer = ""
		policy.GroupName = ""
	}
	if _, err := db.NewInsert().Model(&policy).On("CONFLICT (id) DO UPDATE").Set("mode = EXCLUDED.mode").Set("provider_key = EXCLUDED.provider_key").Set("issuer = EXCLUDED.issuer").Set("group_name = EXCLUDED.group_name").Exec(c); err != nil {
		httperror.InternalServerError(c, "Regel konnte nicht gespeichert werden", err)
		return
	}
	id, _, _ := getViewerContext(c)
	audit.WriteAudit(c.Request.Context(), db, id.String(), "spaces.creation_policy.update", fmt.Sprintf("set creation policy %s provider %s group %s", policy.Mode, policy.ProviderKey, policy.GroupName))
	c.JSON(200, policy)
}
