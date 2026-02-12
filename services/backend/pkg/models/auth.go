package models

import (
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTClaim struct {
	ID   uuid.UUID `json:"id"`
	Type string    `json:"type"`
	jwt.RegisteredClaims
}

type JWTBridgeClaim struct {
	ID       uuid.UUID `json:"id"`
	BridgeID string    `json:"bridge_id"`
	Type     string    `json:"type"`
	jwt.RegisteredClaims
}
