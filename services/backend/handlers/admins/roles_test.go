package admins

import "testing"

func TestRoleValidation(t *testing.T) {
	for _, key := range []string{"faq-team", "app2", "redaktion-nord"} {
		if !roleKeyPattern.MatchString(key) {
			t.Fatalf("expected role key %q to be valid", key)
		}
	}
	for _, key := range []string{"A", "admin team", "-invalid", "x"} {
		if roleKeyPattern.MatchString(key) {
			t.Fatalf("expected role key %q to be invalid", key)
		}
	}
	if !validPermissionValues([]string{"faq:answers:pin", "apps:edit"}) {
		t.Fatal("known permissions should be accepted")
	}
	if validPermissionValues([]string{"users:delete"}) {
		t.Fatal("unknown permission should be rejected")
	}
}
