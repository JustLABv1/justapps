package appupdates

import (
	"strings"
	"testing"
)

func TestBuildLineDiffCreatesMultipleHunksForSeparatedChanges(t *testing.T) {
	t.Parallel()

	before := strings.Join([]string{
		"line 1",
		"line 2",
		"line 3",
		"line 4",
		"line 5",
		"line 6",
		"line 7",
		"line 8",
		"line 9",
		"line 10",
		"line 11",
		"line 12",
		"line 13",
		"line 14",
		"line 15",
		"line 16",
	}, "\n")
	after := strings.Join([]string{
		"line 1",
		"line 2 changed",
		"line 3",
		"line 4",
		"line 5",
		"line 6",
		"line 7",
		"line 8",
		"line 9",
		"line 10",
		"line 11",
		"line 12",
		"line 13",
		"line 14",
		"line 15 changed",
		"line 16",
	}, "\n")

	diff := buildLineDiff("README", before, after)
	if strings.Count(diff, "@@") < 4 {
		t.Fatalf("expected multiple unified diff hunks, got diff:\n%s", diff)
	}
	if !strings.Contains(diff, "-line 2") || !strings.Contains(diff, "+line 2 changed") {
		t.Fatalf("expected first change in diff, got:\n%s", diff)
	}
	if !strings.Contains(diff, "-line 15") || !strings.Contains(diff, "+line 15 changed") {
		t.Fatalf("expected second change in diff, got:\n%s", diff)
	}
}
