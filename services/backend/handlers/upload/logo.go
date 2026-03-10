package upload

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"app-store-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxUploadSize = 2 * 1024 * 1024 // 2 MB

var allowedMIME = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/svg+xml": ".svg",
	"image/webp": ".webp",
	"image/x-icon":  ".ico",
	"image/vnd.microsoft.icon": ".ico",
}

// UploadLogo handles logo file uploads (admin only).
// Saves the file to <dataPath>/uploads/ and returns its public path.
func UploadLogo(c *gin.Context, dataPath string) {
	role := c.GetString("role")
	if role != "admin" {
		httperror.Forbidden(c, "Only admins can upload files", errors.New("admin role required"))
		return
	}

	if err := c.Request.ParseMultipartForm(maxUploadSize + 1*1024*1024); err != nil {
		httperror.StatusBadRequest(c, "Request too large or not multipart", err)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httperror.StatusBadRequest(c, "No file provided (field name: file)", err)
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		httperror.StatusBadRequest(c, fmt.Sprintf("File too large (max %d MB)", maxUploadSize/1024/1024), errors.New("file too large"))
		return
	}

	// Read first 512 bytes to detect MIME type
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		httperror.InternalServerError(c, "Failed to read file", err)
		return
	}
	detectedMIME := http.DetectContentType(buf[:n])

	ext, ok := allowedMIME[detectedMIME]
	if !ok {
		// SVG is text/xml or text/plain when detected — also try extension-based fallback
		origExt := strings.ToLower(filepath.Ext(header.Filename))
		if origExt == ".svg" {
			ext = ".svg"
		} else {
			httperror.StatusBadRequest(c, fmt.Sprintf("Unsupported file type: %s. Allowed: PNG, JPEG, SVG, WebP, ICO", detectedMIME), errors.New("unsupported type"))
			return
		}
	}

	// Seek back to start
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		httperror.InternalServerError(c, "Failed to process file", err)
		return
	}

	// Ensure upload directory exists
	uploadDir := filepath.Join(dataPath, "uploads")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		httperror.InternalServerError(c, "Failed to create upload directory", err)
		return
	}

	filename := uuid.New().String() + ext
	destPath := filepath.Join(uploadDir, filename)

	out, err := os.Create(destPath)
	if err != nil {
		httperror.InternalServerError(c, "Failed to save file", err)
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		httperror.InternalServerError(c, "Failed to write file", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": "/uploads/" + filename,
	})
}

// ServeUpload serves a previously uploaded file from <dataPath>/uploads/.
func ServeUpload(c *gin.Context, dataPath string) {
	filename := filepath.Base(c.Param("filename"))
	if filename == "." || filename == "/" {
		c.Status(http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(dataPath, "uploads", filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.Status(http.StatusNotFound)
		return
	}

	c.File(filePath)
}
