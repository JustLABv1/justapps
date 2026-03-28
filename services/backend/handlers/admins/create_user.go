package admins

import (
	"fmt"
	"net/http"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/uptrace/bun"
)

func CreateUser(context *gin.Context, db *bun.DB) {
	var user models.Users
	if err := context.ShouldBindJSON(&user); err != nil {
		httperror.StatusBadRequest(context, "Error parsing incoming data", err)
		return
	}

	// check if user exists
	firstCount, err := db.NewSelect().Model(&user).Where("email = ?", user.Email).Where("username = ?", user.Username).Count(context)
	if err != nil {
		httperror.InternalServerError(context, "Error checking for email and username on db", err)
		return
	}
	if firstCount > 0 {
		httperror.StatusConflict(context, "User already exists", nil)
		return
	}

	if err := user.HashPassword(user.Password); err != nil {
		httperror.InternalServerError(context, "Error encrypting user password", err)
		return
	}

	_, err = db.NewInsert().Model(&user).Column("email", "username", "password", "role").Exec(context)
	if err != nil {
		httperror.InternalServerError(context, "Error creating user on db", err)
		return
	}

	callerID := context.GetString("user_id")
	audit.WriteAudit(context.Request.Context(), db, callerID, "user.create", fmt.Sprintf("created user %s", user.Email))
	context.JSON(http.StatusCreated, gin.H{"result": "success"})
}
