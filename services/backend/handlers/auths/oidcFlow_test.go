package auths

import (
	"testing"

	"justapps-backend/pkg/models"
)

func TestShouldReactivateOIDCUserDisabledBySafeRestore(t *testing.T) {
	affectedUser := &models.Users{
		AuthType:       "oidc",
		Disabled:       true,
		DisabledReason: models.RestoredSafeBackupPasswordResetReason,
	}
	if !shouldReactivateOIDCUserDisabledBySafeRestore(affectedUser) {
		t.Fatal("OIDC user disabled by safe restore should be reactivated")
	}

	intentionallyDisabledUser := &models.Users{
		AuthType:       "oidc",
		Disabled:       true,
		DisabledReason: "Disabled by administrator",
	}
	if shouldReactivateOIDCUserDisabledBySafeRestore(intentionallyDisabledUser) {
		t.Fatal("intentionally disabled OIDC user must remain disabled")
	}
}
