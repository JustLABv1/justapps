package router

import (
	backendmetrics "justapps-backend/functions/metrics"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

func Metrics(router *gin.Engine, db *bun.DB) {
	router.GET("/metrics", gin.WrapH(backendmetrics.Handler(db)))
}
