package apps

import (
	"context"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"
	"strings"
	"time"
)

func ListSpaces(c *gin.Context, db *bun.DB) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	rows := make([]struct {
		models.PrivateSpace
		Accepted bool `bun:"accepted" json:"accepted"`
	}, 0)
	err := db.NewSelect().TableExpr("private_spaces AS ps").ColumnExpr("ps.*, (ps.owner_id = ? OR COALESCE(m.accepted, false)) AS accepted", id).
		Join("LEFT JOIN private_space_members m ON m.space_id = ps.id AND m.user_id = ?", id).
		Where("ps.owner_id = ? OR m.user_id = ?", id, id).OrderExpr("ps.created_at ASC").Scan(c, &rows)
	if err != nil {
		httperror.InternalServerError(c, "Spaces konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, rows)
}

func CreateSpace(c *gin.Context, db *bun.DB) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" || len([]rune(body.Name)) > 100 {
		httperror.StatusBadRequest(c, "Bitte einen Namen mit maximal 100 Zeichen angeben", errors.New("invalid space name"))
		return
	}
	space := models.PrivateSpace{ID: uuid.New(), Name: strings.TrimSpace(body.Name), OwnerID: id}
	if _, err := db.NewInsert().Model(&space).Exec(c); err != nil {
		httperror.InternalServerError(c, "Space konnte nicht erstellt werden", err)
		return
	}
	c.JSON(201, space)
}

func loadSpace(c *gin.Context, db *bun.DB, ownerOnly bool) (models.PrivateSpace, bool) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return models.PrivateSpace{}, false
	}
	var space models.PrivateSpace
	query := db.NewSelect().Model(&space).Where("ps.id::text = ?", c.Param("spaceId"))
	if ownerOnly {
		query = query.Where("ps.owner_id = ?", id)
	} else {
		query = query.Where("ps.owner_id = ? OR EXISTS (SELECT 1 FROM private_space_members m WHERE m.space_id = ps.id AND m.user_id = ? AND m.accepted)", id, id)
	}
	if err := query.Scan(c); err != nil {
		httperror.StatusNotFound(c, "Space nicht gefunden", err)
		return space, false
	}
	return space, true
}

func ListSpaceMembers(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, false)
	if !ok {
		return
	}
	rows := make([]struct {
		ID       uuid.UUID `json:"id"`
		Username string    `json:"username"`
		Accepted bool      `json:"accepted"`
	}, 0)
	err := db.NewSelect().TableExpr("private_space_members m").ColumnExpr("u.id, u.username, m.accepted").Join("JOIN users u ON u.id = m.user_id").Where("m.space_id = ?", space.ID).OrderExpr("u.username").Scan(c, &rows)
	if err != nil {
		httperror.InternalServerError(c, "Mitglieder konnten nicht geladen werden", err)
		return
	}
	c.JSON(200, rows)
}

func InviteSpaceMember(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, true)
	if !ok {
		return
	}
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Email) == "" {
		httperror.StatusBadRequest(c, "E-Mail-Adresse erforderlich", errors.New("email required"))
		return
	}
	var user models.Users
	if err := db.NewSelect().Model(&user).Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(body.Email))).Where("disabled = false").Scan(c); err != nil {
		httperror.StatusBadRequest(c, "Kein aktives Konto mit dieser E-Mail-Adresse gefunden", errors.New("Kein aktives Konto mit dieser E-Mail-Adresse gefunden"))
		return
	}
	if user.ID == space.OwnerID {
		httperror.StatusBadRequest(c, "Sie sind bereits Eigentümer dieses Spaces", errors.New("Sie sind bereits Eigentümer dieses Spaces"))
		return
	}
	if _, err := db.NewRaw("INSERT INTO private_space_members (space_id,user_id) VALUES (?,?) ON CONFLICT DO NOTHING", space.ID, user.ID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Einladung fehlgeschlagen", err)
		return
	}
	c.Status(204)
}

