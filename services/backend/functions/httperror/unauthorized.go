package httperror

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Unauthorized(context *gin.Context, message string, err error) {
	resp := gin.H{"message": message}
	if err != nil {
		resp["error"] = err.Error()
	}
	context.JSON(http.StatusUnauthorized, resp)
	context.Abort()
}
