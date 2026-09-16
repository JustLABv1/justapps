package admins

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

var roleKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,49}$`)

type roleRequest struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

func validPermissionValues(values []string) bool {
	allowed := make(map[string]struct{})
	for _, definition := range permissions.Definitions() {
		allowed[string(definition.Key)] = struct{}{}
	}
	for _, value := range values {
		if _, ok := allowed[value]; !ok {
			return false
		}
	}
	return true
}

func roleExists(ctx *gin.Context, db *bun.DB, key string) (bool, error) {
	return db.NewSelect().Model((*models.Role)(nil)).Where("key = ?", permissions.NormalizeRole(key)).Exists(ctx)
}

func loadRoles(ctx *gin.Context, db *bun.DB) ([]models.Role, error) {
	roles := make([]models.Role, 0)
	if err := db.NewSelect().Model(&roles).OrderExpr("CASE key WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 WHEN 'user' THEN 2 ELSE 3 END, LOWER(name)").Scan(ctx); err != nil {
		return nil, err
	}
	permissionRows := make([]models.RolePermission, 0)
	if err := db.NewSelect().Model(&permissionRows).OrderExpr("permission").Scan(ctx); err != nil {
		return nil, err
	}
	permissionsByRole := make(map[string][]string)
	for _, row := range permissionRows {
		permissionsByRole[row.RoleKey] = append(permissionsByRole[row.RoleKey], row.Permission)
	}
	type countRow struct {
		Role  string `bun:"role"`
		Count int    `bun:"count"`
	}
	counts := make([]countRow, 0)
	if err := db.NewSelect().TableExpr("users").ColumnExpr("role, COUNT(*)::int AS count").GroupExpr("role").Scan(ctx, &counts); err != nil {
		return nil, err
	}
	countByRole := make(map[string]int)
	for _, row := range counts {
		countByRole[row.Role] = row.Count
	}
	for index := range roles {
		roles[index].Permissions = permissions.EffectiveKeys(permissionsByRole[roles[index].Key])
		if roles[index].Permissions == nil {
			roles[index].Permissions = make([]string, 0)
		}
		roles[index].UserCount = countByRole[roles[index].Key]
	}
	return roles, nil
}

func GetRoles(c *gin.Context, db *bun.DB) {
	roles, err := loadRoles(c, db)
	if err != nil {
		httperror.InternalServerError(c, "Error loading roles", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"roles": roles, "permissions": permissions.Definitions()})
}

func CreateRole(c *gin.Context, db *bun.DB) {
	var request roleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httperror.StatusBadRequest(c, "Invalid role", err)
		return
	}
	request.Key = permissions.NormalizeRole(request.Key)
	request.Name = strings.TrimSpace(request.Name)
	request.Description = strings.TrimSpace(request.Description)
	if !roleKeyPattern.MatchString(request.Key) || request.Name == "" || !validPermissionValues(request.Permissions) {
		httperror.StatusBadRequest(c, "Invalid role data", errors.New("invalid key, name, or permissions"))
		return
	}
	role := models.Role{Key: request.Key, Name: request.Name, Description: request.Description, Permissions: request.Permissions, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(&role).Column("key", "name", "description", "is_system", "created_at", "updated_at").Exec(ctx); err != nil {
			return err
		}
		for _, permission := range request.Permissions {
			if _, err := tx.NewInsert().Model(&models.RolePermission{RoleKey: role.Key, Permission: permission}).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		httperror.StatusConflict(c, "Role already exists or could not be created", err)
		return
	}
	permissions.SetRole(role.Key, request.Permissions)
	actorID, _ := c.Get("user_id")
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(actorID, "unknown"), "role.create", fmt.Sprintf("created role %s", role.Key))
	c.JSON(http.StatusCreated, role)
}

func UpdateRole(c *gin.Context, db *bun.DB) {
	key := permissions.NormalizeRole(c.Param("roleKey"))
	var role models.Role
	if err := db.NewSelect().Model(&role).Where("key = ?", key).Scan(c); err != nil {
		httperror.StatusNotFound(c, "Role not found", err)
		return
	}
	var request roleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httperror.StatusBadRequest(c, "Invalid role", err)
		return
	}
	request.Name = strings.TrimSpace(request.Name)
	request.Description = strings.TrimSpace(request.Description)
	if request.Name == "" || !validPermissionValues(request.Permissions) {
		httperror.StatusBadRequest(c, "Invalid role data", errors.New("invalid name or permissions"))
		return
	}
	if key == permissions.RoleAdmin || key == permissions.RoleUser {
		httperror.Forbidden(c, "This system role cannot be changed", errors.New("protected system role"))
		return
	}
	role.Name = request.Name
	role.Description = request.Description
	role.UpdatedAt = time.Now()
	err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewUpdate().Model(&role).Column("name", "description", "updated_at").WherePK().Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Model((*models.RolePermission)(nil)).Where("role_key = ?", key).Exec(ctx); err != nil {
			return err
		}
		for _, permission := range request.Permissions {
			if _, err := tx.NewInsert().Model(&models.RolePermission{RoleKey: key, Permission: permission}).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		httperror.InternalServerError(c, "Error updating role", err)
		return
	}
	permissions.SetRole(key, request.Permissions)
	actorID, _ := c.Get("user_id")
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(actorID, "unknown"), "role.update", fmt.Sprintf("updated role %s", key))
	c.JSON(http.StatusOK, role)
}

func DeleteRole(c *gin.Context, db *bun.DB) {
	key := permissions.NormalizeRole(c.Param("roleKey"))
	var role models.Role
	if err := db.NewSelect().Model(&role).Where("key = ?", key).Scan(c); err != nil {
		httperror.StatusNotFound(c, "Role not found", err)
		return
	}
	if role.IsSystem {
		httperror.Forbidden(c, "System roles cannot be deleted", errors.New("protected system role"))
		return
	}
	count, err := db.NewSelect().Model((*models.Users)(nil)).Where("role = ?", key).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "Error checking role assignments", err)
		return
	}
	if count > 0 {
		httperror.StatusConflict(c, "Assign affected users to another role first", errors.New("role is still assigned"))
		return
	}
	if _, err := db.NewDelete().Model(&role).WherePK().Exec(c); err != nil {
		httperror.InternalServerError(c, "Error deleting role", err)
		return
	}
	permissions.RemoveRole(key)
	actorID, _ := c.Get("user_id")
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(actorID, "unknown"), "role.delete", fmt.Sprintf("deleted role %s", key))
	c.Status(http.StatusNoContent)
}
