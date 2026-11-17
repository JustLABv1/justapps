package users

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestAvatarURLPattern(t *testing.T) {
	allowed := []string{
		"/uploads/0327d9af-bba4-4c4e-9de8-e1aa7e9cd6ee.webp",
		"/uploads/abc.png",
		"/uploads/abc.jpg",
		"/uploads/abc.jpeg",
	}
	for _, value := range allowed {
		if !avatarURLPattern.MatchString(value) {
			t.Errorf("expected %q to be allowed", value)
		}
	}
	rejected := []string{
		"/uploads/abc.svg",
		"/uploads/../config.yaml",
		"/uploads/sub/abc.png",
		"https://example.com/a.png",
		"javascript:alert(1)",
		"/uploads/abc.png?x=1",
	}
	for _, value := range rejected {
		if avatarURLPattern.MatchString(value) {
			t.Errorf("expected %q to be rejected", value)
		}
	}
}

func TestUpdateOwnProfileRejectsBadInputBeforeTouchingTheDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := map[string]string{
		"svg avatar":        `{"displayName":"Ada","avatarUrl":"/uploads/a.svg"}`,
		"foreign avatar":    `{"displayName":"Ada","avatarUrl":"https://evil.example/a.png"}`,
		"long display name": `{"displayName":"` + strings.Repeat("x", 81) + `","avatarUrl":""}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			context.Request = httptest.NewRequest(http.MethodPut, "/user/profile", strings.NewReader(body))
			context.Request.Header.Set("Content-Type", "application/json")
			context.Set("user_id", uuid.New())

			// A nil database: reaching it would panic, so a 400 proves validation ran first.
			UpdateOwnProfile(context, nil)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", recorder.Code)
			}
		})
	}
}
