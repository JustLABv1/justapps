package upload

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestUploadLogoAllowsAuthenticatedNonAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)

	dataPath := t.TempDir()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "logo.png")
	if err != nil {
		t.Fatalf("CreateFormFile() error = %v", err)
	}
	// Minimal valid PNG signature. The handler only needs enough data to identify the MIME type.
	if _, err := part.Write([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	router := gin.New()
	router.POST("/upload/logo", func(c *gin.Context) {
		c.Set("role", "user")
		UploadLogo(c, dataPath)
	})

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/upload/logo", body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body = %s", response.Code, http.StatusOK, response.Body.String())
	}

	matches, err := filepath.Glob(filepath.Join(dataPath, "uploads", "*.png"))
	if err != nil {
		t.Fatalf("Glob() error = %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("uploaded PNG files = %d, want 1", len(matches))
	}
}

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
