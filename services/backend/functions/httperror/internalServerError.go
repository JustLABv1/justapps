package httperror

import (
	"net/http"

	"log"

	"github.com/gin-gonic/gin"
)

func InternalServerError(context *gin.Context, message string, err error) {
	errorMessage := "Unknown error"
	if err != nil {
		errorMessage = err.Error()
	}
	// Fehlerursache ins Backend-Log schreiben
	log.Printf("[ERROR] %s: %s", message, errorMessage)
	context.JSON(http.StatusInternalServerError, gin.H{"message": message, "error": errorMessage})
}
