package models

import (
	"encoding/json"
	"github.com/google/uuid"
	"testing"
)

func TestMembershipBackupPreservesIndependentSources(t *testing.T) {
	userID, spaceID := uuid.New(), uuid.New()
	cases := []struct {
		name, payload     string
		invited, accepted bool
	}{
		{"legacy manual", `{"userId":"` + userID.String() + `","spaceId":"` + spaceID.String() + `","accepted":true}`, true, true},
		{"group only", `{"userId":"` + userID.String() + `","spaceId":"` + spaceID.String() + `","accepted":true,"manualInvited":false,"manualAccepted":false}`, false, false},
		{"pending manual plus group", `{"userId":"` + userID.String() + `","spaceId":"` + spaceID.String() + `","accepted":true,"manualInvited":true,"manualAccepted":false}`, true, false},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			var member PrivateSpaceMember
			if err := json.Unmarshal([]byte(test.payload), &member); err != nil {
				t.Fatal(err)
			}
			if member.UserID != userID || member.SpaceID != spaceID || member.ManualInvited != test.invited || member.ManualAccepted != test.accepted {
				t.Fatalf("wrong membership source: %#v", member)
			}
		})
	}
}
