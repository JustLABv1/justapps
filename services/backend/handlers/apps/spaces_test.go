package apps

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestSpaceListIncludesPendingInvitationWithoutGrantingAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	owner, id, viewer := uuid.New(), uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT ps.*private_spaces AS ps.*LEFT JOIN private_space_members").WillReturnRows(sqlmock.NewRows([]string{"id", "name", "owner_id", "accepted"}).AddRow(id, "Team", owner, false))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("GET", "/spaces", nil)
	c.Set("user_id", viewer)
	ListSpaces(c, db)
	var result []struct {
		ID       uuid.UUID
		Name     string
		Accepted bool
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != 200 || len(result) != 1 || result[0].ID != id || result[0].Accepted {
		t.Fatalf("unexpected spaces: %s", recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestPublishPrivateAppRequiresOwner(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	mock.ExpectQuery("SELECT .*a.owner_id.*a.space_id IS NOT NULL").WillReturnRows(sqlmock.NewRows([]string{"id"}))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/apps/private/publish", nil)
	c.Params = gin.Params{{Key: "id", Value: "private"}}
	c.Set("user_id", uuid.New())
	c.Set("role", "admin")
	PublishSpaceApp(c, db)
	c.Writer.WriteHeaderNow()
	if recorder.Code != 404 {
		t.Fatalf("non-owner must not publish: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestCreatePrivateAppRejectsUnacceptedMember(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	userID, spaceID := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*users").WillReturnRows(sqlmock.NewRows([]string{"id", "role", "can_submit_apps"}).AddRow(userID, "user", true))
	mock.ExpectQuery("SELECT EXISTS .*private_spaces.*sm.accepted").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/apps", strings.NewReader(`{"name":"Private","spaceId":"`+spaceID.String()+`"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("user_id", userID)
	CreateApp(c, db)
	if recorder.Code != 403 {
		t.Fatalf("pending member must not create: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestPublishPrivateAppMakesDraftPublic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	ownerID, spaceID := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*a.owner_id.*a.space_id IS NOT NULL").WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "space_id", "status", "description", "categories"}).AddRow("private", ownerID, spaceID, "Entwurf", "Ready", "{Tools}"))
	mock.ExpectExec("UPDATE .*space_id = NULL.*is_hidden = false.*status = 'In Erprobung'").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(uuid.New(), time.Now()))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/apps/private/publish", nil)
	c.Params = gin.Params{{Key: "id", Value: "private"}}
	c.Set("user_id", ownerID)
	PublishSpaceApp(c, db)
	c.Writer.WriteHeaderNow()
	if recorder.Code != 204 {
		t.Fatalf("publication failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRenameSpace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	ownerID, spaceID := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*private_spaces.*ps.owner_id").WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "name"}).AddRow(spaceID, ownerID, "Old"))
	mock.ExpectExec("UPDATE .*private_spaces.*name.*New").WillReturnResult(sqlmock.NewResult(0, 1))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("PATCH", "/spaces", strings.NewReader(`{"name":" New "}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "spaceId", Value: spaceID.String()}}
	c.Set("user_id", ownerID)
	UpdateSpace(c, db)
	if recorder.Code != 200 || !strings.Contains(recorder.Body.String(), `"name":"New"`) {
		t.Fatalf("rename failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteSpaceDeletesAppsAndMembershipsAtomically(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	ownerID, spaceID := uuid.New(), uuid.New()
	rows := func() *sqlmock.Rows {
		return sqlmock.NewRows([]string{"id", "owner_id", "name"}).AddRow(spaceID, ownerID, "Team")
	}
	mock.ExpectQuery("SELECT .*private_spaces.*ps.owner_id").WillReturnRows(rows())
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .*private_spaces.*FOR UPDATE").WillReturnRows(rows())
	mock.ExpectQuery("SELECT EXISTS .*apps.*is_locked = true").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectExec("DELETE FROM .*apps.*space_id").WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("DELETE FROM .*private_spaces").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(uuid.New(), time.Now()))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("DELETE", "/spaces", nil)
	c.Params = gin.Params{{Key: "spaceId", Value: spaceID.String()}}
	c.Set("user_id", ownerID)
	DeleteSpace(c, db)
	c.Writer.WriteHeaderNow()
	if recorder.Code != 204 {
		t.Fatalf("delete failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestSpaceManagementRejectsNonOwner(t *testing.T) {
	for _, method := range []string{"PATCH", "DELETE"} {
		t.Run(method, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			mock.ExpectQuery("SELECT .*private_spaces.*ps.owner_id").WillReturnRows(sqlmock.NewRows([]string{"id"}))
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(method, "/spaces", strings.NewReader(`{"name":"Other"}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Params = gin.Params{{Key: "spaceId", Value: uuid.New().String()}}
			c.Set("user_id", uuid.New())
			c.Set("role", "admin")
			if method == "PATCH" {
				UpdateSpace(c, db)
			} else {
				DeleteSpace(c, db)
			}
			if recorder.Code != 404 {
				t.Fatalf("non-owner must be rejected: %d", recorder.Code)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
