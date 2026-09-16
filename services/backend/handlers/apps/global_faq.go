package apps

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type globalFAQQuestionRow struct {
	ID          uuid.UUID `bun:"id"`
	UserID      uuid.UUID `bun:"user_id"`
	Username    string    `bun:"username"`
	Question    string    `bun:"question"`
	CreatedAt   time.Time `bun:"created_at"`
	AnswerCount int       `bun:"answer_count"`
}

type globalFAQAnswerRow struct {
	ID           uuid.UUID `bun:"id"`
	QuestionID   uuid.UUID `bun:"question_id"`
	UserID       uuid.UUID `bun:"user_id"`
	Username     string    `bun:"username"`
	Answer       string    `bun:"answer"`
	IsPinned     bool      `bun:"is_pinned"`
	CreatorLiked bool      `bun:"creator_liked"`
	CreatedAt    time.Time `bun:"created_at"`
	UpvoteCount  int       `bun:"upvote_count"`
	UserUpvoted  bool      `bun:"user_upvoted"`
}

func GetGlobalFAQ(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) || !ensureAppStoreAccess(c, db) {
		return
	}
	page, pageSize, ok := parseFAQPagination(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	questions := make([]globalFAQQuestionRow, 0)
	query := db.NewSelect().TableExpr("global_faq_questions AS q").
		ColumnExpr("q.id, q.user_id, q.username, q.question, q.created_at").
		ColumnExpr("(SELECT COUNT(*) FROM global_faq_answers answer WHERE answer.question_id = q.id)::int AS answer_count")
	if owner := strings.TrimSpace(c.Query("owner")); owner != "" {
		if owner != "me" {
			httperror.StatusBadRequest(c, "Invalid FAQ owner", errors.New("owner must be me"))
			return
		}
		userID, _, authenticated := getRequiredViewerContext(c)
		if !authenticated {
			return
		}
		query = query.Where("q.user_id = ?", userID)
	}
	query, ok = applyFAQQuestionFilters(query, c, "global_faq_answers")
	if !ok {
		return
	}
	total, err := query.Clone().Count(ctx)
	if err == nil {
		err = applyFAQQuestionOrder(query, c.Query("sort")).Limit(pageSize).Offset((page-1)*pageSize).Scan(ctx, &questions)
	}
	if err != nil {
		httperror.InternalServerError(c, "Failed to load global FAQ questions", err)
		return
	}

	result := make([]models.GlobalFAQQuestion, 0, len(questions))
	for _, row := range questions {
		result = append(result, models.GlobalFAQQuestion{ID: row.ID, UserID: row.UserID, Username: row.Username, Question: row.Question, CreatedAt: row.CreatedAt, AnswerCount: row.AnswerCount, Answers: []models.GlobalFAQAnswer{}})
	}
	c.JSON(http.StatusOK, gin.H{"questions": result, "page": page, "pageSize": pageSize, "total": total, "hasMore": page*pageSize < total})
}

func GetGlobalFAQAnswers(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) || !ensureAppStoreAccess(c, db) {
		return
	}
	questionID, ok := parseFAQUUID(c, "questionId", "question ID")
	if !ok {
		return
	}
	page, pageSize, ok := parseFAQPagination(c)
	if !ok {
		return
	}
	exists, err := db.NewSelect().Model((*models.GlobalFAQQuestion)(nil)).Where("id = ?", questionID).Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to check global FAQ question", err)
		return
	}
	if !exists {
		httperror.StatusNotFound(c, "Question not found", errors.New("global FAQ question not found"))
		return
	}
	viewerID, _, _ := getViewerContext(c)
	rows := make([]globalFAQAnswerRow, 0)
	query := db.NewSelect().TableExpr("global_faq_answers AS a").
		ColumnExpr("a.id, a.question_id, a.user_id, a.username, a.answer, a.is_pinned, a.creator_liked, a.created_at").
		ColumnExpr("COUNT(v.user_id)::int AS upvote_count").
		ColumnExpr("COALESCE(BOOL_OR(v.user_id = ?), FALSE) AS user_upvoted", viewerID).
		Join("LEFT JOIN global_faq_answer_upvotes AS v ON v.answer_id = a.id").
		Where("a.question_id = ?", questionID).
		GroupExpr("a.id, a.question_id, a.user_id, a.username, a.answer, a.is_pinned, a.creator_liked, a.created_at")
	total, err := db.NewSelect().TableExpr("global_faq_answers AS a").Where("a.question_id = ?", questionID).Count(c)
	if err == nil {
		err = query.OrderExpr("a.is_pinned DESC, a.creator_liked DESC, COUNT(v.user_id) DESC, a.created_at ASC, a.id ASC").Limit(pageSize).Offset((page-1)*pageSize).Scan(c, &rows)
	}
	if err != nil {
		httperror.InternalServerError(c, "Failed to load global FAQ answers", err)
		return
	}
	answers := make([]models.GlobalFAQAnswer, 0, len(rows))
	for _, row := range rows {
		answers = append(answers, models.GlobalFAQAnswer{ID: row.ID, QuestionID: row.QuestionID, UserID: row.UserID, Username: row.Username, Answer: row.Answer, IsPinned: row.IsPinned, CreatorLiked: row.CreatorLiked, CreatedAt: row.CreatedAt, UpvoteCount: row.UpvoteCount, UserUpvoted: row.UserUpvoted})
	}
	c.JSON(http.StatusOK, gin.H{"answers": answers, "page": page, "pageSize": pageSize, "total": total, "hasMore": page*pageSize < total})
}

