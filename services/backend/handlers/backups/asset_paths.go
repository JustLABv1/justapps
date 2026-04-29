package backups

import (
	"net/url"
	"path"
	"strings"
)

func normalizeUploadReference(value string) (string, string, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", "", false
	}

	reference := trimmed
	if parsed, err := url.Parse(trimmed); err == nil && strings.TrimSpace(parsed.Path) != "" {
		reference = parsed.Path
	}

	slashPath := strings.ReplaceAll(reference, "\\", "/")
	index := strings.Index(slashPath, "/uploads/")
	if index == -1 {
		if strings.HasPrefix(slashPath, "uploads/") {
			slashPath = "/" + slashPath
			index = 0
		} else {
			return "", "", false
		}
	}

	cleaned := path.Clean(slashPath[index+1:])
	if cleaned == "." || cleaned == "uploads" || strings.HasPrefix(cleaned, "../") || !strings.HasPrefix(cleaned, "uploads/") {
		return "", "", false
	}

	return cleaned, "/" + cleaned, true
}

func normalizeBackupAssetPath(relativePath string, filename string) (string, string, bool) {
	if cleaned, publicURL, ok := normalizeUploadReference(relativePath); ok {
		return cleaned, publicURL, true
	}
	if strings.TrimSpace(relativePath) != "" {
		return "", "", false
	}

	base := path.Base(strings.TrimSpace(filename))
	if base == "." || base == "" || base == "/" {
		return "", "", false
	}

	cleaned := path.Clean(path.Join("uploads", base))
	if !strings.HasPrefix(cleaned, "uploads/") {
		return "", "", false
	}

	return cleaned, "/" + cleaned, true
}

func canonicalUploadReference(value string) string {
	_, publicURL, ok := normalizeUploadReference(value)
	if !ok {
		return value
	}
	return publicURL
}
