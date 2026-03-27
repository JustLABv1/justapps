package users

import (
	"errors"

	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func getUserIDFromContext(context *gin.Context) (uuid.UUID, bool) {
	userIDVal, exists := context.Get("user_id")
	if !exists {
		httperror.Unauthorized(context, "User ID not found in context", errors.New("unauthorized"))
		return uuid.Nil, false
	}

	switch userID := userIDVal.(type) {
	case uuid.UUID:
		if userID == uuid.Nil {
			httperror.Unauthorized(context, "User ID is missing from the authenticated session", errors.New("empty user id"))
			return uuid.Nil, false
		}
		return userID, true
	case string:
		parsedID, err := uuid.Parse(userID)
		if err != nil {
			httperror.InternalServerError(context, "Invalid User ID format", err)
			return uuid.Nil, false
		}
		if parsedID == uuid.Nil {
			httperror.Unauthorized(context, "User ID is missing from the authenticated session", errors.New("empty user id"))
			return uuid.Nil, false
		}
		return parsedID, true
	default:
		httperror.InternalServerError(context, "Invalid User ID type in context", errors.New("invalid type"))
		return uuid.Nil, false
	}
}
