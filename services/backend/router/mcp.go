package router

import (
	mcpserver "justapps-backend/mcp"
	"justapps-backend/middlewares"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// RegisterMCP exposes the authenticated JustApps MCP Streamable HTTP endpoint.
// MCP clients connect to /api/v1/mcp and send an Authorization bearer token.
func RegisterMCP(router *gin.RouterGroup, db *bun.DB) {
	handler := gin.WrapH(mcpserver.NewHandler(db))
	authenticated := middlewares.Auth(db)

	// GET and DELETE are registered for transport compatibility. The stateless
	// handler intentionally returns 405 for them; current MCP clients use POST.
	router.POST("/mcp", authenticated, handler)
	router.GET("/mcp", authenticated, handler)
	router.DELETE("/mcp", authenticated, handler)
}
