package apps

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

const (
	maxRequestTitleLength       = 140
	maxRequestDescriptionLength = 3000
	maxRequestResponseLength    = 1000
	maxOpenRequestsPerUser      = 10

	requestOpen      = "open"
	requestPlanned   = "planned"
	requestFulfilled = "fulfilled"
	requestClosed    = "closed"
)

var requestStatuses = map[string]bool{requestOpen: true, requestPlanned: true, requestFulfilled: true, requestClosed: true}

type requestVoter struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	AvatarURL   string    `json:"avatarUrl"`
}

type requestRow struct {
	ID          uuid.UUID      `bun:"id" json:"id"`
	UserID      uuid.UUID      `bun:"user_id" json:"userId"`
	Username    string         `bun:"username" json:"username"`
	DisplayName string         `bun:"display_name" json:"displayName"`
	AvatarURL   string         `bun:"avatar_url" json:"avatarUrl"`
	Title       string         `bun:"title" json:"title"`
	Description string         `bun:"description" json:"description"`
	Status      string         `bun:"status" json:"status"`
	LinkedAppID *string        `bun:"linked_app_id" json:"linkedAppId"`
	LinkedName  *string        `bun:"linked_app_name" json:"linkedAppName"`
	LinkedIcon  *string        `bun:"linked_app_icon" json:"linkedAppIcon"`
	Response    string         `bun:"response" json:"response"`
	Votes       int            `bun:"votes" json:"votes"`
	Voters      []requestVoter `bun:"voters,type:jsonb" json:"voters"`
	Voted       bool           `bun:"voted" json:"voted"`
	Mine        bool           `bun:"-" json:"mine"`
	CanModerate bool           `bun:"-" json:"canModerate"`
	// CanRespond: moderators and the owner of the app a request points at.
	CanRespond bool      `bun:"-" json:"canRespond"`
	CreatedAt  time.Time `bun:"created_at" json:"createdAt"`
	UpdatedAt  time.Time `bun:"updated_at" json:"updatedAt"`
}

const requestSelect = `
	SELECT r.id, r.user_id, COALESCE(u.username, '') AS username, COALESCE(u.display_name, '') AS display_name, COALESCE(u.avatar_url, '') AS avatar_url,
	       r.title, r.description, r.status, r.linked_app_id, la.name AS linked_app_name, la.icon AS linked_app_icon, r.response,
	       (SELECT COUNT(*) FROM app_request_votes v WHERE v.request_id = r.id) AS votes,
	       EXISTS (SELECT 1 FROM app_request_votes v WHERE v.request_id = r.id AND v.user_id = ?) AS voted,
	       COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id', vu.id, 'username', COALESCE(vu.username, ''),
           'displayName', COALESCE(vu.display_name, ''), 'avatarUrl', COALESCE(vu.avatar_url, '')
       ) ORDER BY v.created_at, v.user_id)
       FROM app_request_votes v JOIN users vu ON vu.id = v.user_id
       WHERE v.request_id = r.id), '[]'::jsonb) AS voters,
       r.created_at, r.updated_at
	FROM app_requests AS r
	LEFT JOIN users AS u ON u.id = r.user_id
	LEFT JOIN apps AS la ON la.id = r.linked_app_id AND la.space_id IS NULL AND la.is_hidden = false AND LOWER(TRIM(COALESCE(la.status, ''))) NOT IN ('draft', 'entwurf')`

func canModerateRequests(role string) bool {
	return permissions.Has(role, permissions.EditApps)
}

func (r *requestRow) decorate(viewer uuid.UUID, hasViewer bool, role string) {
	r.Mine = hasViewer && r.UserID == viewer
	r.CanModerate = hasViewer && canModerateRequests(role)
}

