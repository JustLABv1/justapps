package auth

import (
	"errors"
	"time"

	"justwms-backend/config"
	"justwms-backend/pkg/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func ValidateToken(signedToken string) (err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(
		signedToken,
		&models.JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtKey), nil
		},
	)
	if err != nil {
		return
	}
	claims, ok := token.Claims.(*models.JWTClaim)
	if !ok {
		err = errors.New("couldn't parse claims")
		return
	}
	if claims.ExpiresAt.Unix() < time.Now().Local().Unix() {
		err = errors.New("token expired")
		return
	}
	return
}

func GetTypeFromToken(signedToken string) (tokenType string, err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(
		signedToken,
		&models.JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtKey), nil
		},
	)
	if err != nil {
		return
	}
	claims, ok := token.Claims.(*models.JWTClaim)
	if !ok {
		err = errors.New("couldn't parse claims")
		return
	}
	tokenType = claims.Type
	return
}

func GetIDFromToken(signedToken string) (tokenID string, err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(
		signedToken,
		&models.JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtKey), nil
		},
	)
	if err != nil {
		return
	}
	claims, ok := token.Claims.(*models.JWTClaim)
	if !ok {
		err = errors.New("couldn't parse claims")
		return
	}
	tokenID = claims.ID.String()
	return
}

func GetUserIDFromToken(signedToken string) (id uuid.UUID, err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(
		signedToken,
		&models.JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtKey), nil
		},
	)
	if err != nil {
		return
	}
	claims, ok := token.Claims.(*models.JWTClaim)
	if !ok {
		err = errors.New("couldn't parse claims")
		return
	}
	id = claims.ID
	return
}

func RefreshToken(signedToken string) (newToken string, ExpiresAt int64, err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(
		signedToken,
		&models.JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtKey), nil
		},
	)
	if err != nil {
		return "", 0, err
	}

	claims, ok := token.Claims.(*models.JWTClaim)
	if !ok {
		return "", 0, errors.New("couldn't parse claims or token is invalid")
	}

	// Check if the token is close to expiration (e.g., within 30 minutes)
	if time.Unix(claims.ExpiresAt.Unix(), 0).Sub(time.Now().Local()) > 30*time.Minute {
		return "", 0, errors.New("token is not close to expiration")
	}

	// Generate a new token with the same claims but a new expiration time
	// TODO: Implement a way to consider rememberMe
	newToken, ExpiresAt, err = GenerateJWT(claims.ID, false)
	return
}

func GetBridgeDataFromToken(signedToken string) (bridgeID string, bridgeType string, err error) {
	var jwtKey = []byte(config.Config.JWT.Secret)

	token, err := jwt.ParseWithClaims(
		signedToken,
		&models.JWTBridgeClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtKey), nil
		},
	)
	if err != nil {
		return
	}
	claims, ok := token.Claims.(*models.JWTBridgeClaim)
	if !ok {
		err = errors.New("couldn't parse claims")
		return
	}
	bridgeID = claims.BridgeID
	bridgeType = claims.Type
	return
}
