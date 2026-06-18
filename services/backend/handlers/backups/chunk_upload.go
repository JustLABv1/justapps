package backups

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

const (
	backupUploadChunkSize = 2 * 1024 * 1024
	backupUploadMaxAge    = 24 * time.Hour
)

type backupUploadSession struct {
	mu           sync.Mutex
	path         string
	expectedSize int64
	received     int64
	createdAt    time.Time
}

type createBackupUploadRequest struct {
	FileName string `json:"fileName"`
	Size     int64  `json:"size"`
}

type completeBackupUploadRequest struct {
	Passphrase  string `json:"passphrase"`
	Sections    string `json:"sections"`
	RestoreMode string `json:"restoreMode"`
}

type backupImportJob struct {
	mu        sync.RWMutex
	status    string
	result    importExecutionResult
	createdAt time.Time
}

var backupUploadSessions sync.Map
var backupImportJobs sync.Map
var backupImportExecutionMu sync.Mutex

func CreateBackupUpload(c *gin.Context, dataPath string) {
	var request createBackupUploadRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Size <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A positive backup file size is required"})
		return
	}

	cleanupExpiredBackupUploads()

	uploadID := uuid.NewString()
	uploadDir := filepath.Join(dataPath, "backup-imports")
	if err := os.MkdirAll(uploadDir, 0700); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize backup upload", "detail": err.Error()})
		return
	}

	uploadPath := filepath.Join(uploadDir, uploadID+".part")
	file, err := os.OpenFile(uploadPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize backup upload", "detail": err.Error()})
		return
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(uploadPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize backup upload", "detail": err.Error()})
		return
	}

	backupUploadSessions.Store(uploadID, &backupUploadSession{
		path:         uploadPath,
		expectedSize: request.Size,
		createdAt:    time.Now(),
	})

	c.JSON(http.StatusCreated, gin.H{
		"uploadId":  uploadID,
		"chunkSize": backupUploadChunkSize,
	})
}

func AppendBackupUploadChunk(c *gin.Context) {
	uploadID := c.Param("uploadId")
	session, ok := loadBackupUploadSession(uploadID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup upload session not found or expired"})
		return
	}

	offset, err := strconv.ParseInt(c.Query("offset"), 10, 64)
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A valid chunk offset is required"})
		return
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if offset != session.received {
		c.JSON(http.StatusConflict, gin.H{
			"error":    "Backup chunk offset does not match the received file size",
			"received": session.received,
		})
		return
	}

	body := http.MaxBytesReader(c.Writer, c.Request.Body, backupUploadChunkSize+1)
	chunk, err := io.ReadAll(body)
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Backup chunk exceeds the allowed chunk size"})
		return
	}
	if len(chunk) == 0 || len(chunk) > backupUploadChunkSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup chunk is empty or too large"})
		return
	}
	if session.received+int64(len(chunk)) > session.expectedSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup upload exceeds the declared file size"})
		return
	}

	file, err := os.OpenFile(session.path, os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store backup chunk", "detail": err.Error()})
		return
	}
	written, writeErr := file.Write(chunk)
	closeErr := file.Close()
	if writeErr == nil && written != len(chunk) {
		writeErr = io.ErrShortWrite
	}
	if writeErr != nil || closeErr != nil {
		if writeErr == nil {
			writeErr = closeErr
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store backup chunk", "detail": writeErr.Error()})
		return
	}

	session.received += int64(len(chunk))
	c.JSON(http.StatusOK, gin.H{"received": session.received})
}

