package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestTokenFromRequestPrefersAuthorizationHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodGet, "http://localhost/api/v1/user/", nil)
	request.Header.Set("Authorization", "Bearer header-token")
	request.AddCookie(&http.Cookie{Name: SessionCookieName, Value: "cookie-token"})
	context.Request = request

	if got := TokenFromRequest(context); got != "Bearer header-token" {
		t.Fatalf("expected authorization header, got %q", got)
	}
}

func TestTokenFromRequestFallsBackToSessionCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodGet, "http://localhost/api/v1/user/", nil)
	request.AddCookie(&http.Cookie{Name: SessionCookieName, Value: "cookie-token"})
	context.Request = request

	if got := TokenFromRequest(context); got != "cookie-token" {
		t.Fatalf("expected session cookie, got %q", got)
	}
}

func TestSetSessionCookieUsesHttpOnlySecureAttributes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodPost, "https://localhost/api/v1/auth/login", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	context.Request = request

	expiresAt := time.Now().Add(time.Hour).Unix()
	SetSessionCookie(context, "jwt-token", expiresAt)
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one session cookie, got %d", len(cookies))
	}

	cookie := cookies[0]
	if cookie.Name != SessionCookieName || cookie.Value != "jwt-token" {
		t.Fatalf("unexpected session cookie: %#v", cookie)
	}
	if !cookie.HttpOnly || !cookie.Secure || cookie.Path != sessionCookiePath || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie is missing secure attributes: %#v", cookie)
	}
}
