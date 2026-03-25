package httperror

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func StatusNotFound(context *gin.Context, message string, err error) {
	if err == nil {
		err = errors.New("not found")
	}
	context.JSON(http.StatusNotFound, gin.H{"message": message, "error": err.Error()})
	context.Abort()
}
