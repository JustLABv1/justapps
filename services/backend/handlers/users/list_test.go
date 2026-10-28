package users

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func TestUserSearchRequiresTwoCharacters(t *testing.T) {
	for _, query := range []string{"", "a"} {
		t.Run(query, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("GET", "/users?q="+query, nil)
			ListSelectableUsers(c, db)
			if recorder.Code != 200 || recorder.Body.String() != `{"hasMore":false,"users":[]}` {
				t.Fatalf("unexpected response: %d %s", recorder.Code, recorder.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestUserSearchLimitsResults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	rows := sqlmock.NewRows([]string{"id", "username", "email"})
	for i := 0; i < 21; i++ {
		rows.AddRow(uuid.New(), fmt.Sprintf("anna%d", i), fmt.Sprintf("anna%d@example.com", i))
	}
	mock.ExpectQuery("SELECT .*disabled = FALSE.*username ILIKE '%anna%' OR email ILIKE '%anna%'.*LIMIT 21").WillReturnRows(rows)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("GET", "/users?q=anna", nil)
	ListSelectableUsers(c, db)
	var response struct {
		Users   []json.RawMessage `json:"users"`
		HasMore bool              `json:"hasMore"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != 200 || len(response.Users) != 20 || !response.HasMore {
		t.Fatalf("unexpected response: %d %s", recorder.Code, recorder.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
