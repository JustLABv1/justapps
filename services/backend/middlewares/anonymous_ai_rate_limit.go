package middlewares

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	anonymousAIChatLimit  = 20
	anonymousAIChatWindow = 5 * time.Minute
)

type anonymousAIRateBucket struct {
	mu      sync.Mutex
	count   int
	resetAt time.Time
}

var anonymousAIRateBuckets sync.Map

func AnonymousAIChatRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if clientIP == "" {
			clientIP = "unknown"
		}

		now := time.Now().UTC()
		bucketValue, _ := anonymousAIRateBuckets.LoadOrStore(clientIP, &anonymousAIRateBucket{resetAt: now.Add(anonymousAIChatWindow)})
		bucket := bucketValue.(*anonymousAIRateBucket)

		bucket.mu.Lock()
		if now.After(bucket.resetAt) {
			bucket.count = 0
			bucket.resetAt = now.Add(anonymousAIChatWindow)
		}
		if bucket.count >= anonymousAIChatLimit {
			retryAfter := int(bucket.resetAt.Sub(now).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			bucket.mu.Unlock()

			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message": fmt.Sprintf("Zu viele AI-Anfragen für Gäste. Bitte in %d Sekunden erneut versuchen.", retryAfter),
				"error":   "rate limit exceeded",
			})
			c.Abort()
			return
		}

		bucket.count++
		remaining := anonymousAIChatLimit - bucket.count
		resetAt := int(bucket.resetAt.Sub(now).Seconds())
		bucket.mu.Unlock()

		if remaining < 0 {
			remaining = 0
		}
		if resetAt < 1 {
			resetAt = 1
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(anonymousAIChatLimit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.Itoa(resetAt))
		c.Next()
	}
}