package router

import (
	"just-apps-backend/config"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"

	log "github.com/sirupsen/logrus"
)

func StartRouter(db *bun.DB, port int, config *config.RestfulConf) *http.Server {
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	corsConfig := cors.DefaultConfig()
	if len(config.CORS.AllowedOrigins) > 0 {
		corsConfig.AllowOrigins = config.CORS.AllowedOrigins
	} else {
		corsConfig.AllowOrigins = []string{"*"}
	}
	corsConfig.AllowMethods = []string{"GET", "HEAD", "POST", "PUT", "OPTIONS", "DELETE"}
	corsConfig.AllowHeaders = []string{"Origin", "Authorization", "X-Requested-With", "Content-Type"}
	corsConfig.ExposeHeaders = []string{"Content-Length"}
	corsConfig.AllowCredentials = true
	corsConfig.MaxAge = 12 * time.Hour

	router.Use(cors.New(corsConfig))

	v1 := router.Group("/api/v1")
	{
		Auth(v1, db)
		Token(v1, db)
		User(v1, db)
		Health(v1)
		Admin(v1, db)
		RegisterApps(v1, db)
		RegisterSettings(v1, db)
		RegisterUploads(v1, db, config.DataPath)
	}

	server := &http.Server{
		Addr:    ":" + strconv.Itoa(port),
		Handler: router,
	}

	go func() {
		log.Info("Starting Router on port ", strconv.Itoa(port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v\n", err)
		}
	}()

	return server
}
