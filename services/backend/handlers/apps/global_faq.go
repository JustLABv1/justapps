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
	"justapps-backend/pkg/permissions"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type globalFAQQuestionRow struct {
	ID          uuid.UUID `bun:"id"`
	Scope       string    `bun:"scope"`
	AppID       *string   `bun:"app_id"`
	AppName     *string   `bun:"app_name"`
	AppIcon     *string   `bun:"app_icon"`
	UserID      uuid.UUID `bun:"user_id"`
	Username    string    `bun:"username"`
	Question    string    `bun:"question"`
	CreatedAt   time.Time `bun:"created_at"`
	AnswerCount int       `bun:"answer_count"`
	Total       int       `bun:"total"`
}

type globalFAQAppOption struct {
	ID   string `bun:"id" json:"id"`
	Name string `bun:"name" json:"name"`
	Icon string `bun:"icon" json:"icon"`
}

type globalFAQAnswerRow struct {
	ID               uuid.UUID `bun:"id"`
	QuestionID       uuid.UUID `bun:"question_id"`
	UserID           uuid.UUID `bun:"user_id"`
	Username         string    `bun:"username"`
	Answer           string    `bun:"answer"`
	IsPinned         bool      `bun:"is_pinned"`
	CreatorLiked     bool      `bun:"creator_liked"`
	AcceptedByAuthor bool      `bun:"accepted_by_author"`
	CreatedAt        time.Time `bun:"created_at"`
	UpvoteCount      int       `bun:"upvote_count"`
	UserUpvoted      bool      `bun:"user_upvoted"`
}

