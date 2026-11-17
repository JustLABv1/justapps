package digest

import (
	"testing"
	"time"
)

func TestWeekRoundTrip(t *testing.T) {
	week, err := ParseWeek("2026-W46")
	if err != nil {
		t.Fatal(err)
	}
	start := week.Start()
	if start.Weekday() != time.Monday || start.Day() != 9 || start.Month() != time.November {
		t.Fatalf("start = %v, want Monday 9 November 2026", start)
	}
	if got := week.Label(); got != "KW 46 · 9.–15. November 2026" {
		t.Fatalf("label = %q", got)
	}
	if week.Previous().String() != "2026-W45" || week.Next().String() != "2026-W47" {
		t.Fatalf("neighbours = %s, %s", week.Previous(), week.Next())
	}
}

func TestWeekAcrossYear(t *testing.T) {
	week, err := ParseWeek("2026-W01")
	if err != nil {
		t.Fatal(err)
	}
	if week.Previous().String() != "2025-W52" {
		t.Fatalf("previous = %s", week.Previous())
	}
	if _, err := ParseWeek("2025-W53"); err == nil {
		t.Fatal("2025 has no week 53")
	}
	if _, err := ParseWeek("2026-46"); err == nil {
		t.Fatal("malformed week accepted")
	}
}
