package backups

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestChunkedBackupUpload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dataPath := t.TempDir()
	router := gin.New()
	router.POST("/uploads", func(c *gin.Context) {
		CreateBackupUpload(c, dataPath)
	})
	router.PUT("/uploads/:uploadId", AppendBackupUploadChunk)
	router.DELETE("/uploads/:uploadId", DeleteBackupUpload)

	payload := bytes.Repeat([]byte("backup"), 500_000)
	createBody, err := json.Marshal(createBackupUploadRequest{FileName: "large.jabackup", Size: int64(len(payload))})
	if err != nil {
		t.Fatal(err)
	}
	createRequest := httptest.NewRequest(http.MethodPost, "/uploads", bytes.NewReader(createBody))
	createRequest.Header.Set("Content-Type", "application/json")
	createResponse := httptest.NewRecorder()
	router.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", createResponse.Code, createResponse.Body.String())
	}

	var upload BackupUploadResponse
	if err := json.Unmarshal(createResponse.Body.Bytes(), &upload); err != nil {
		t.Fatal(err)
	}

	for offset := 0; offset < len(payload); offset += backupUploadChunkSize {
		end := min(offset+backupUploadChunkSize, len(payload))
		request := httptest.NewRequest(
			http.MethodPut,
			"/uploads/"+upload.UploadID+"?offset="+strconv.Itoa(offset),
			bytes.NewReader(payload[offset:end]),
		)
		request.Header.Set("Content-Type", "application/octet-stream")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("chunk status = %d, body = %s", response.Code, response.Body.String())
		}
	}

	session, ok := loadBackupUploadSession(upload.UploadID)
	if !ok {
		t.Fatal("upload session was not stored")
	}
	stored, err := os.ReadFile(session.path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(stored, payload) {
		t.Fatal("assembled upload does not match source payload")
	}

	deleteRequest := httptest.NewRequest(http.MethodDelete, "/uploads/"+upload.UploadID, nil)
	deleteResponse := httptest.NewRecorder()
	router.ServeHTTP(deleteResponse, deleteRequest)
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d", deleteResponse.Code)
	}
	if _, err := os.Stat(session.path); !os.IsNotExist(err) {
		t.Fatalf("temporary upload still exists: %v", err)
	}
}

type BackupUploadResponse struct {
	UploadID  string `json:"uploadId"`
	ChunkSize int    `json:"chunkSize"`
}

func TestGetBackupImportJob(t *testing.T) {
	gin.SetMode(gin.TestMode)
	jobID := "e4ae52e8-61a6-4bdd-8dc0-dfb52b152e84"
	backupImportJobs.Store(jobID, &backupImportJob{
		status: "completed",
		result: importExecutionResult{
			Status: http.StatusOK,
			Body: importResponse{
				Message:     "Backup import completed",
				RestoreMode: restoreModeMerge,
			},
		},
		createdAt: time.Now(),
	})
	t.Cleanup(func() {
		backupImportJobs.Delete(jobID)
	})

	router := gin.New()
	router.GET("/jobs/:jobId", GetBackupImportJob)
	request := httptest.NewRequest(http.MethodGet, "/jobs/"+jobID, nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("job status = %d, body = %s", response.Code, response.Body.String())
	}
	var payload struct {
		Status string          `json:"status"`
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Status != "completed" || len(payload.Result) == 0 {
		t.Fatalf("unexpected job response: %s", response.Body.String())
	}
}
