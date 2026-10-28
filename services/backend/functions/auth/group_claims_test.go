package auth

import (
	"reflect"
	"testing"
)

func TestGroupsFromConfiguredClaim(t *testing.T) {
	cases := []struct {
		name, path string
		claims     map[string]interface{}
		want       []string
		wantError  bool
	}{
		{"default", "", map[string]interface{}{"groups": []interface{}{"/team"}}, []string{"/team"}, false},
		{"custom name", "memberOf", map[string]interface{}{"memberOf": []interface{}{"CN=Team,OU=Groups"}}, []string{"CN=Team,OU=Groups"}, false},
		{"dot path", "realm.groups", map[string]interface{}{"realm": map[string]interface{}{"groups": []interface{}{"/team"}}}, []string{"/team"}, false},
		{"literal dotted name", "realm.groups", map[string]interface{}{"realm.groups": []interface{}{"literal"}, "realm": map[string]interface{}{"groups": []interface{}{"nested"}}}, []string{"literal"}, false},
		{"json pointer", "/organization/acme/groups", map[string]interface{}{"organization": map[string]interface{}{"acme": map[string]interface{}{"groups": []interface{}{"Engineering"}}}}, []string{"Engineering"}, false},
		{"escaped key", "/https:~1~1example.com~1claims/groups", map[string]interface{}{"https://example.com/claims": map[string]interface{}{"groups": []interface{}{"staff"}}}, []string{"staff"}, false},
		{"explicit nested over literal", "/realm/groups", map[string]interface{}{"realm.groups": []interface{}{"literal"}, "realm": map[string]interface{}{"groups": []interface{}{"nested"}}}, []string{"nested"}, false},
		{"missing", "memberOf", map[string]interface{}{}, nil, false},
		{"missing parent", "realm.groups", map[string]interface{}{}, nil, false},
		{"wrong parent type", "realm.groups", map[string]interface{}{"realm": "invalid"}, nil, true},
		{"wrong claim type", "groups", map[string]interface{}{"groups": "admin"}, nil, true},
		{"mixed array", "groups", map[string]interface{}{"groups": []interface{}{"admin", 12}}, nil, true},
		{"invalid dot path", "realm..groups", map[string]interface{}{}, nil, true},
		{"invalid pointer", "/realm~2/groups", map[string]interface{}{}, nil, true},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			got, err := GroupsFromClaims(test.claims, test.path)
			if (err != nil) != test.wantError {
				t.Fatalf("error=%v wantError=%v", err, test.wantError)
			}
			if !test.wantError && !reflect.DeepEqual(got, test.want) {
				t.Fatalf("groups=%#v want=%#v", got, test.want)
			}
		})
	}
}
