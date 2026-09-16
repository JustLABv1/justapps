package apps

import (
	"errors"
	"net/http"

	"justapps-backend/functions/apphealth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func GetMyHealth(c *gin.Context, db *bun.DB) {
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	if !hasViewer || viewerID == uuid.Nil {
		httperror.Unauthorized(c, "A user session is required", errors.New("missing user session"))
		return
	}

	scope := apphealth.Scope{}
	if !permissions.Has(viewerRole, permissions.ViewAppHealth) {
		scope.EditableBy = &viewerID
	}
	response, err := apphealth.Load(c.Request.Context(), db, scope)
	if err != nil {
		httperror.InternalServerError(c, "health: load user apps", err)
		return
	}

	c.JSON(http.StatusOK, response)
}
