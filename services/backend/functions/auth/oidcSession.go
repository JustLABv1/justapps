package auth

import (
	"errors"
	"time"

	"just-apps-backend/config"

	"github.com/golang-jwt/jwt/v5"
)

// OIDCSessionClaim represents a backend-issued JWT for OIDC-authenticated users.
// This token is issued after validating a Keycloak ID token and allows the frontend
// to stay authenticated without depending on Keycloak's session/refresh infrastructure.
type OIDCSessionClaim struct {
	Email             string `json:"email"`
	PreferredUsername string `json:"preferred_username"`
	Role              string `json:"role"`
	Type              string `json:"type"`
	jwt.RegisteredClaims
}

const oidcSessionTokenType = "oidc_session"
const oidcSessionDuration = 8 * time.Hour

// GenerateOIDCSessionJWT creates a backend-signed JWT for an OIDC-authenticated user.
// The token is valid for 8 hours and does not require a database entry.
func GenerateOIDCSessionJWT(email, username, role string) (tokenString string, expiresAt int64, err error) {
	jwtKey := []byte(config.Config.JWT.Secret)
	expiry := time.Now().Add(oidcSessionDuration)

	claims := &OIDCSessionClaim{
		Email:             email,
		PreferredUsername: username,
		Role:              role,
		Type:              oidcSessionTokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err = token.SignedString(jwtKey)
	expiresAt = expiry.Unix()
	return
}

// ValidateOIDCSessionToken parses and validates a backend-issued OIDC session JWT.
// Returns the claims if valid, or an error if the token is invalid/expired/wrong type.
func ValidateOIDCSessionToken(signedToken string) (*OIDCSessionClaim, error) {
	signedToken = CleanToken(signedToken)
	jwtKey := []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(signedToken, &OIDCSessionClaim{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtKey, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*OIDCSessionClaim)
	if !ok || !token.Valid {
		return nil, errors.New("invalid oidc session token")
	}

	if claims.Type != oidcSessionTokenType {
		return nil, errors.New("token is not an oidc_session type")
	}

	return claims, nil
}
