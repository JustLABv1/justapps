package gitlab

import "testing"

func TestNormalizeProjectReference(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		reference    string
		providerType string
		baseURL      string
		want         string
		wantErr      bool
	}{
		{name: "gitlab path", reference: " group/subgroup/project ", providerType: "gitlab", baseURL: "https://gitlab.com", want: "group/subgroup/project"},
		{name: "gitlab url", reference: "https://gitlab.com/group/subgroup/project/-/tree/main", providerType: "gitlab", baseURL: "https://gitlab.com", want: "group/subgroup/project"},
		{name: "self hosted gitlab", reference: "https://code.example.de/gitlab/team/project.git", providerType: "gitlab", baseURL: "https://code.example.de/gitlab", want: "team/project"},
		{name: "github url", reference: "https://github.com/owner/repository/tree/main", providerType: "github", baseURL: "https://github.com", want: "owner/repository"},
		{name: "github clone url", reference: "https://github.com/owner/repository.git", providerType: "github", baseURL: "https://github.com", want: "owner/repository"},
		{name: "wrong provider host", reference: "https://github.com/owner/repository", providerType: "gitlab", baseURL: "https://gitlab.com", wantErr: true},
		{name: "missing namespace", reference: "project", providerType: "gitlab", baseURL: "https://gitlab.com", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got, err := NormalizeProjectReference(test.reference, test.providerType, test.baseURL)
			if test.wantErr {
				if err == nil {
					t.Fatalf("expected an error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}
