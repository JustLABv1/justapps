package tokens

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestGenerateTokenUserReturnsUnauthorizedForUnknownUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()

	mock.ExpectQuery(`SELECT .* FROM "users"`).WillReturnError(sql.ErrNoRows)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"missing@example.test","password":"wrong"}`))
	context.Request.Header.Set("Content-Type", "application/json")

	GenerateTokenUser(db, context)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "E-Mail/Benutzername oder Passwort ist falsch") {
		t.Fatalf("unexpected response body: %s", recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
