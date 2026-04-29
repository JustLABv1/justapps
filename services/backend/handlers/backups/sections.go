package backups

import (
	"errors"
	"strings"

	"justapps-backend/pkg/models"
)

func canonicalBackupSection(section string) (string, bool) {
	trimmed := strings.TrimSpace(section)
	if trimmed == "" {
		return "", false
	}

	switch strings.ToLower(trimmed) {
	case "gitlabproviders":
		return "repositoryProviders", true
	case "gitlabapplinks":
		return "repositoryAppLinks", true
	}

	for _, candidate := range allSections {
		if strings.EqualFold(trimmed, candidate) {
			return candidate, true
		}
	}
	return "", false
}

func normalizeSectionList(sections []string) ([]string, error) {
	seen := make(map[string]struct{}, len(sections))
	normalized := make([]string, 0, len(sections))
	for _, section := range sections {
		matched, ok := canonicalBackupSection(section)
		if !ok {
			return nil, errors.New("unknown backup section: " + section)
		}
		if _, exists := seen[matched]; exists {
			continue
		}
		seen[matched] = struct{}{}
		normalized = append(normalized, matched)
	}
	return normalized, nil
}

func manifestAvailableSections(manifest models.BackupManifest) ([]string, error) {
	if len(manifest.Sections) > 0 {
		return normalizeSectionList(manifest.Sections)
	}
	if len(manifest.Summary) > 0 {
		sections := make([]string, 0, len(manifest.Summary))
		for _, summary := range manifest.Summary {
			sections = append(sections, summary.Name)
		}
		return normalizeSectionList(sections)
	}
	return inferManifestSections(manifest), nil
}

func filterUnavailableSections(requestedSections []string, availableSections []string) ([]string, []string) {
	if len(availableSections) == 0 {
		return requestedSections, nil
	}

	available := make(map[string]struct{}, len(availableSections))
	for _, section := range availableSections {
		available[section] = struct{}{}
	}

	filtered := make([]string, 0, len(requestedSections))
	skipped := make([]string, 0)
	for _, section := range requestedSections {
		if _, ok := available[section]; ok {
			filtered = append(filtered, section)
			continue
		}
		skipped = append(skipped, section)
	}
	return filtered, skipped
}
