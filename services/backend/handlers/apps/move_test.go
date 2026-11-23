package apps

import (
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

func newMoveTest(t *testing.T) (*bun.DB, sqlmock.Sqlmock) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	t.Cleanup(func() { _ = db.Close() })
	return db, mock
}

func runMove(db *bun.DB, viewer uuid.UUID, role, body string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/apps/app/move", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "app"}}
	c.Set("user_id", viewer)
	if role != "" {
		c.Set("role", role)
	}
	MoveApp(c, db)
	c.Writer.WriteHeaderNow()
	return recorder
}

var moveAppColumns = []string{"id", "owner_id", "space_id", "status", "description", "categories"}

func TestMoveAppRequiresOwnerOrAdmin(t *testing.T) {
	db, mock := newMoveTest(t)
	owner, space := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*FROM \"apps\"").WillReturnRows(sqlmock.NewRows(moveAppColumns).AddRow("app", owner, space, "Etabliert", "Ready", "{Tools}"))
	recorder := runMove(db, uuid.New(), "user", `{"spaceId":null}`)
	if recorder.Code != 403 {
		t.Fatalf("a stranger must not move the app: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMoveAppIntoSpaceRequiresOwnerMembership(t *testing.T) {
	db, mock := newMoveTest(t)
	owner, target := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*FROM \"apps\"").WillReturnRows(sqlmock.NewRows(moveAppColumns).AddRow("app", owner, nil, "Etabliert", "Ready", "{Tools}"))
	mock.ExpectQuery("SELECT EXISTS .*private_spaces").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	// An admin moves it, but the owner would lose their own app: refused.
	recorder := runMove(db, uuid.New(), "admin", `{"spaceId":"`+target.String()+`"}`)
	if recorder.Code != 403 {
		t.Fatalf("moving into a space the owner is not in must fail: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMovePublishedAppToCatalogRequiresCategory(t *testing.T) {
	db, mock := newMoveTest(t)
	owner, space := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*FROM \"apps\"").WillReturnRows(sqlmock.NewRows(moveAppColumns).AddRow("app", owner, space, "Etabliert", "Ready", "{}"))
	recorder := runMove(db, owner, "user", `{"spaceId":null}`)
	if recorder.Code != 400 {
		t.Fatalf("a published app without a category must not enter the catalog: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMoveAppRejectsCurrentLocation(t *testing.T) {
	db, mock := newMoveTest(t)
	owner, space := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*FROM \"apps\"").WillReturnRows(sqlmock.NewRows(moveAppColumns).AddRow("app", owner, space, "Etabliert", "Ready", "{Tools}"))
	recorder := runMove(db, owner, "user", `{"spaceId":"`+space.String()+`"}`)
	if recorder.Code != 400 {
		t.Fatalf("moving to where the app already is must fail: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMoveAppBetweenSpaces(t *testing.T) {
	db, mock := newMoveTest(t)
	owner, from, to := uuid.New(), uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*FROM \"apps\"").WillReturnRows(sqlmock.NewRows(moveAppColumns).AddRow("app", owner, from, "Entwurf", "", "{}"))
	mock.ExpectQuery("SELECT EXISTS .*private_spaces").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectExec("UPDATE .*space_id = '" + to.String() + "'").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(uuid.New(), time.Now()))
	recorder := runMove(db, owner, "user", `{"spaceId":"`+to.String()+`"}`)
	if recorder.Code != 204 {
		t.Fatalf("move failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestMoveDraftToCatalogKeepsItADraft(t *testing.T) {
	db, mock := newMoveTest(t)
	owner, space := uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*FROM \"apps\"").WillReturnRows(sqlmock.NewRows(moveAppColumns).AddRow("app", owner, space, "Entwurf", "", "{}"))
	// Only the space changes: no status or visibility in the update.
	mock.ExpectExec(`UPDATE "apps" AS "a" SET updated_at = .*, space_id = NULL WHERE`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("INSERT INTO .*audit").WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(uuid.New(), time.Now()))
	recorder := runMove(db, owner, "user", `{"spaceId":null}`)
	if recorder.Code != 204 {
		t.Fatalf("move failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
