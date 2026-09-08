package auth

import (
	"errors"
	"time"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func GenerateJWT(id uuid.UUID, rememberMe bool) (tokenString string, ExpiresAt int64, err error) {
	lifetime := 30 * 24 * time.Hour
	if rememberMe {
		lifetime = 90 * 24 * time.Hour
	}
	return generateUserJWT(id, lifetime)
}

// GenerateUserToken creates a user-scoped API token with an explicit lifetime.
// It is used for integrations such as the JustApps MCP endpoint.
func GenerateUserToken(id uuid.UUID, lifetime time.Duration) (tokenString string, ExpiresAt int64, err error) {
	if lifetime <= 0 {
		return "", 0, errors.New("token lifetime must be positive")
	}
	return generateUserJWT(id, lifetime)
}

func generateUserJWT(id uuid.UUID, lifetime time.Duration) (tokenString string, ExpiresAt int64, err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)
	expirationTime := time.Now().Add(lifetime)

	claims := &models.JWTClaim{
		ID:   id,
		Type: "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err = token.SignedString(jwtKey)
	ExpiresAt = expirationTime.Unix()
	return
}
