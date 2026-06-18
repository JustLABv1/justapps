package backups

import "testing"

func TestImportedUserRequiresPasswordReset(t *testing.T) {
	if importedUserRequiresPasswordReset("oidc") {
		t.Fatal("OIDC users must not require a local password reset")
	}
	if !importedUserRequiresPasswordReset("local") {
		t.Fatal("local users without password hashes must require a password reset")
	}
}
