package auth

import (
	"context"
	"errors"
	"justwms-backend/config"

	"github.com/coreos/go-oidc/v3/oidc"
)

var (
	oidcProvider *oidc.Provider
	oidcVerifier *oidc.IDTokenVerifier
)

func InitOIDC() error {
	if !config.Config.OIDC.Enabled {
		return nil
	}

	ctx := context.Background()
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
			return nil, err
		}
	}

	signedToken = CleanToken(signedToken)
	ctx := context.Background()
	idToken, err := oidcVerifier.Verify(ctx, signedToken)
	if err != nil {
		return nil, err
	}

	return idToken, nil
}

type OIDCClaims struct {
	Email         string   `json:"email"`
	PreferredUser string   `json:"preferred_username"`
	Groups        []string `json:"groups"`
	Roles         []string `json:"roles"`
}

func GetOIDCClaims(idToken *oidc.IDToken) (*OIDCClaims, error) {
	var claims OIDCClaims
	if err := idToken.Claims(&claims); err != nil {
		return nil, err
	}
	return &claims, nil
}

func IsAdminOIDC(claims *OIDCClaims) bool {
	adminGroup := config.Config.OIDC.AdminGroup
	if adminGroup == "" {
		adminGroup = "admin"
	}

	for _, g := range claims.Groups {
		if g == adminGroup {
			return true
		}
	}
	for _, r := range claims.Roles {
		if r == adminGroup {
			return true
		}
	}
	return false
}
