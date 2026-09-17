package httperror

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// StatusBadGateway reports an unavailable or rejecting upstream dependency
// without exposing provider URLs, tokens, or raw response bodies to clients.
func StatusBadGateway(context *gin.Context, message string, err error) {
	if err != nil {
		log.Printf("[ERROR] %s: %s", message, err.Error())
	}
	context.JSON(http.StatusBadGateway, gin.H{"message": message})
}
