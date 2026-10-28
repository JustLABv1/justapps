package spacemembership

import (
	"context"
	"errors"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"reflect"
	"regexp"
	"testing"
)

func TestNormalizeGroupsKeepsExactGroupPaths(t *testing.T) {
	got := NormalizeGroups([]string{" /teams/A ", "/teams/A", "", "/teams/a", "/teams/A/sub"})
	want := []string{"/teams/A", "/teams/a", "/teams/A/sub"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("groups = %#v, want %#v", got, want)
	}
}

func TestSyncOIDCGroupsScopesGrantsAndRetainsManualAccess(t *testing.T) {
	for _, hasGroup := range []bool{true, false} {
		t.Run(map[bool]string{true: "matched group", false: "membership revoked"}[hasGroup], func(t *testing.T) {
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			db := bun.NewDB(sqlDB, pgdialect.New())
			defer db.Close()
			userID, spaceID, mappingID := uuid.New(), uuid.New(), uuid.New()
			mock.ExpectBegin()
			mock.ExpectQuery("SELECT .*users.*FOR UPDATE").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(userID))
			mock.ExpectExec("DELETE FROM private_space_oidc_grants g USING private_space_group_mappings m.*g.user_id = '" + userID.String() + "'.*m.provider_key = 'keycloak'").WillReturnResult(sqlmock.NewResult(0, 1))
			groups := []string{}
			if hasGroup {
				groups = []string{"/teams/A"}
				mock.ExpectQuery("SELECT .*private_space_group_mappings.*provider_key = 'keycloak' AND issuer = 'https://identity.example/realms/main' AND group_name IN \\(.*'/teams/A'.*\\).*FOR SHARE").WillReturnRows(sqlmock.NewRows([]string{"id", "space_id", "provider_key", "issuer", "group_name"}).AddRow(mappingID, spaceID, "keycloak", "https://identity.example/realms/main", "/teams/A"))
				mock.ExpectExec(regexp.QuoteMeta("INSERT INTO private_space_members (space_id,user_id,accepted,manual_invited,manual_accepted)")).WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec("INSERT INTO private_space_oidc_grants .*ON CONFLICT DO NOTHING").WillReturnResult(sqlmock.NewResult(0, 1))
			}
			mock.ExpectExec("UPDATE private_space_members m SET accepted = m.manual_accepted OR EXISTS .*WHERE m.user_id = '" + userID.String() + "'").WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectExec("DELETE FROM private_space_members m WHERE NOT m.manual_invited AND NOT EXISTS .*AND m.user_id = '" + userID.String() + "'").WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectCommit()
			if err := SyncOIDCGroups(context.Background(), db, userID, "keycloak", "https://identity.example/realms/main", groups); err != nil {
				t.Fatal(err)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestSyncOIDCGroupsRollsBackOnFailure(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := bun.NewDB(sqlDB, pgdialect.New())
	defer db.Close()
	userID := uuid.New()
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .*users.*FOR UPDATE").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(userID))
	mock.ExpectExec("DELETE FROM private_space_oidc_grants").WillReturnError(errors.New("database unavailable"))
	mock.ExpectRollback()
	if err := SyncOIDCGroups(context.Background(), db, userID, "keycloak", "issuer", nil); err == nil {
		t.Fatal("sync must fail instead of issuing a session with stale permissions")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
