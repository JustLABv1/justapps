package httperror

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Forbidden(c *gin.Context, msg string, err error) {
	c.JSON(http.StatusForbidden, gin.H{"message": msg, "error": err.Error()})
}
