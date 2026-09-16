package permissions

import (
	"context"
	"strings"
	"sync"

	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

type Permission string

const (
	ModerateFAQ         Permission = "faq:moderate"
	ModerateApps        Permission = "apps:moderate"
	ViewFAQInsights     Permission = "faq:insights:view"
	DeleteFAQQuestions  Permission = "faq:questions:delete"
	DeleteFAQAnswers    Permission = "faq:answers:delete"
	PinFAQAnswers       Permission = "faq:answers:pin"
	RecommendFAQAnswers Permission = "faq:answers:recommend"
	ViewAppDrafts       Permission = "apps:drafts:view"
	EditApps            Permission = "apps:edit"
	DeleteApps          Permission = "apps:delete"
	ViewAppHealth       Permission = "apps:health:view"
)

const (
	RoleUser      = "user"
	RoleModerator = "moderator"
	RoleAdmin     = "admin"
)

var rolePermissions = map[string]map[Permission]struct{}{
	RoleModerator: {
		ModerateFAQ:  {},
		ModerateApps: {},
	},
}

var rolePermissionsMu sync.RWMutex

type Definition struct {
	Key         Permission `json:"key"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Group       string     `json:"group"`
}

func Definitions() []Definition {
	return []Definition{
		{Key: ViewFAQInsights, Name: "FAQ-Insights ansehen", Description: "Plattformweite FAQ-Kennzahlen und offene Fragen einsehen.", Group: "FAQ"},
		{Key: DeleteFAQQuestions, Name: "FAQ-Fragen löschen", Description: "Fragen anderer Benutzer einschließlich ihrer Antworten löschen.", Group: "FAQ"},
		{Key: DeleteFAQAnswers, Name: "FAQ-Antworten löschen", Description: "Antworten anderer Benutzer entfernen.", Group: "FAQ"},
		{Key: PinFAQAnswers, Name: "FAQ-Antworten anpinnen", Description: "Antworten prominent an erster Stelle hervorheben.", Group: "FAQ"},
		{Key: RecommendFAQAnswers, Name: "FAQ-Antworten empfehlen", Description: "Antworten als redaktionell empfohlen markieren.", Group: "FAQ"},
		{Key: ViewAppDrafts, Name: "App-Entwürfe ansehen", Description: "Nicht veröffentlichte Apps im Katalog und in App-FAQs sehen.", Group: "Apps"},
		{Key: EditApps, Name: "Apps bearbeiten", Description: "Beliebige Apps einschließlich gesperrter Apps inhaltlich bearbeiten.", Group: "Apps"},
		{Key: DeleteApps, Name: "Apps löschen", Description: "Beliebige Apps einschließlich gesperrter Apps löschen.", Group: "Apps"},
		{Key: ViewAppHealth, Name: "App-Gesundheit ansehen", Description: "Gesundheitsdaten und KI-Erklärungen für alle Apps einsehen.", Group: "Apps"},
	}
}

func NormalizeRole(role string) string {
	return strings.ToLower(strings.TrimSpace(role))
}

func IsValidRole(role string) bool {
	switch NormalizeRole(role) {
	case RoleUser, RoleModerator, RoleAdmin:
		return true
	default:
		return false
	}
}

func Has(role string, permission Permission) bool {
	role = NormalizeRole(role)
	if role == RoleAdmin {
		return true
	}
	rolePermissionsMu.RLock()
	defer rolePermissionsMu.RUnlock()
	configured := rolePermissions[role]
	_, ok := configured[permission]
	if !ok && isFAQPermission(permission) {
		_, ok = configured[ModerateFAQ]
	}
	if !ok && isAppPermission(permission) {
		_, ok = configured[ModerateApps]
	}
	return ok
}

func isFAQPermission(permission Permission) bool {
	switch permission {
	case ViewFAQInsights, DeleteFAQQuestions, DeleteFAQAnswers, PinFAQAnswers, RecommendFAQAnswers:
		return true
	default:
		return false
	}
}

func isAppPermission(permission Permission) bool {
	switch permission {
	case ViewAppDrafts, EditApps, DeleteApps, ViewAppHealth:
		return true
	default:
		return false
	}
}

func HasAny(role string, values ...Permission) bool {
	for _, value := range values {
		if Has(role, value) {
			return true
		}
	}
	return false
}

func LoadRole(ctx context.Context, db *bun.DB, role string) error {
	role = NormalizeRole(role)
	if role == "" || role == RoleAdmin || role == RoleUser {
		return nil
	}
	rows := make([]models.RolePermission, 0)
	if err := db.NewSelect().Model(&rows).Where("role_key = ?", role).Scan(ctx); err != nil {
		return err
	}
	loaded := make(map[Permission]struct{}, len(rows))
	for _, row := range rows {
		loaded[Permission(row.Permission)] = struct{}{}
	}
	rolePermissionsMu.Lock()
	rolePermissions[role] = loaded
	rolePermissionsMu.Unlock()
	return nil
}

func SetRole(role string, values []string) {
	loaded := make(map[Permission]struct{}, len(values))
	for _, value := range values {
		loaded[Permission(value)] = struct{}{}
	}
	rolePermissionsMu.Lock()
	rolePermissions[NormalizeRole(role)] = loaded
	rolePermissionsMu.Unlock()
}

func RemoveRole(role string) {
	rolePermissionsMu.Lock()
	delete(rolePermissions, NormalizeRole(role))
	rolePermissionsMu.Unlock()
}

func KeysForRole(role string) []string {
	result := make([]string, 0)
	for _, definition := range Definitions() {
		if Has(role, definition.Key) {
			result = append(result, string(definition.Key))
		}
	}
	return result
}

func EffectiveKeys(values []string) []string {
	set := make(map[Permission]struct{}, len(values))
	for _, value := range values {
		set[Permission(value)] = struct{}{}
	}
	result := make([]string, 0)
	for _, definition := range Definitions() {
		_, exact := set[definition.Key]
		_, faqUmbrella := set[ModerateFAQ]
		_, appUmbrella := set[ModerateApps]
		if exact || (faqUmbrella && isFAQPermission(definition.Key)) || (appUmbrella && isAppPermission(definition.Key)) {
			result = append(result, string(definition.Key))
		}
	}
	return result
}
