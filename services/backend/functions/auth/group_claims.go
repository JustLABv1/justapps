package auth

import (
	"errors"
	"fmt"
	"strings"
)

func NormalizeOIDCGroupsClaim(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return "groups"
	}
	return path
}

// JSON Pointer handles claim keys containing dots or slashes unambiguously.
func groupClaimSegments(path string) ([]string, error) {
	path = NormalizeOIDCGroupsClaim(path)
	if len(path) > 512 {
		return nil, errors.New("groups claim path exceeds 512 characters")
	}
	if strings.HasPrefix(path, "/") {
		parts := strings.Split(path[1:], "/")
		for i, part := range parts {
			for j := 0; j < len(part); j++ {
				if part[j] == '~' {
					if j+1 >= len(part) || (part[j+1] != '0' && part[j+1] != '1') {
						return nil, errors.New("invalid JSON Pointer escape")
					}
					j++
				}
			}
			parts[i] = strings.NewReplacer("~1", "/", "~0", "~").Replace(part)
		}
		return parts, nil
	}
	parts := strings.Split(path, ".")
	for _, part := range parts {
		if part == "" {
			return nil, errors.New("empty segment in groups claim path")
		}
	}
	return parts, nil
}
func ValidateOIDCGroupsClaim(path string) error { _, err := groupClaimSegments(path); return err }

func GroupsFromClaims(claims map[string]interface{}, path string) ([]string, error) {
	path = NormalizeOIDCGroupsClaim(path)
	parts, err := groupClaimSegments(path)
	if err != nil {
		return nil, err
	}
	var value interface{}
	// Prefer a literal top-level claim name for backwards compatibility.
	direct, ok := claims[path]
	if !strings.HasPrefix(path, "/") && ok {
		value = direct
	} else {
		var current interface{} = claims
		for _, part := range parts {
			object, ok := current.(map[string]interface{})
			if !ok {
				return nil, errors.New("groups claim parent must be an object")
			}
			next, found := object[part]
			if !found {
				return nil, nil
			}
			current = next
		}
		value = current
	}
	if value == nil {
		return nil, nil
	}
	switch groups := value.(type) {
	case []string:
		return groups, nil
	case []interface{}:
		result := make([]string, 0, len(groups))
		for _, entry := range groups {
			group, ok := entry.(string)
			if !ok {
				return nil, errors.New("groups claim must contain only strings")
			}
			result = append(result, group)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("groups claim %q must be an array of strings", path)
	}
}