// markResponders sets who may answer each request: moderators, and the owner
// of the app a request is linked to.
func markResponders(c *gin.Context, db *bun.DB, rows []requestRow, viewer uuid.UUID, hasViewer bool) {
	if !hasViewer {
		return
	}
	owned := map[string]bool{}
	var ids []string
	for _, row := range rows {
		if row.LinkedAppID != nil {
			ids = append(ids, *row.LinkedAppID)
		}
	}
	if len(ids) > 0 {
		var mine []string
		if err := db.NewSelect().Table("apps").Column("id").Where("id IN (?) AND owner_id = ?", bun.In(ids), viewer).Scan(c.Request.Context(), &mine); err == nil {
			for _, id := range mine {
				owned[id] = true
			}
		}
	}
	for i := range rows {
		rows[i].CanRespond = rows[i].CanModerate || (rows[i].LinkedAppID != nil && owned[*rows[i].LinkedAppID])
	}
}

func loadRequest(c *gin.Context, db *bun.DB, id uuid.UUID, viewer uuid.UUID) (requestRow, error) {
	var row requestRow
	err := db.NewRaw(requestSelect+` WHERE r.id = ?`, viewer, id).Scan(c.Request.Context(), &row)
	return row, err
}

// ListRequests returns the Bedarfsmeldungen, most wanted first by default.
func ListRequests(c *gin.Context, db *bun.DB) {
	if !ensureAppStoreAccess(c, db) {
		return
	}
	viewer, role, hasViewer := getViewerContext(c)
	status := strings.TrimSpace(c.Query("status"))
	sort := c.Query("sort")

	query := requestSelect + ` WHERE true`
	args := []any{viewer}
	switch status {
	case "", "all":
	case "active":
		query += ` AND r.status IN ('open', 'planned')`
	default:
		if !requestStatuses[status] {
			httperror.StatusBadRequest(c, "Unbekannter Status", errors.New("invalid status"))
			return
		}
		query += ` AND r.status = ?`
		args = append(args, status)
	}
	if sort == "new" {
		query += ` ORDER BY r.created_at DESC`
	} else {
		query += ` ORDER BY votes DESC, r.created_at DESC`
	}
	query += ` LIMIT 200`

	rows := []requestRow{}
	if err := db.NewRaw(query, args...).Scan(c.Request.Context(), &rows); err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldungen konnten nicht geladen werden", err)
		return
	}
	for i := range rows {
		rows[i].decorate(viewer, hasViewer, role)
	}
	markResponders(c, db, rows, viewer, hasViewer)
	c.JSON(http.StatusOK, rows)
}

type createRequestBody struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CreateRequest posts a new Bedarfsmeldung; the author's vote counts from the start.
func CreateRequest(c *gin.Context, db *bun.DB) {
	viewer, role, ok := getViewerContext(c)
	if !ok {
		httperror.Unauthorized(c, "Anmeldung erforderlich", errors.New("unauthorized"))
		return
	}
	var body createRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Eingabe", err)
		return
	}
	title := strings.TrimSpace(body.Title)
	description := strings.TrimSpace(body.Description)
	if title == "" {
		httperror.StatusBadRequest(c, "Bitte geben Sie einen Titel an", errors.New("title required"))
		return
	}
	if len([]rune(title)) > maxRequestTitleLength || len([]rune(description)) > maxRequestDescriptionLength {
		httperror.StatusBadRequest(c, "Titel oder Beschreibung sind zu lang", errors.New("too long"))
		return
	}

	ctx := c.Request.Context()
	if !canModerateRequests(role) {
		open, err := db.NewSelect().Table("app_requests").Where("user_id = ? AND status IN ('open', 'planned')", viewer).Count(ctx)
		if err != nil {
			httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht gespeichert werden", err)
			return
		}
		if open >= maxOpenRequestsPerUser {
			httperror.StatusConflict(c, "Sie haben bereits zehn offene Bedarfsmeldungen. Schließen Sie erst eine davon.", errors.New("too many open requests"))
			return
		}
	}

	id := uuid.New()
	err := db.RunInTx(ctx, nil, func(ctx2 context.Context, tx bun.Tx) error {
		if _, err := tx.NewRaw(`INSERT INTO app_requests (id, user_id, title, description) VALUES (?, ?, ?, ?)`, id, viewer, title, description).Exec(ctx2); err != nil {
			return err
		}
		_, err := tx.NewRaw(`INSERT INTO app_request_votes (request_id, user_id) VALUES (?, ?)`, id, viewer).Exec(ctx2)
		return err
	})
	if err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht gespeichert werden", err)
		return
	}
	audit.WriteAudit(ctx, db, viewer.String(), "request.create", "created request "+title)

	row, err := loadRequest(c, db, id, viewer)
	if err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht geladen werden", err)
		return
	}
	row.decorate(viewer, true, role)
	row.CanRespond = row.CanModerate
	c.JSON(http.StatusCreated, row)
}

