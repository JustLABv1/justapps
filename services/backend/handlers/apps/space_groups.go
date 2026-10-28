package apps

import (
	"context"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"justapps-backend/config"
	authfunc "justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/functions/spacemembership"
	"justapps-backend/pkg/models"
	"justapps-backend/pkg/permissions"
	"strings"
)

func ListSpaceGroupMappings(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, true, permissions.ManageSpaceGroups)
	if !ok {
		return
	}
	mappings := make([]models.PrivateSpaceGroupMapping, 0)
	if err := db.NewSelect().Model(&mappings).Where("space_id = ?", space.ID).Order("provider_key", "group_name").Scan(c); err != nil {
		httperror.InternalServerError(c, "Gruppenzuordnungen konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, mappings)
}
func AddSpaceGroupMapping(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, true, permissions.ManageSpaceGroups)
	if !ok {
		return
	}
	var body struct {
		ProviderKey string `json:"providerKey"`
		GroupName   string `json:"groupName"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Gruppenzuordnung", err)
		return
	}
	body.ProviderKey = authfunc.NormalizeOIDCProviderKey(body.ProviderKey)
	body.GroupName = strings.TrimSpace(body.GroupName)
	if body.ProviderKey == "" || body.GroupName == "" || len([]rune(body.GroupName)) > 512 {
		httperror.StatusBadRequest(c, "Provider und exakter Gruppenname sind erforderlich", errors.New("invalid group mapping"))
		return
	}
	provider, found, err := authfunc.ResolveOIDCProvider(c, db, config.Config, body.ProviderKey)
	if err != nil {
		httperror.InternalServerError(c, "Provider konnte nicht geladen werden", err)
		return
	}
	if !found || !provider.Enabled {
		httperror.StatusBadRequest(c, "Kein aktiver OIDC-Provider gefunden", errors.New("provider unavailable"))
		return
	}
	mapping := models.PrivateSpaceGroupMapping{ID: uuid.New(), SpaceID: space.ID, ProviderKey: provider.Key, Issuer: provider.Issuer, GroupName: body.GroupName}
	if _, err := db.NewInsert().Model(&mapping).On("CONFLICT (space_id, provider_key, issuer, group_name) DO NOTHING").Exec(c); err != nil {
		httperror.InternalServerError(c, "Gruppenzuordnung konnte nicht gespeichert werden", err)
		return
	}
	c.Status(204)
}
func DeleteSpaceGroupMapping(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, true, permissions.ManageSpaceGroups)
	if !ok {
		return
	}
	err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().Model((*models.PrivateSpaceGroupMapping)(nil)).Where("space_id = ? AND id::text = ?", space.ID, c.Param("mappingId")).Exec(ctx); err != nil {
			return err
		}
		return spacemembership.Reconcile(ctx, tx, "m.space_id = ?", space.ID)
	})
	if err != nil {
		httperror.InternalServerError(c, "Gruppenzuordnung konnte nicht entfernt werden", err)
		return
	}
	c.Status(204)
}