func CompleteBackupUpload(c *gin.Context, db *bun.DB, dataPath string) {
	uploadID := c.Param("uploadId")
	session, ok := loadBackupUploadSession(uploadID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup upload session not found or expired"})
		return
	}

	var request completeBackupUploadRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup import options", "detail": err.Error()})
		return
	}

	session.mu.Lock()
	if session.received != session.expectedSize {
		received := session.received
		expected := session.expectedSize
		session.mu.Unlock()
		c.JSON(http.StatusConflict, gin.H{
			"error":    "Backup upload is incomplete",
			"received": received,
			"expected": expected,
		})
		return
	}
	uploadPath := session.path
	backupUploadSessions.Delete(uploadID)
	session.mu.Unlock()

	cleanupExpiredBackupImportJobs()

	jobID := uuid.NewString()
	job := &backupImportJob{
		status:    "processing",
		createdAt: time.Now(),
	}
	backupImportJobs.Store(jobID, job)

	go func() {
		defer os.Remove(uploadPath)
		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Hour)
		defer cancel()
		defer func() {
			if recovered := recover(); recovered != nil {
				job.mu.Lock()
				job.result = importExecutionResult{
					Status: http.StatusInternalServerError,
					Body:   gin.H{"error": "Backup import failed unexpectedly", "detail": fmt.Sprint(recovered)},
				}
				job.status = "failed"
				job.mu.Unlock()
			}
		}()

		payload, err := os.ReadFile(uploadPath)
		if err != nil {
			job.mu.Lock()
			job.result = importExecutionResult{
				Status: http.StatusInternalServerError,
				Body:   gin.H{"error": "Failed to read uploaded backup", "detail": err.Error()},
			}
			job.status = "failed"
			job.mu.Unlock()
			return
		}

		result := func() importExecutionResult {
			backupImportExecutionMu.Lock()
			defer backupImportExecutionMu.Unlock()
			return executeBackupImport(ctx, db, dataPath, payload, request.Passphrase, request.Sections, request.RestoreMode)
		}()
		job.mu.Lock()
		job.result = result
		if result.Status >= http.StatusBadRequest {
			job.status = "failed"
		} else {
			job.status = "completed"
		}
		job.mu.Unlock()
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"jobId":  jobID,
		"status": "processing",
	})
}

func GetBackupImportJob(c *gin.Context) {
	jobID := c.Param("jobId")
	if _, err := uuid.Parse(jobID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup import job not found or expired"})
		return
	}

	value, ok := backupImportJobs.Load(jobID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup import job not found or expired"})
		return
	}
	job, ok := value.(*backupImportJob)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid backup import job state"})
		return
	}

	job.mu.RLock()
	defer job.mu.RUnlock()

	switch job.status {
	case "completed":
		c.JSON(http.StatusOK, gin.H{"status": job.status, "result": job.result.Body})
	case "failed":
		c.JSON(http.StatusOK, gin.H{"status": job.status, "error": job.result.Body})
	default:
		c.JSON(http.StatusOK, gin.H{"status": "processing"})
	}
}

func DeleteBackupUpload(c *gin.Context) {
	uploadID := c.Param("uploadId")
	session, ok := loadBackupUploadSession(uploadID)
	if ok {
		session.mu.Lock()
		deleteBackupUploadSession(uploadID, session)
		session.mu.Unlock()
	}
	c.Status(http.StatusNoContent)
}

func loadBackupUploadSession(uploadID string) (*backupUploadSession, bool) {
	if _, err := uuid.Parse(uploadID); err != nil {
		return nil, false
	}
	value, ok := backupUploadSessions.Load(uploadID)
	if !ok {
		return nil, false
	}
	session, ok := value.(*backupUploadSession)
	return session, ok
}

func deleteBackupUploadSession(uploadID string, session *backupUploadSession) {
	backupUploadSessions.Delete(uploadID)
	_ = os.Remove(session.path)
}

func cleanupExpiredBackupUploads() {
	cutoff := time.Now().Add(-backupUploadMaxAge)
	backupUploadSessions.Range(func(key, value any) bool {
		session, ok := value.(*backupUploadSession)
		if !ok || session.createdAt.After(cutoff) {
			return true
		}
		uploadID, ok := key.(string)
		if ok {
			deleteBackupUploadSession(uploadID, session)
		}
		return true
	})
}

func cleanupExpiredBackupImportJobs() {
	cutoff := time.Now().Add(-backupUploadMaxAge)
	backupImportJobs.Range(func(key, value any) bool {
		job, ok := value.(*backupImportJob)
		if ok && job.createdAt.Before(cutoff) {
			backupImportJobs.Delete(key)
		}
		return true
	})
}
