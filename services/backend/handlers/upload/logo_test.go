package upload

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestServeUploadSupportsNestedRestoredPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)

	dataPath := t.TempDir()
	targetDir := filepath.Join(dataPath, "uploads", "groups")
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(targetDir, "icon.png"), []byte("nested-icon"), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	router := gin.New()
	router.GET("/uploads/*filepath", func(c *gin.Context) {
		ServeUpload(c, dataPath)
	})

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/uploads/groups/icon.png", nil)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if body := response.Body.String(); body != "nested-icon" {
		t.Fatalf("body = %q", body)
	}
}
