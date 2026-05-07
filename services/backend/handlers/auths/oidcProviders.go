package auths

import (
	"justapps-backend/config"
	authfunc "justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ListOIDCProviders(c *gin.Context, db *bun.DB) {
	providers, err := authfunc.ListOIDCProviderSummaries(c.Request.Context(), db, config.Config)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnten nicht geladen werden", err)
		return
	}

	c.JSON(200, providers)
}
