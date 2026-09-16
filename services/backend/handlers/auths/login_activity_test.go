package auths

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestRecordOIDCLoginUpdatesLastLoginAt(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	db := bun.NewDB(sqlDB, pgdialect.New())

	userID := uuid.New()
	loggedInAt := time.Date(2026, time.September, 16, 14, 30, 0, 0, time.UTC)
	mock.ExpectExec(`UPDATE users SET last_login_at = '2026-09-16 14:30:00\+00:00' WHERE \(id = '.*'\)`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := recordOIDCLogin(context.Background(), db, userID, loggedInAt); err != nil {
		t.Fatalf("recordOIDCLogin returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
