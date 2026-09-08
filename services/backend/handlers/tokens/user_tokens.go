package tokens

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode"

	"justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

const (
	userTokenType       = "mcp"
	defaultTokenDays    = 90
	maxTokenDescription = 120
)

var allowedTokenLifetimes = map[int]time.Duration{
	30:  30 * 24 * time.Hour,
	90:  90 * 24 * time.Hour,
	365: 365 * 24 * time.Hour,
}

type CreateUserTokenRequest struct {
	Description   string `json:"description"`
	ExpiresInDays int    `json:"expires_in_days"`
}

type userTokenResponse struct {
	ID          uuid.UUID  `json:"id"`
	Description string     `json:"description"`
	Type        string     `json:"type"`
	Disabled    bool       `json:"disabled"`
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	KeyPreview  string     `json:"key_preview"`
}

// ListUserTokens returns only MCP tokens owned by the authenticated user.
// Full token values are intentionally never returned after creation.
func ListUserTokens(context *gin.Context, db *bun.DB) {
	userID, ok := authenticatedUserID(context)
	if !ok {
		return
	}

	tokens := make([]models.Tokens, 0)
	err := db.NewSelect().Model(&tokens).
		Where("user_id = ?", userID.String()).
		Where("type = ?", userTokenType).
		OrderExpr("created_at DESC").
		Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error collecting user tokens on db", err)
		return
	}

	response := make([]userTokenResponse, 0, len(tokens))
	for _, token := range tokens {
		response = append(response, sanitizeUserToken(token))
	}
	context.JSON(http.StatusOK, gin.H{"tokens": response})
}

// CreateUserToken creates a user-scoped MCP token and returns its full value
// once. The frontend must hand it to the user without persisting it.
func CreateUserToken(context *gin.Context, db *bun.DB) {
	userID, ok := authenticatedUserID(context)
	if !ok {
		return
	}

	var request CreateUserTokenRequest
	if err := context.ShouldBindJSON(&request); err != nil {
		httperror.StatusBadRequest(context, "Error parsing incoming token data", err)
		return
	}

	description := strings.TrimSpace(request.Description)
	if description == "" {
		description = "JustApps MCP-Zugriff"
	}
	if len([]rune(description)) > maxTokenDescription {
		httperror.StatusBadRequest(context, "Token description is too long", errors.New("token description is too long"))
		return
	}
	for _, character := range description {
		if unicode.IsControl(character) {
			httperror.StatusBadRequest(context, "Token description contains invalid characters", errors.New("token description contains control characters"))
			return
		}
	}

	days := request.ExpiresInDays
	if days == 0 {
		days = defaultTokenDays
	}
	lifetime, ok := allowedTokenLifetimes[days]
	if !ok {
		httperror.StatusBadRequest(context, "Token expiration must be 30, 90, or 365 days", errors.New("unsupported token lifetime"))
		return
	}

	tokenString, expiresAt, err := auth.GenerateUserToken(userID, lifetime)
	if err != nil {
		httperror.InternalServerError(context, "Error generating user token", err)
		return
	}

	token := models.Tokens{
		Key:         tokenString,
		Description: description,
		Type:        userTokenType,
		ExpiresAt:   time.Unix(expiresAt, 0).UTC(),
		CreatedAt:   time.Now().UTC(),
		UserID:      userID.String(),
	}
	if _, err := db.NewInsert().Model(&token).Exec(context); err != nil {
		httperror.InternalServerError(context, "Error writing user token to db", err)
		return
	}

	context.JSON(http.StatusCreated, gin.H{
		"token":      tokenString,
		"token_info": sanitizeUserToken(token),
	})
}

// RevokeUserToken disables one of the authenticated user's MCP tokens.
func RevokeUserToken(context *gin.Context, db *bun.DB) {
	userID, ok := authenticatedUserID(context)
	if !ok {
		return
	}

	tokenID, err := uuid.Parse(strings.TrimSpace(context.Param("tokenID")))
	if err != nil {
		httperror.StatusBadRequest(context, "Invalid token ID", err)
		return
	}

	result, err := db.NewUpdate().Model(&models.Tokens{}).
		Set("disabled = ?", true).
		Set("disabled_reason = ?", "Revoked by user").
		Where("id = ?", tokenID).
		Where("user_id = ?", userID.String()).
		Where("type = ?", userTokenType).
		Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error revoking user token on db", err)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		httperror.InternalServerError(context, "Error checking revoked user token", err)
		return
	}
	if rowsAffected == 0 {
		context.JSON(http.StatusNotFound, gin.H{"message": "Token not found"})
		return
	}

	context.JSON(http.StatusOK, gin.H{"result": "success"})
}

func authenticatedUserID(context *gin.Context) (uuid.UUID, bool) {
	value, exists := context.Get("user_id")
	if !exists {
		httperror.Unauthorized(context, "User ID not found in context", errors.New("user id not found in context"))
		return uuid.Nil, false
	}

	switch userID := value.(type) {
	case uuid.UUID:
		if userID == uuid.Nil {
			httperror.Unauthorized(context, "User ID is missing from the authenticated session", errors.New("empty user id"))
			return uuid.Nil, false
		}
		return userID, true
	case string:
		parsed, err := uuid.Parse(userID)
		if err != nil || parsed == uuid.Nil {
			httperror.Unauthorized(context, "User ID is invalid", errors.New("invalid user id"))
			return uuid.Nil, false
		}
		return parsed, true
	default:
		httperror.Unauthorized(context, "User ID is invalid", errors.New("invalid user id type"))
		return uuid.Nil, false
	}
}

func sanitizeUserToken(token models.Tokens) userTokenResponse {
	var expiresAt *time.Time
	if !token.ExpiresAt.IsZero() {
		value := token.ExpiresAt
		expiresAt = &value
	}

	return userTokenResponse{
		ID:          token.ID,
		Description: token.Description,
		Type:        token.Type,
		Disabled:    token.Disabled,
		CreatedAt:   token.CreatedAt,
		ExpiresAt:   expiresAt,
		KeyPreview:  tokenKeyPreview(token.Key),
	}
}

func tokenKeyPreview(key string) string {
	const previewLength = 12
	if len(key) <= previewLength {
		return key
	}
	return key[:previewLength] + "…"
}