// SetRequestVote adds or removes the viewer's vote.
func SetRequestVote(c *gin.Context, db *bun.DB, voted bool) {
	viewer, role, ok := getViewerContext(c)
	if !ok {
		httperror.Unauthorized(c, "Anmeldung erforderlich", errors.New("unauthorized"))
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperror.StatusNotFound(c, "Bedarfsmeldung nicht gefunden", err)
		return
	}
	current, err := loadRequest(c, db, id, viewer)
	if err != nil {
		httperror.StatusNotFound(c, "Bedarfsmeldung nicht gefunden", err)
		return
	}
	if voted && (current.Status == requestFulfilled || current.Status == requestClosed) {
		httperror.StatusConflict(c, "Für diese Bedarfsmeldung kann nicht mehr abgestimmt werden", errors.New("request is done"))
		return
	}
	ctx := c.Request.Context()
	if voted {
		_, err = db.NewRaw(`INSERT INTO app_request_votes (request_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, id, viewer).Exec(ctx)
	} else {
		_, err = db.NewRaw(`DELETE FROM app_request_votes WHERE request_id = ? AND user_id = ?`, id, viewer).Exec(ctx)
	}
	if err != nil {
		httperror.InternalServerError(c, "Die Stimme konnte nicht gespeichert werden", err)
		return
	}
	row, err := loadRequest(c, db, id, viewer)
	if err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht geladen werden", err)
		return
	}
	one := []requestRow{row}
	one[0].decorate(viewer, true, role)
	markResponders(c, db, one, viewer, true)
	c.JSON(http.StatusOK, one[0])
}

type updateRequestBody struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	LinkedAppID *string `json:"linkedAppId"`
	Response    *string `json:"response"`
}

// UpdateRequest edits a Bedarfsmeldung. The author may reword it while it is
// open and close it; moderators, and the owner of the app it is linked to,
// set the status, link an app and answer.
func UpdateRequest(c *gin.Context, db *bun.DB) {
	viewer, role, ok := getViewerContext(c)
	if !ok {
		httperror.Unauthorized(c, "Anmeldung erforderlich", errors.New("unauthorized"))
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperror.StatusNotFound(c, "Bedarfsmeldung nicht gefunden", err)
		return
	}
	var body updateRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		httperror.StatusBadRequest(c, "Ungültige Eingabe", err)
		return
	}
	ctx := c.Request.Context()
	current, err := loadRequest(c, db, id, viewer)
	if err != nil {
		httperror.StatusNotFound(c, "Bedarfsmeldung nicht gefunden", err)
		return
	}

	moderator := canModerateRequests(role)
	author := current.UserID == viewer
	// The owner of the app a request points at may answer it.
	linkedOwner := false
	if current.LinkedAppID != nil {
		linkedOwner, _ = db.NewSelect().Table("apps").Where("id = ? AND owner_id = ?", *current.LinkedAppID, viewer).Exists(ctx)
	}
	if !moderator && !author && !linkedOwner {
		httperror.Forbidden(c, "Sie dürfen diese Bedarfsmeldung nicht ändern", errors.New("not allowed"))
		return
	}

	set := db.NewUpdate().Table("app_requests").Where("id = ?", id)
	changed := false

	if body.Title != nil || body.Description != nil {
		if !(moderator || (author && current.Status == requestOpen)) {
			httperror.Forbidden(c, "Titel und Beschreibung lassen sich nur ändern, solange die Bedarfsmeldung offen ist", errors.New("not editable"))
			return
		}
		if body.Title != nil {
			title := strings.TrimSpace(*body.Title)
			if title == "" || len([]rune(title)) > maxRequestTitleLength {
				httperror.StatusBadRequest(c, "Ungültiger Titel", errors.New("invalid title"))
				return
			}
			set = set.Set("title = ?", title)
			changed = true
		}
		if body.Description != nil {
			description := strings.TrimSpace(*body.Description)
			if len([]rune(description)) > maxRequestDescriptionLength {
				httperror.StatusBadRequest(c, "Die Beschreibung ist zu lang", errors.New("too long"))
				return
			}
			set = set.Set("description = ?", description)
			changed = true
		}
	}

	if body.Status != nil {
		status := *body.Status
		if !requestStatuses[status] {
			httperror.StatusBadRequest(c, "Unbekannter Status", errors.New("invalid status"))
			return
		}
		// The author may only close their own request or reopen it.
		authorOnly := !moderator && !linkedOwner
		if authorOnly && status != requestClosed && status != requestOpen {
			httperror.Forbidden(c, "Nur das Team kann den Status ändern", errors.New("not allowed"))
			return
		}
		if authorOnly && current.Status != requestOpen && current.Status != requestClosed {
			httperror.Forbidden(c, "Nur das Team kann den Status ändern", errors.New("not allowed"))
			return
		}
		set = set.Set("status = ?", status)
		changed = true
	}

	if body.LinkedAppID != nil {
		if !moderator && !linkedOwner {
			httperror.Forbidden(c, "Nur das Team kann eine App verknüpfen", errors.New("not allowed"))
			return
		}
		appID := strings.TrimSpace(*body.LinkedAppID)
		if appID == "" {
			set = set.Set("linked_app_id = NULL")
		} else {
			// Only apps everyone can see, so the link never points at something hidden.
			exists, err := db.NewSelect().Table("apps").Where("id = ? AND space_id IS NULL AND is_hidden = false AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('draft', 'entwurf')", appID).Exists(ctx)
			if err != nil || !exists {
				httperror.StatusBadRequest(c, "Diese App gibt es im Katalog nicht", errors.New("app not found"))
				return
			}
			set = set.Set("linked_app_id = ?", appID)
		}
		changed = true
	}

	if body.Response != nil {
		if !moderator && !linkedOwner {
			httperror.Forbidden(c, "Nur das Team kann antworten", errors.New("not allowed"))
			return
		}
		response := strings.TrimSpace(*body.Response)
		if len([]rune(response)) > maxRequestResponseLength {
			httperror.StatusBadRequest(c, "Die Antwort ist zu lang", errors.New("too long"))
			return
		}
		set = set.Set("response = ?", response).Set("responded_by = ?", viewer)
		changed = true
	}

	if !changed {
		httperror.StatusBadRequest(c, "Nichts zu ändern", errors.New("no changes"))
		return
	}
	if _, err := set.Set("updated_at = now()").Exec(ctx); err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht gespeichert werden", err)
		return
	}
	audit.WriteAudit(ctx, db, viewer.String(), "request.update", "updated request "+current.Title)

	row, err := loadRequest(c, db, id, viewer)
	if err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht geladen werden", err)
		return
	}
	one := []requestRow{row}
	one[0].decorate(viewer, true, role)
	markResponders(c, db, one, viewer, true)
	c.JSON(http.StatusOK, one[0])
}

// DeleteRequest removes a Bedarfsmeldung: its author, or a moderator.
func DeleteRequest(c *gin.Context, db *bun.DB) {
	viewer, role, ok := getViewerContext(c)
	if !ok {
		httperror.Unauthorized(c, "Anmeldung erforderlich", errors.New("unauthorized"))
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperror.StatusNotFound(c, "Bedarfsmeldung nicht gefunden", err)
		return
	}
	current, err := loadRequest(c, db, id, viewer)
	if err != nil {
		httperror.StatusNotFound(c, "Bedarfsmeldung nicht gefunden", err)
		return
	}
	if current.UserID != viewer && !canModerateRequests(role) {
		httperror.Forbidden(c, "Sie dürfen diese Bedarfsmeldung nicht löschen", errors.New("not allowed"))
		return
	}
	if _, err := db.NewRaw(`DELETE FROM app_requests WHERE id = ?`, id).Exec(c.Request.Context()); err != nil {
		httperror.InternalServerError(c, "Bedarfsmeldung konnte nicht gelöscht werden", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, viewer.String(), "request.delete", "deleted request "+current.Title)
	c.Status(http.StatusNoContent)
}
