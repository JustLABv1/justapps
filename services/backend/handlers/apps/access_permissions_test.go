package apps

import (
	"testing"

	"justapps-backend/pkg/models"

	"github.com/google/uuid"
)

func TestModeratorAppPermissions(t *testing.T) {
	app := models.Apps{ID: "app-1", OwnerID: uuid.New(), IsLocked: true, Status: "draft"}
	viewerID := uuid.New()

	if !canViewApp(app, viewerID, "moderator", true, map[string]struct{}{}) {
		t.Fatal("moderator should be able to view draft apps")
	}

	got := appViewerPermissions(app, viewerID, "moderator", true, false)
	if got == nil || !got.CanEdit || !got.CanDelete {
		t.Fatalf("moderator should be able to edit and delete locked apps, got %#v", got)
	}
	if got.CanManageEditors {
		t.Fatal("moderator must not manage app editors")
	}
	if got.AccessRole != "moderator" {
		t.Fatalf("AccessRole = %q, want moderator", got.AccessRole)
	}
}

func TestRegularUserCannotModerateLockedApp(t *testing.T) {
	viewerID := uuid.New()
	app := models.Apps{ID: "app-1", OwnerID: viewerID, IsLocked: true}

	got := appViewerPermissions(app, viewerID, "user", true, false)
	if got == nil {
		t.Fatal("owner should receive viewer permissions")
	}
	if got.CanEdit || got.CanDelete {
		t.Fatalf("locked app must not be editable by its regular owner, got %#v", got)
	}
}
