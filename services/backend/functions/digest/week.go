// Package digest builds the weekly summary of the catalog ("Wochenrückblick")
// and sends it to the users who asked for it.
package digest

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata" // the summary is cut at German midnight, also in minimal containers
)

// Location is where a week starts and ends: Monday 00:00 German time.
var Location = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Berlin")
	if err != nil {
		return time.UTC
	}
	return loc
}()

// Week is an ISO week, such as 2026-W46.
type Week struct {
	Year int
	Num  int
}

var errInvalidWeek = errors.New("week must look like 2026-W46")

// ParseWeek reads "2026-W46".
func ParseWeek(value string) (Week, error) {
	value = strings.TrimSpace(strings.ToUpper(value))
	year, num, found := strings.Cut(value, "-W")
	if !found {
		return Week{}, errInvalidWeek
	}
	y, err := strconv.Atoi(year)
	if err != nil {
		return Week{}, errInvalidWeek
	}
	n, err := strconv.Atoi(num)
	if err != nil || n < 1 || n > 53 {
		return Week{}, errInvalidWeek
	}
	week := Week{Year: y, Num: n}
	// Week 53 exists only in some years: it must survive a round trip.
	if WeekOf(week.Start()) != week {
		return Week{}, errInvalidWeek
	}
	return week, nil
}

// WeekOf is the ISO week a moment falls in, in German time.
func WeekOf(t time.Time) Week {
	year, num := t.In(Location).ISOWeek()
	return Week{Year: year, Num: num}
}

// String is the canonical form, "2026-W46".
func (w Week) String() string {
	return fmt.Sprintf("%d-W%02d", w.Year, w.Num)
}

// Start is Monday 00:00 of the week, German time.
func (w Week) Start() time.Time {
	// January 4th is always in ISO week 1.
	jan4 := time.Date(w.Year, time.January, 4, 0, 0, 0, 0, Location)
	offset := (int(jan4.Weekday()) + 6) % 7 // days since Monday
	monday := jan4.AddDate(0, 0, -offset)
	return monday.AddDate(0, 0, (w.Num-1)*7)
}

// End is the following Monday 00:00, exclusive.
func (w Week) End() time.Time {
	return w.Start().AddDate(0, 0, 7)
}

// Previous is the week before.
func (w Week) Previous() Week {
	return WeekOf(w.Start().AddDate(0, 0, -1))
}

// Next is the week after.
func (w Week) Next() Week {
	return WeekOf(w.End())
}

var monthNames = [...]string{"Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"}

// Label reads "KW 46 · 10.–16. November 2026".
func (w Week) Label() string {
	start := w.Start()
	end := w.End().AddDate(0, 0, -1)
	var span string
	switch {
	case start.Year() != end.Year():
		span = fmt.Sprintf("%d. %s %d – %d. %s %d", start.Day(), monthNames[start.Month()-1], start.Year(), end.Day(), monthNames[end.Month()-1], end.Year())
	case start.Month() != end.Month():
		span = fmt.Sprintf("%d. %s – %d. %s %d", start.Day(), monthNames[start.Month()-1], end.Day(), monthNames[end.Month()-1], end.Year())
	default:
		span = fmt.Sprintf("%d.–%d. %s %d", start.Day(), end.Day(), monthNames[end.Month()-1], end.Year())
	}
	return fmt.Sprintf("KW %d · %s", w.Num, span)
}
