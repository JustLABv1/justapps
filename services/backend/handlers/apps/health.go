package apps

import (
	"errors"
	"net/http"

	"justapps-backend/functions/apphealth"
	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

func GetMyHealth(c *gin.Context, db *bun.DB) {
	viewerID, _, hasViewer := getViewerContext(c)
	if !hasViewer || viewerID == uuid.Nil {
		httperror.Unauthorized(c, "A user session is required", errors.New("missing user session"))
		return
	}

	response, err := apphealth.Load(c.Request.Context(), db, apphealth.Scope{EditableBy: &viewerID})
	if err != nil {
		httperror.InternalServerError(c, "health: load user apps", err)
		return
	}

	c.JSON(http.StatusOK, response)
}