func CreateGlobalFAQQuestion(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) {
		return
	}
	userID, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	var request faqQuestionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httperror.StatusBadRequest(c, "Invalid question", err)
		return
	}
	text := strings.TrimSpace(request.Question)
	if text == "" {
		httperror.StatusBadRequest(c, "Question cannot be empty", errors.New("question is empty"))
		return
	}
	if len([]rune(text)) > maxFAQQuestionLength {
		httperror.StatusBadRequest(c, "Question is too long", errors.New("question exceeds maximum length"))
		return
	}
	question := &models.GlobalFAQQuestion{UserID: userID, Username: strings.TrimSpace(c.GetString("username")), Question: text}
	if _, err := db.NewInsert().Model(question).Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to create global FAQ question", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "global.faq.question.create", "created global FAQ question")
	c.JSON(http.StatusCreated, question)
}

func CreateGlobalFAQAnswer(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) {
		return
	}
	userID, _, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	questionID, ok := parseFAQUUID(c, "questionId", "question ID")
	if !ok {
		return
	}
	var request faqAnswerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httperror.StatusBadRequest(c, "Invalid answer", err)
		return
	}
	text := strings.TrimSpace(request.Answer)
	if text == "" {
		httperror.StatusBadRequest(c, "Answer cannot be empty", errors.New("answer is empty"))
		return
	}
	if len([]rune(text)) > maxFAQAnswerLength {
		httperror.StatusBadRequest(c, "Answer is too long", errors.New("answer exceeds maximum length"))
		return
	}
	var question models.GlobalFAQQuestion
	if err := db.NewSelect().Model(&question).Where("id = ?", questionID).Scan(c); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Question not found", errors.New("global FAQ question not found"))
			return
		}
		httperror.InternalServerError(c, "Failed to check global FAQ question", err)
		return
	}
	answer := &models.GlobalFAQAnswer{QuestionID: questionID, UserID: userID, Username: strings.TrimSpace(c.GetString("username")), Answer: text}
	if err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(answer).Exec(ctx); err != nil {
			return err
		}
		notification := newGlobalFAQAnswerNotification(question, *answer)
		if notification == nil {
			return nil
		}
		_, err := tx.NewInsert().Model(notification).On("CONFLICT DO NOTHING").Exec(ctx)
		return err
	}); err != nil {
		httperror.InternalServerError(c, "Failed to create global FAQ answer", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "global.faq.answer.create", fmt.Sprintf("created answer for global FAQ question %s", questionID))
	c.JSON(http.StatusCreated, answer)
}

