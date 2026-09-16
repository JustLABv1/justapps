package apps

import (
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"net/http"
)

// SetFAQAnswerAcceptance only allows the question author to mark an answer as helpful to their question.
// Editorial highlights have separate endpoints and permissions.
func SetFAQAnswerAcceptance(c *gin.Context, db *bun.DB, global bool) {
	if global {
		if !ensureFAQEnabled(c, db) || !ensureAppStoreAccess(c, db) {
			return
		}
	} else if _, ok := loadVisibleFAQApp(c, db, c.Param("id")); !ok {
		return
	}
	userID, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	answerID, ok := parseFAQUUID(c, "answerId", "answer ID")
	if !ok {
		return
	}
	var request struct {
		Accepted *bool `json:"acceptedByAuthor"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || request.Accepted == nil {
		httperror.StatusBadRequest(c, "acceptedByAuthor is required", errors.New("boolean acceptedByAuthor required"))
		return
	}
	answers, questions := "faq_answers", "faq_questions"
	if global {
		answers, questions = "global_faq_answers", "global_faq_questions"
	}
	query := db.NewUpdate().TableExpr(answers+" AS answer").Set("accepted_by_author = ?", *request.Accepted).
		Where("answer.id = ?", answerID).
		Where(fmt.Sprintf("EXISTS (SELECT 1 FROM %s question WHERE question.id = answer.question_id AND question.user_id = ?)", questions), userID)
	if !global {
		query = query.Where("answer.app_id = ?", c.Param("id"))
	}
	result, err := query.Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to update answer acceptance", err)
		return
	}
	affected, err := result.RowsAffected()
	if err != nil {
		httperror.InternalServerError(c, "Failed to check answer acceptance", err)
		return
	}
	if affected == 0 {
		httperror.Forbidden(c, "Only the question author can mark this answer", errors.New("question author permission required"))
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "faq.answer.acceptance.update", fmt.Sprintf("updated answer %s acceptance to %t", answerID, *request.Accepted))
	c.JSON(http.StatusOK, gin.H{"acceptedByAuthor": *request.Accepted})
}
