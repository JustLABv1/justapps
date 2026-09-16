package admins

import (
	"fmt"
	"net/http"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

func UpdateUser(context *gin.Context, db *bun.DB) {
	userID := context.Param("userID")

	var user models.Users
	if err := context.ShouldBindJSON(&user); err != nil {
		httperror.StatusBadRequest(context, "Error parsing incoming data", err)
		return
	}

	// get user db data
	var userDB models.Users
	err := db.NewSelect().Model(&userDB).Where("id = ?", userID).Scan(context)
	if err != nil {
		httperror.InternalServerError(context, "Error getting user from db", err)
		return
	}

	if user.Password != "" {
		// hash password
		if err := user.HashPassword(user.Password); err != nil {
			httperror.InternalServerError(context, "Error encrypting user password", err)
			return
		}
	} else {
		user.Password = userDB.Password
	}

	user.UpdatedAt = time.Now()
	user.Role = permissions.NormalizeRole(user.Role)
	if user.Role == "" {
		user.Role = permissions.NormalizeRole(userDB.Role)
	}
	validRole, roleErr := roleExists(context, db, user.Role)
	if roleErr != nil {
		httperror.InternalServerError(context, "Error validating user role", roleErr)
		return
	}
	if !validRole {
		httperror.StatusBadRequest(context, "Invalid user role", fmt.Errorf("unsupported role %q", user.Role))
		return
	}
	_, err = db.NewUpdate().Model(&user).Column("username", "email", "role", "can_submit_apps", "updated_at", "password").Where("id = ?", userID).Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error updating user on db", err)
		return
	}

	callerID := context.GetString("user_id")
	audit.WriteAudit(context.Request.Context(), db, callerID, "user.update", fmt.Sprintf("updated user %s (id: %s)", user.Email, userID))
	context.JSON(http.StatusCreated, gin.H{"result": "success"})
}