func GetGlobalFAQ(c *gin.Context, db *bun.DB) {
	if !ensureFAQEnabled(c, db) || !ensureAppStoreAccess(c, db) {
		return
	}
	page, pageSize, ok := parseFAQPagination(c)
	if !ok {
		return
	}
	status := c.DefaultQuery("status", "all")
	if status != "all" && status != "open" && status != "answered" {
		httperror.StatusBadRequest(c, "Invalid FAQ status", errors.New("status must be all, open, or answered"))
		return
	}
	scope := c.DefaultQuery("scope", "all")
	if scope != "all" && scope != "global" && scope != "app" {
		httperror.StatusBadRequest(c, "Invalid FAQ scope", errors.New("scope must be all, global, or app"))
		return
	}
	appID := strings.TrimSpace(c.Query("appId"))
	search := strings.TrimSpace(c.Query("q"))
	owner := strings.TrimSpace(c.Query("owner"))
	viewerID, viewerRole, hasViewer := getViewerContext(c)
	canViewAppDrafts := permissions.Has(viewerRole, permissions.ViewAppDrafts)
	if owner != "" {
		if owner != "me" {
			httperror.StatusBadRequest(c, "Invalid FAQ owner", errors.New("owner must be me"))
			return
		}
		if !hasViewer {
			httperror.Unauthorized(c, "User ID not found", errors.New("unauthorized"))
			return
		}
	}
	pattern := "%" + search + "%"
	questions := make([]globalFAQQuestionRow, 0)
	err := db.NewRaw(`
		WITH combined AS (
			SELECT q.id, 'global'::text AS scope, NULL::text AS app_id, NULL::text AS app_name,
				NULL::text AS app_icon, q.user_id, q.username, q.question, q.created_at,
				(SELECT COUNT(*) FROM global_faq_answers answer WHERE answer.question_id = q.id)::int AS answer_count
			FROM global_faq_questions q
			WHERE (? = '' OR q.question ILIKE ? OR q.username ILIKE ? OR EXISTS (
				SELECT 1 FROM global_faq_answers answer WHERE answer.question_id = q.id AND (answer.answer ILIKE ? OR answer.username ILIKE ?)
			))
			UNION ALL
			SELECT q.id, 'app'::text AS scope, q.app_id, app.name AS app_name, app.icon AS app_icon,
				q.user_id, q.username, q.question, q.created_at,
				(SELECT COUNT(*) FROM faq_answers answer WHERE answer.question_id = q.id)::int AS answer_count
			FROM faq_questions q
			JOIN apps app ON app.id = q.app_id
			WHERE (? = '' OR q.question ILIKE ? OR q.username ILIKE ? OR EXISTS (
				SELECT 1 FROM faq_answers answer WHERE answer.question_id = q.id AND (answer.answer ILIKE ? OR answer.username ILIKE ?)
			))
			AND (LOWER(TRIM(COALESCE(app.status, ''))) NOT IN ('draft', 'entwurf')
				OR ? OR (? AND (app.owner_id = ? OR EXISTS (
					SELECT 1 FROM app_editors editor WHERE editor.app_id = app.id AND editor.user_id = ?
				))))
			AND (COALESCE(app.is_hidden, false) = false
				OR ? OR (? AND (app.owner_id = ? OR EXISTS (
					SELECT 1 FROM app_editors editor WHERE editor.app_id = app.id AND editor.user_id = ?
				))))
		)
		SELECT *, COUNT(*) OVER()::int AS total
		FROM combined
		WHERE (? = 'all' OR scope = ?)
			AND (? = '' OR app_id = ?)
			AND (? = '' OR user_id = ?)
			AND (? = 'all' OR (? = 'open' AND answer_count = 0) OR (? = 'answered' AND answer_count > 0))
		ORDER BY
			CASE WHEN ? = 'most-answered' THEN answer_count END DESC,
			created_at DESC, id DESC
		LIMIT ? OFFSET ?`,
		search, pattern, pattern, pattern, pattern,
		search, pattern, pattern, pattern, pattern,
		canViewAppDrafts, hasViewer, viewerID, viewerID,
		canViewAppDrafts, hasViewer, viewerID, viewerID,
		scope, scope, appID, appID, owner, viewerID,
		status, status, status, c.Query("sort"), pageSize, (page-1)*pageSize,
	).Scan(c.Request.Context(), &questions)
	if err != nil {
		httperror.InternalServerError(c, "Failed to load global FAQ questions", err)
		return
	}

	total := 0
	result := make([]gin.H, 0, len(questions))
	for _, row := range questions {
		total = row.Total
		result = append(result, gin.H{"id": row.ID, "scope": row.Scope, "appId": row.AppID, "appName": row.AppName, "appIcon": row.AppIcon, "userId": row.UserID, "username": row.Username, "question": row.Question, "createdAt": row.CreatedAt, "answerCount": row.AnswerCount, "answers": []models.GlobalFAQAnswer{}})
	}

	apps := make([]globalFAQAppOption, 0)
	err = db.NewRaw(`SELECT DISTINCT app.id, app.name, app.icon FROM apps app JOIN faq_questions q ON q.app_id = app.id
		WHERE (LOWER(TRIM(COALESCE(app.status, ''))) NOT IN ('draft', 'entwurf') OR ? OR (? AND (app.owner_id = ? OR EXISTS (
			SELECT 1 FROM app_editors editor WHERE editor.app_id = app.id AND editor.user_id = ?))))
		AND (COALESCE(app.is_hidden, false) = false OR ? OR (? AND (app.owner_id = ? OR EXISTS (
			SELECT 1 FROM app_editors editor WHERE editor.app_id = app.id AND editor.user_id = ?)))) ORDER BY app.name`,
		canViewAppDrafts, hasViewer, viewerID, viewerID,
		canViewAppDrafts, hasViewer, viewerID, viewerID).Scan(c.Request.Context(), &apps)
	if err != nil {
		httperror.InternalServerError(c, "Failed to load FAQ apps", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"questions": result, "apps": apps, "page": page, "pageSize": pageSize, "total": total, "hasMore": page*pageSize < total})
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
		ColumnExpr("a.id, a.question_id, a.user_id, a.username, a.answer, a.is_pinned, a.creator_liked, a.accepted_by_author, a.created_at").
		ColumnExpr("COUNT(v.user_id)::int AS upvote_count").
		ColumnExpr("COALESCE(BOOL_OR(v.user_id = ?), FALSE) AS user_upvoted", viewerID).
		Join("LEFT JOIN global_faq_answer_upvotes AS v ON v.answer_id = a.id").
		Where("a.question_id = ?", questionID).
		GroupExpr("a.id, a.question_id, a.user_id, a.username, a.answer, a.is_pinned, a.creator_liked, a.accepted_by_author, a.created_at")
	total, err := db.NewSelect().TableExpr("global_faq_answers AS a").Where("a.question_id = ?", questionID).Count(c)
	if err == nil {
		err = query.OrderExpr("a.is_pinned DESC, a.accepted_by_author DESC, a.creator_liked DESC, COUNT(v.user_id) DESC, a.created_at ASC, a.id ASC").Limit(pageSize).Offset((page-1)*pageSize).Scan(c, &rows)
	}
	if err != nil {
		httperror.InternalServerError(c, "Failed to load global FAQ answers", err)
		return
	}
	answers := make([]models.GlobalFAQAnswer, 0, len(rows))
	for _, row := range rows {
		answers = append(answers, models.GlobalFAQAnswer{ID: row.ID, QuestionID: row.QuestionID, UserID: row.UserID, Username: row.Username, Answer: row.Answer, IsPinned: row.IsPinned, CreatorLiked: row.CreatorLiked, AcceptedByAuthor: row.AcceptedByAuthor, CreatedAt: row.CreatedAt, UpvoteCount: row.UpvoteCount, UserUpvoted: row.UserUpvoted})
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
	if question.UserID != userID && !permissions.Has(role, permissions.DeleteFAQQuestions) {
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
	if answer.UserID != userID && !permissions.Has(role, permissions.DeleteFAQAnswers) {
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
	if request.IsPinned != nil && !permissions.Has(role, permissions.PinFAQAnswers) {
		httperror.Forbidden(c, "You are not allowed to pin FAQ answers", errors.New("FAQ pin permission required"))
		return
	}
	if request.CreatorLiked != nil && !permissions.Has(role, permissions.RecommendFAQAnswers) {
		httperror.Forbidden(c, "You are not allowed to recommend FAQ answers", errors.New("FAQ recommendation permission required"))
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
