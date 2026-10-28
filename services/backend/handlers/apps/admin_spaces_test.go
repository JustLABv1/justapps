package apps

import (
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateSpaceEnforcesGlobalRule(t *testing.T) {
	for _, test := range []struct {
		mode       string
		individual bool
		want       int
	}{{"admins", true, 403}, {"allowed_users", false, 403}, {"everyone", false, 201}, {"allowed_users", true, 201}} {
		t.Run(test.mode, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			id := uuid.New()
			mock.ExpectQuery("SELECT .*users").WillReturnRows(sqlmock.NewRows([]string{"id", "role", "can_create_spaces"}).AddRow(id, "user", test.individual))
			mock.ExpectQuery("SELECT .*space_creation_policy").WillReturnRows(sqlmock.NewRows([]string{"id", "mode"}).AddRow("default", test.mode))
			if test.want == 201 {
				mock.ExpectQuery("INSERT INTO .*private_spaces").WillReturnRows(sqlmock.NewRows([]string{"created_at"}))
			}
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("POST", "/spaces", strings.NewReader(`{"name":"Team"}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("user_id", id)
			c.Set("role", "user")
			CreateSpace(c, db)
			if recorder.Code != test.want {
				t.Fatalf("status %d want %d: %s", recorder.Code, test.want, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestAdminCanManageAnotherOwnersSpace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	spaceID, ownerID := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*private_spaces").WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "name"}).AddRow(spaceID, ownerID, "Old"))
	mock.ExpectExec("UPDATE .*private_spaces.*name.*New").WillReturnResult(sqlmock.NewResult(0, 1))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("PATCH", "/spaces", strings.NewReader(`{"name":"New"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("user_id", uuid.New())
	c.Set("role", "admin")
	c.Params = gin.Params{{Key: "spaceId", Value: spaceID.String()}}
	UpdateSpace(c, db)
	if recorder.Code != 200 {
		t.Fatalf("admin management rejected: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestNonAdminsCannotChangeGlobalRulesOrOwnership(t *testing.T) {
	for _, action := range []string{"list", "policy", "owner"} {
		t.Run(action, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("PUT", "/admin", strings.NewReader(`{"mode":"everyone"}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("user_id", uuid.New())
			c.Set("role", "user")
			switch action {
			case "list":
				ListAdminSpaces(c, db)
			case "policy":
				SetSpaceCreationPolicy(c, db)
			case "owner":
				TransferSpaceOwner(c, db)
			}
			if recorder.Code != 403 {
				t.Fatalf("expected admin guard: %d %s", recorder.Code, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestAdminSpaceOverviewIsPaginatedAndIncludesOwner(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	spaceID, ownerID := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT count.*private_spaces ps.*JOIN users").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(60))
	mock.ExpectQuery("SELECT ps.*private_spaces ps.*LIMIT 50 OFFSET 50").WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "name", "owner_username", "owner_email", "app_count", "member_count", "invitation_count", "group_count", "accepted", "can_view_apps"}).AddRow(spaceID, ownerID, "Team", "Anna", "anna@example.com", 3, 4, 1, 2, true, false))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("GET", "/admin/spaces?page=2", nil)
	c.Set("user_id", uuid.New())
	c.Set("role", "admin")
	ListAdminSpaces(c, db)
	if recorder.Code != 200 || !strings.Contains(recorder.Body.String(), `"ownerUsername":"Anna"`) || !strings.Contains(recorder.Body.String(), `"total":60`) {
		t.Fatalf("wrong admin overview: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestAdminCanTransferSpaceToActiveUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	spaceID, ownerID, targetID := uuid.New(), uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*private_spaces").WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id"}).AddRow(spaceID, ownerID))
	mock.ExpectQuery("SELECT EXISTS .*users.*disabled = false").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectExec("UPDATE .*private_spaces.*owner_id = '" + targetID.String() + "'").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(uuid.New()))
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("PATCH", "/admin/spaces/owner", strings.NewReader(`{"userId":"`+targetID.String()+`"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "spaceId", Value: spaceID.String()}}
	c.Set("user_id", uuid.New())
	c.Set("role", "admin")
	TransferSpaceOwner(c, db)
	c.Writer.WriteHeaderNow()
	if recorder.Code != 204 {
		t.Fatalf("transfer failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
