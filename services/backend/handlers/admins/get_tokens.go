package admins

import (
	"net/http"
	"time"

	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

// adminTokenResponse is a token as the token list shows it: who it belongs to
// and the start of its key, never the key itself. A key is a bearer
// credential, and the list has no use for one.
type adminTokenResponse struct {
	ID             string     `bun:"id" json:"id"`
	Description    string     `bun:"description" json:"description"`
	Type           string     `bun:"type" json:"type"`
	Disabled       bool       `bun:"disabled" json:"disabled"`
	DisabledReason string     `bun:"disabled_reason" json:"disabled_reason"`
	CreatedAt      time.Time  `bun:"created_at" json:"created_at"`
	ExpiresAt      *time.Time `bun:"expires_at" json:"expires_at"`
	UserID         string     `bun:"user_id" json:"user_id"`
	KeyPreview     string     `bun:"key_preview" json:"key_preview"`
	Username       string     `bun:"username" json:"username"`
	Email          string     `bun:"email" json:"email"`
	DisplayName    string     `bun:"display_name" json:"displayName,omitempty"`
	AvatarURL      string     `bun:"avatar_url" json:"avatarUrl,omitempty"`
}

const tokenKeyPreviewLength = 6

func GetTokens(context *gin.Context, db *bun.DB) {
	tokens := make([]adminTokenResponse, 0)
	err := db.NewSelect().
		TableExpr("tokens AS t").
		ColumnExpr("t.id::text AS id, COALESCE(t.description, '') AS description, t.type, COALESCE(t.disabled, false) AS disabled").
		ColumnExpr("COALESCE(t.disabled_reason, '') AS disabled_reason, t.created_at, t.expires_at, COALESCE(t.user_id, '') AS user_id").
		// Only the last characters leave the database. The keys are JWTs, whose
		// start is the same for every token, so the end is what tells them apart.
		ColumnExpr("'…' || RIGHT(t.key, ?) AS key_preview", tokenKeyPreviewLength).
		ColumnExpr("COALESCE(u.username, '') AS username, COALESCE(u.email, '') AS email").
		ColumnExpr("COALESCE(u.display_name, '') AS display_name, COALESCE(u.avatar_url, '') AS avatar_url").
		Join("LEFT JOIN users AS u ON u.id::text = t.user_id").
		OrderExpr("t.expires_at ASC NULLS LAST").
		Scan(context.Request.Context(), &tokens)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting tokens on db", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"tokens": tokens})
}
