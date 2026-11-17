// Package ai holds the admin endpoint for the catalog search index.
package ai

import (
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// ReindexKnowledge rebuilds the search index of every app.
func ReindexKnowledge(c *gin.Context, db *bun.DB) {
	count, err := aifunc.ReindexAll(c.Request.Context(), db)
	if err != nil {
		httperror.InternalServerError(c, "Suchindex konnte nicht aufgebaut werden", err)
		return
	}
	c.JSON(200, gin.H{"indexedApps": count})
}
