package auth

import (
	"context"
	"crypto/tls"
	"errors"
	"justwms-backend/config"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	log "github.com/sirupsen/logrus"
)

var (
	oidcProvider *oidc.Provider
	oidcVerifier *oidc.IDTokenVerifier
)

func InitOIDC() error {
	if !config.Config.OIDC.Enabled {
		log.Debug("OIDC: Disabled in configuration")
		return nil
	}

	log.WithFields(log.Fields{
		"issuer":    config.Config.OIDC.Issuer,
		"client_id": config.Config.OIDC.ClientID,
		"insecure":  config.Config.OIDC.Insecure,
	}).Info("OIDC: Initializing provider...")

	ctx := context.Background()

	// If insecure mode is enabled, create a custom HTTP client that skips TLS verification
	if config.Config.OIDC.Insecure {
		tr := &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		client := &http.Client{Transport: tr}
		ctx = oidc.ClientContext(ctx, client)
		log.Warn("OIDC: Initializing in INSECURE mode (skipping TLS verification)")
	}

	provider, err := oidc.NewProvider(ctx, config.Config.OIDC.Issuer)
	if err != nil {
		return err
	}

	oidcProvider = provider
	oidcVerifier = provider.Verifier(&oidc.Config{
		ClientID: config.Config.OIDC.ClientID,
	})

	return nil
}

func ValidateOIDCToken(signedToken string) (*oidc.IDToken, error) {
	if !config.Config.OIDC.Enabled {
		return nil, errors.New("OIDC is not enabled")
	}

	if oidcVerifier == nil {
		if err := InitOIDC(); err != nil {
			log.WithError(err).Error("OIDC: Failed to initialize verifier during token validation")
			return nil, err
		}
	}

	signedToken = CleanToken(signedToken)
	ctx := context.Background()

	if config.Config.OIDC.Insecure {
		tr := &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		client := &http.Client{Transport: tr}
		ctx = oidc.ClientContext(ctx, client)
	}

	idToken, err := oidcVerifier.Verify(ctx, signedToken)
	if err != nil {
		log.WithError(err).Warn("OIDC: Token verification failed")
		return nil, err
	}

	return idToken, nil
}

type OIDCClaims struct {
	Email          string                  `json:"email"`
	PreferredUser  string                  `json:"preferred_username"`
	Groups         []string                `json:"groups"`
	Roles          []string                `json:"roles"`
	RealmAccess    map[string][]string     `json:"realm_access"`
	ResourceAccess map[string]ResourceRole `json:"resource_access"`
}

type ResourceRole struct {
	Roles []string `json:"roles"`
}

func GetOIDCClaims(idToken *oidc.IDToken) (*OIDCClaims, error) {
	var rawClaims map[string]interface{}
	if err := idToken.Claims(&rawClaims); err != nil {
		return nil, err
	}

	claims := &OIDCClaims{
		Email:         getString(rawClaims, "email"),
		PreferredUser: getString(rawClaims, "preferred_username"),
		Groups:        getStringSlice(rawClaims, "groups"),
		Roles:         getStringSlice(rawClaims, "roles"),
	}

	// Handle nested objects
	if ra, ok := rawClaims["realm_access"].(map[string]interface{}); ok {
		claims.RealmAccess = make(map[string][]string)
		if roles, ok := ra["roles"].([]interface{}); ok {
			claims.RealmAccess["roles"] = make([]string, 0, len(roles))
			for _, r := range roles {
				if s, ok := r.(string); ok {
					claims.RealmAccess["roles"] = append(claims.RealmAccess["roles"], s)
				}
			}
		}
	}

	if res, ok := rawClaims["resource_access"].(map[string]interface{}); ok {
		claims.ResourceAccess = make(map[string]ResourceRole)
		for client, data := range res {
			if clientData, ok := data.(map[string]interface{}); ok {
				if roles, ok := clientData["roles"].([]interface{}); ok {
					rr := ResourceRole{Roles: make([]string, 0, len(roles))}
					for _, r := range roles {
						if s, ok := r.(string); ok {
							rr.Roles = append(rr.Roles, s)
						}
					}
					claims.ResourceAccess[client] = rr
				}
			}
		}
	}

	return claims, nil
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getStringSlice(m map[string]interface{}, key string) []string {
	if v, ok := m[key].([]interface{}); ok {
		s := make([]string, 0, len(v))
		for _, item := range v {
			if str, ok := item.(string); ok {
				s = append(s, str)
			}
		}
		return s
	}
	return nil
}

func IsAdminOIDC(claims *OIDCClaims) bool {
	adminGroup := strings.ToLower(config.Config.OIDC.AdminGroup)
	if adminGroup == "" {
		adminGroup = "admin"
	}

	// Helper to check a slices for permission
	hasPermission := func(perms []string) bool {
		for _, p := range perms {
			pLower := strings.ToLower(p)
			if pLower == adminGroup || pLower == "/"+adminGroup || pLower == "admin" {
				return true
			}
		}
		return false
	}

	// Check main groups
	if hasPermission(claims.Groups) {
		return true
	}

	// Check main roles
	if hasPermission(claims.Roles) {
		return true
	}

	// Check realm access
	if hasPermission(claims.RealmAccess["roles"]) {
		return true
	}

	// Check resource access (client roles)
	for _, res := range claims.ResourceAccess {
		if hasPermission(res.Roles) {
			return true
		}
	}

	return false
}
