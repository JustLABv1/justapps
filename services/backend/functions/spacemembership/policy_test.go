package spacemembership

import (
	"context"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"justapps-backend/pkg/models"
	"testing"
)

func TestGlobalSpaceCreationModes(t *testing.T) {
	for _, mode := range []string{"everyone", "oidc_group", "admins", "allowed_users"} {
		for _, allowed := range []bool{false, true} {
			for _, group := range []bool{false, true} {
				user := models.Users{Role: "user", CanCreateSpaces: allowed}
				want := mode == "everyone" || mode == "allowed_users" && allowed || mode == "oidc_group" && group
				if got := CreationDecision(mode, user, group); got != want {
					t.Fatalf("mode=%s individual=%v group=%v: got %v want %v", mode, allowed, group, got, want)
				}
				user.Role = "admin"
				if !CreationDecision(mode, user, group) {
					t.Fatalf("admin denied in %s", mode)
				}
				user.Disabled = true
				if CreationDecision(mode, user, group) {
					t.Fatal("disabled accounts must not create spaces")
				}
			}
		}
	}
	if CreationDecision("unknown", models.Users{Role: "user", CanCreateSpaces: true}, true) {
		t.Fatal("unknown rule must deny")
	}
}

func TestOIDCCreationPolicyRequiresVerifiedProviderGroup(t *testing.T) {
	for _, member := range []bool{true, false} {
		sqlDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		db := bun.NewDB(sqlDB, pgdialect.New())
		user := models.Users{ID: uuid.New(), Role: "user", CanCreateSpaces: true}
		mock.ExpectQuery("SELECT .*space_creation_policy").WillReturnRows(sqlmock.NewRows([]string{"id", "mode", "provider_key", "issuer", "group_name"}).AddRow("default", "oidc_group", "keycloak", "https://id.example/realms/team", "/space-creators"))
		mock.ExpectQuery("SELECT EXISTS .*user_oidc_groups.*p.enabled.*ug.provider_key = 'keycloak'.*ug.issuer = 'https://id.example/realms/team'.*ug.group_name = '/space-creators'").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(member))
		got, err := CanCreate(context.Background(), db, user)
		if err != nil {
			t.Fatal(err)
		}
		if got != member {
			t.Fatalf("individual flag bypassed group policy: got %v want %v", got, member)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatal(err)
		}
		db.Close()
	}
}
