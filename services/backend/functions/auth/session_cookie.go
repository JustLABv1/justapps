package auth

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// SessionCookieName is intentionally scoped to the backend API. The cookie is
// HttpOnly so browser JavaScript cannot read or exfiltrate the backend JWT.
const SessionCookieName = "justapps_session"

const sessionCookiePath = "/api/v1"

// TokenFromRequest prefers an explicit Authorization header so service/API
// clients keep working, then falls back to the browser session cookie.
func TokenFromRequest(c *gin.Context) string {
	if header := strings.TrimSpace(c.GetHeader("Authorization")); header != "" {
		return header
	}

	cookie, err := c.Cookie(SessionCookieName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(cookie)
}

// SetSessionCookie writes the backend JWT as a secure, HttpOnly cookie. Secure
// is derived from the request/proxy protocol so local HTTP development keeps
// working while HTTPS deployments receive a Secure cookie.
func SetSessionCookie(c *gin.Context, token string, expiresAt int64) {
	if strings.TrimSpace(token) == "" {
		return
	}

	expires := time.Unix(expiresAt, 0)
	maxAge := int(time.Until(expires).Seconds())
	if maxAge < 1 {
		maxAge = 1
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     sessionCookiePath,
		Expires:  expires,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   requestIsSecure(c),
		SameSite: http.SameSiteLaxMode,
	})
}

func ClearSessionCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     sessionCookiePath,
		MaxAge:   -1,
		Expires:  time.Unix(1, 0),
		HttpOnly: true,
		Secure:   requestIsSecure(c),
		SameSite: http.SameSiteLaxMode,
	})
}

func requestIsSecure(c *gin.Context) bool {
	if strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")), "https") {
		return true
	}
	return c.Request != nil && c.Request.TLS != nil
}