func DeleteGlobalFAQQuestion(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) {
		return
	}
	userID, role, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	questionID, ok := parseFAQUUID(c, "questionId", "question ID")
	if !ok {
		return
	}
	var question models.GlobalFAQQuestion
	if err := db.NewSelect().Model(&question).Where("id = ?", questionID).Scan(c); err != nil {
		httperror.StatusNotFound(c, "Question not found", err)
		return
	}
	if question.UserID != userID && role != "admin" {
		httperror.Forbidden(c, "You are not allowed to delete this question", errors.New("global FAQ question ownership required"))
		return
	}
	if _, err := db.NewDelete().Model((*models.GlobalFAQQuestion)(nil)).Where("id = ?", questionID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to delete global FAQ question", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "global.faq.question.delete", fmt.Sprintf("deleted global FAQ question %s", questionID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func DeleteGlobalFAQAnswer(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) {
		return
	}
	userID, role, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	questionID, ok := parseFAQUUID(c, "questionId", "question ID")
	if !ok {
		return
	}
	answerID, ok := parseFAQUUID(c, "answerId", "answer ID")
	if !ok {
		return
	}
	var answer models.GlobalFAQAnswer
	if err := db.NewSelect().Model(&answer).Where("id = ? AND question_id = ?", answerID, questionID).Scan(c); err != nil {
		httperror.StatusNotFound(c, "Answer not found", err)
		return
	}
	if answer.UserID != userID && role != "admin" {
		httperror.Forbidden(c, "You are not allowed to delete this answer", errors.New("global FAQ answer ownership required"))
		return
	}
	if _, err := db.NewDelete().Model((*models.GlobalFAQAnswer)(nil)).Where("id = ? AND question_id = ?", answerID, questionID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to delete global FAQ answer", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "global.faq.answer.delete", fmt.Sprintf("deleted global FAQ answer %s", answerID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func SetGlobalFAQAnswerUpvote(c *gin.Context, db *bun.DB, upvoted bool) {
	if !ensureFAQEnabled(c, db) {
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
	exists, err := db.NewSelect().Model((*models.GlobalFAQAnswer)(nil)).Where("id = ?", answerID).Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to check global FAQ answer", err)
		return
	}
	if !exists {
		httperror.StatusNotFound(c, "Answer not found", errors.New("global FAQ answer not found"))
		return
	}
	if upvoted {
		_, err = db.NewInsert().Model(&models.GlobalFAQAnswerUpvote{AnswerID: answerID, UserID: userID}).On("CONFLICT DO NOTHING").Exec(c)
	} else {
		_, err = db.NewDelete().Model((*models.GlobalFAQAnswerUpvote)(nil)).Where("answer_id = ? AND user_id = ?", answerID, userID).Exec(c)
	}
	if err != nil {
		httperror.InternalServerError(c, "Failed to update global FAQ upvote", err)
		return
	}
	count, err := db.NewSelect().Model((*models.GlobalFAQAnswerUpvote)(nil)).Where("answer_id = ?", answerID).Count(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to count global FAQ upvotes", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "upvoted": upvoted, "upvoteCount": count})
}

func UpdateGlobalFAQAnswerHighlights(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) {
		return
	}
	userID, role, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	if role != "admin" {
		httperror.Forbidden(c, "Only an admin can promote global FAQ answers", errors.New("global FAQ moderation permission required"))
		return
	}
	answerID, ok := parseFAQUUID(c, "answerId", "answer ID")
	if !ok {
		return
	}
	var request faqAnswerHighlightsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httperror.StatusBadRequest(c, "Invalid FAQ highlight update", err)
		return
	}
	if request.IsPinned == nil && request.CreatorLiked == nil {
		httperror.StatusBadRequest(c, "No FAQ highlight change supplied", errors.New("at least one highlight field is required"))
		return
	}
	update := db.NewUpdate().Model((*models.GlobalFAQAnswer)(nil))
	if request.IsPinned != nil {
		update = update.Set("is_pinned = ?", *request.IsPinned)
	}
	if request.CreatorLiked != nil {
		update = update.Set("creator_liked = ?", *request.CreatorLiked)
	}
	result, err := update.Where("id = ?", answerID).Exec(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to update global FAQ answer highlights", err)
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		httperror.StatusNotFound(c, "Answer not found", errors.New("global FAQ answer not found"))
		return
	}
	var answer models.GlobalFAQAnswer
	if err := db.NewSelect().Model(&answer).Where("id = ?", answerID).Scan(c); err != nil {
		httperror.InternalServerError(c, "Failed to load updated global FAQ answer", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "global.faq.answer.highlight.update", fmt.Sprintf("updated global FAQ answer %s", answerID))
	c.JSON(http.StatusOK, gin.H{"ok": true, "isPinned": answer.IsPinned, "creatorLiked": answer.CreatorLiked})
}
