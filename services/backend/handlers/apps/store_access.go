package apps

import (
	"database/sql"
	"errors"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func ensureAppStoreAccess(c *gin.Context, db *bun.DB) bool {
	if _, _, hasViewer := getViewerContext(c); hasViewer {
		return true
	}

	var settings models.PlatformSettings
	err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c.Request.Context())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true
		}
		httperror.InternalServerError(c, "Failed to load platform settings", err)
		return false
	}

	if settings.RequireAuthForAppStore {
		httperror.Unauthorized(c, "Anmeldung erforderlich", errors.New("app store requires authentication"))
		return false
	}

	return true
}
