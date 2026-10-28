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

func TestSpaceGroupMappingsRequireSpaceOwner(t *testing.T) {
	for _, action := range []string{"list", "add", "delete"} {
		t.Run(action, func(t *testing.T) {
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
			c.Request = httptest.NewRequest("POST", "/spaces/group-mappings", strings.NewReader(`{"providerKey":"keycloak","groupName":"/team"}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("user_id", uuid.New())
			c.Set("role", "admin")
			c.Params = gin.Params{{Key: "spaceId", Value: uuid.New().String()}}
			switch action {
			case "list":
				ListSpaceGroupMappings(c, db)
			case "add":
				AddSpaceGroupMapping(c, db)
			case "delete":
				DeleteSpaceGroupMapping(c, db)
			}
			if recorder.Code != 404 {
				t.Fatalf("platform role must not bypass space ownership: %d %s", recorder.Code, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestDeletingGroupMappingReconcilesRemainingAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	ownerID, spaceID, mappingID := uuid.New(), uuid.New(), uuid.New()
	mock.ExpectQuery("SELECT .*private_spaces.*ps.owner_id").WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id"}).AddRow(spaceID, ownerID))
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM .*private_space_group_mappings.*space_id.*id::text").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE private_space_members m SET accepted = m.manual_accepted OR EXISTS .*WHERE m.space_id").WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("DELETE FROM private_space_members m WHERE NOT m.manual_invited AND NOT EXISTS .*m.space_id").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("DELETE", "/spaces/group-mappings", nil)
	c.Set("user_id", ownerID)
	c.Params = gin.Params{{Key: "spaceId", Value: spaceID.String()}, {Key: "mappingId", Value: mappingID.String()}}
	DeleteSpaceGroupMapping(c, db)
	c.Writer.WriteHeaderNow()
	if recorder.Code != 204 {
		t.Fatalf("delete failed: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
