package admins

import (
	"net/http"

	"justapps-backend/functions/apphealth"
	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func GetHealth(c *gin.Context, db *bun.DB) {
	response, err := apphealth.Load(c.Request.Context(), db, apphealth.Scope{})
	if err != nil {
		httperror.InternalServerError(c, "health: load apps", err)
		return
	}

	c.JSON(http.StatusOK, response)
}