func AcceptSpaceInvitation(c *gin.Context, db *bun.DB) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	result, err := db.NewRaw("UPDATE private_space_members SET accepted = true WHERE space_id::text = ? AND user_id = ?", c.Param("spaceId"), id).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Einladung konnte nicht angenommen werden", err)
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		httperror.StatusNotFound(c, "Einladung nicht gefunden", nil)
		return
	}
	c.Status(204)
}

func RemoveSpaceMember(c *gin.Context, db *bun.DB) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	if c.Param("userId") != id.String() {
		if _, ok := loadSpace(c, db, true); !ok {
			return
		}
	}
	if _, err := db.NewRaw("DELETE FROM private_space_members WHERE space_id::text = ? AND user_id::text = ?", c.Param("spaceId"), c.Param("userId")).Exec(c); err != nil {
		httperror.InternalServerError(c, "Mitglied konnte nicht entfernt werden", err)
		return
	}
	c.Status(204)
}

// Only the app owner can publish. Ordinary edits always preserve the space.
func PublishSpaceApp(c *gin.Context, db *bun.DB) {
	id, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	var app models.Apps
	if err := db.NewSelect().Model(&app).Where("a.id = ? AND a.owner_id = ? AND a.space_id IS NOT NULL", c.Param("id"), id).Scan(c); err != nil {
		httperror.StatusNotFound(c, "Private App nicht gefunden", err)
		return
	}
	if app.IsLocked {
		httperror.Forbidden(c, "Diese App ist gesperrt", errors.New("Diese App ist gesperrt"))
		return
	}
	if strings.TrimSpace(app.Description) == "" || len(app.Categories) == 0 {
		httperror.StatusBadRequest(c, "Bitte vor der Veröffentlichung Beschreibung und Kategorie ergänzen", errors.New("Bitte vor der Veröffentlichung Beschreibung und Kategorie ergänzen"))
		return
	}
	status := app.Status
	if isDraftApp(app) {
		status = "In Erprobung"
	}
	if _, err := db.NewUpdate().Model((*models.Apps)(nil)).Set("space_id = NULL").Set("is_hidden = false").Set("status = ?", status).Set("updated_at = ?", time.Now()).Where("id = ?", app.ID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Veröffentlichung fehlgeschlagen", err)
		return
	}
	audit.WriteAudit(c, db, id.String(), "app.publish", fmt.Sprintf("published private app %s", app.ID))
	c.Status(204)
}

// Space owners can rename their spaces; membership never grants management rights.
func UpdateSpace(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, true)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" || len([]rune(body.Name)) > 100 {
		httperror.StatusBadRequest(c, "Bitte einen Namen mit maximal 100 Zeichen angeben", errors.New("invalid space name"))
		return
	}
	space.Name = strings.TrimSpace(body.Name)
	if _, err := db.NewUpdate().Model(&space).Column("name").WherePK().Exec(c); err != nil {
		httperror.InternalServerError(c, "Space konnte nicht gespeichert werden", err)
		return
	}
	c.JSON(200, space)
}

// Apps are deleted in the same transaction, so deletion never makes them public.
func DeleteSpace(c *gin.Context, db *bun.DB) {
	space, ok := loadSpace(c, db, true)
	if !ok {
		return
	}
	err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if err := tx.NewSelect().Model(&space).Where("ps.id = ? AND ps.owner_id = ?", space.ID, space.OwnerID).For("UPDATE").Scan(ctx); err != nil {
			return err
		}
		locked, err := tx.NewSelect().Model((*models.Apps)(nil)).Where("space_id = ? AND is_locked = true", space.ID).Exists(ctx)
		if err != nil {
			return err
		}
		if locked {
			return errors.New("Der Space enthält gesperrte Apps. Bitte diese zuerst entsperren lassen.")
		}
		if _, err := tx.NewDelete().Model((*models.Apps)(nil)).Where("space_id = ?", space.ID).Exec(ctx); err != nil {
			return err
		}
		_, err = tx.NewDelete().Model(&space).WherePK().Exec(ctx)
		return err
	})
	if err != nil {
		httperror.InternalServerError(c, "Space konnte nicht gelöscht werden", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, space.OwnerID.String(), "space.delete", fmt.Sprintf("deleted private space %s and its apps", space.ID))
	c.Status(204)
}
