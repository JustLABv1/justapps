package admins

import (
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestUserSpacePermissionUpdatesDoNotResetOmittedFlags(t *testing.T) {
	for _, test := range []struct {
		name, body     string
		existing, want bool
	}{{"unrelated update", `{"username":"Anna","email":"anna@example.com","role":"user"}`, true, true}, {"explicit revocation", `{"username":"Anna","email":"anna@example.com","role":"user","canCreateSpaces":false}`, true, false}, {"explicit grant", `{"username":"Anna","email":"anna@example.com","role":"user","canCreateSpaces":true}`, false, true}} {
		t.Run(test.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			id := uuid.New()
			mock.ExpectQuery("SELECT .*users").WillReturnRows(sqlmock.NewRows([]string{"id", "username", "email", "role", "password", "can_create_spaces"}).AddRow(id, "Anna", "anna@example.com", "user", "hash", test.existing))
			mock.ExpectQuery("SELECT EXISTS .*roles").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
			flag := "FALSE"
			if test.want {
				flag = "TRUE"
			}
			mock.ExpectExec("UPDATE .*users.*can_create_spaces.* = " + flag).WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(uuid.New(), time.Now()))
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("PUT", "/admin/users", strings.NewReader(test.body))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "userID", Value: id.String()}}
			c.Set("user_id", "admin")
			UpdateUser(c, db)
			if recorder.Code != 201 {
				t.Fatalf("update failed: %d %s", recorder.Code, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
