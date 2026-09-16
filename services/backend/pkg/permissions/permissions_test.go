package permissions

import "testing"

func TestHas(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		permission Permission
		want       bool
	}{
		{"admin has FAQ moderation", RoleAdmin, ModerateFAQ, true},
		{"admin has app moderation", RoleAdmin, ModerateApps, true},
		{"moderator has FAQ moderation", RoleModerator, ModerateFAQ, true},
		{"moderator has app moderation", " Moderator ", ModerateApps, true},
		{"user cannot moderate FAQ", RoleUser, ModerateFAQ, false},
		{"unknown role has no permissions", "editor", ModerateApps, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Has(tt.role, tt.permission); got != tt.want {
				t.Fatalf("Has(%q, %q) = %v, want %v", tt.role, tt.permission, got, tt.want)
			}
		})
	}
}

func TestIsValidRole(t *testing.T) {
	for _, role := range []string{RoleUser, RoleModerator, RoleAdmin, " ADMIN "} {
		if !IsValidRole(role) {
			t.Fatalf("expected %q to be valid", role)
		}
	}
	if IsValidRole("editor") {
		t.Fatal("unexpected custom role to be valid")
	}
}

func TestDynamicRolePermissions(t *testing.T) {
	SetRole("faq-team", []string{string(DeleteFAQAnswers), string(PinFAQAnswers)})
	t.Cleanup(func() { RemoveRole("faq-team") })

	if !Has("faq-team", DeleteFAQAnswers) || !Has("faq-team", PinFAQAnswers) {
		t.Fatal("dynamic role should receive configured fine-grained FAQ permissions")
	}
	if Has("faq-team", DeleteFAQQuestions) || Has("faq-team", EditApps) {
		t.Fatal("dynamic role must not receive unconfigured permissions")
	}
}

func TestLegacyUmbrellaPermissionsExpand(t *testing.T) {
	SetRole("legacy-moderator", []string{string(ModerateFAQ), string(ModerateApps)})
	t.Cleanup(func() { RemoveRole("legacy-moderator") })

	for _, permission := range []Permission{ViewFAQInsights, DeleteFAQQuestions, RecommendFAQAnswers, ViewAppDrafts, EditApps, DeleteApps, ViewAppHealth} {
		if !Has("legacy-moderator", permission) {
			t.Fatalf("legacy umbrella should grant %q", permission)
		}
	}
}
