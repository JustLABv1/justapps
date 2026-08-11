package tokens

import (
	"net/http"

	"justapps-backend/functions/auth"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// Logout clears the browser session cookie and revokes a local JWT when the
// cookie represents one. OIDC session JWTs are stateless and are invalidated
// by clearing the cookie.
func Logout(c *gin.Context, db *bun.DB) {
	token := auth.CleanToken(auth.TokenFromRequest(c))
	if token != "" {
		_, _ = db.NewDelete().Model((*models.Tokens)(nil)).Where("key = ?", token).Exec(c.Request.Context())
	}
	auth.ClearSessionCookie(c)
	c.JSON(http.StatusOK, gin.H{"result": "success"})
}
