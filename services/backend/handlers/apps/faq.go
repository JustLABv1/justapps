package apps

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

const (
	maxFAQQuestionLength = 1000
	maxFAQAnswerLength   = 5000
	defaultFAQPageSize   = 20
	maxFAQPageSize       = 50
)

type faqQuestionRow struct {
	ID          uuid.UUID `bun:"id"`
	AppID       string    `bun:"app_id"`
	UserID      uuid.UUID `bun:"user_id"`
	Username    string    `bun:"username"`
	Question    string    `bun:"question"`
	CreatedAt   time.Time `bun:"created_at"`
	AnswerCount int       `bun:"answer_count"`
}

type faqAnswerRow struct {
	ID           uuid.UUID `bun:"id"`
	QuestionID   uuid.UUID `bun:"question_id"`
	AppID        string    `bun:"app_id"`
	UserID       uuid.UUID `bun:"user_id"`
	Username     string    `bun:"username"`
	Answer       string    `bun:"answer"`
	IsPinned     bool      `bun:"is_pinned"`
	CreatorLiked bool      `bun:"creator_liked"`
	CreatedAt    time.Time `bun:"created_at"`
	UpvoteCount  int       `bun:"upvote_count"`
	UserUpvoted  bool      `bun:"user_upvoted"`
}

type faqQuestionRequest struct {
	Question string `json:"question"`
}

type faqAnswerRequest struct {
	Answer string `json:"answer"`
}

type faqAnswerHighlightsRequest struct {
	IsPinned     *bool `json:"isPinned"`
	CreatorLiked *bool `json:"creatorLiked"`
}

func parseFAQPagination(c *gin.Context) (int, int, bool) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		httperror.StatusBadRequest(c, "Invalid FAQ page", errors.New("page must be a positive integer"))
		return 0, 0, false
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("pageSize", strconv.Itoa(defaultFAQPageSize)))
	if err != nil || pageSize < 1 || pageSize > maxFAQPageSize {
		httperror.StatusBadRequest(c, "Invalid FAQ page size", fmt.Errorf("pageSize must be between 1 and %d", maxFAQPageSize))
		return 0, 0, false
	}
	return page, pageSize, true
}

func applyFAQQuestionFilters(query *bun.SelectQuery, c *gin.Context, answerTable string) (*bun.SelectQuery, bool) {
	search := strings.TrimSpace(c.Query("q"))
	if search != "" {
		pattern := "%" + search + "%"
		query = query.WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.WhereOr("q.question ILIKE ?", pattern).
				WhereOr("q.username ILIKE ?", pattern).
				WhereOr(fmt.Sprintf("EXISTS (SELECT 1 FROM %s search_answer WHERE search_answer.question_id = q.id AND (search_answer.answer ILIKE ? OR search_answer.username ILIKE ?))", answerTable), pattern, pattern)
		})
	}

	switch c.Query("status") {
	case "", "all":
	case "open":
		query = query.Where(fmt.Sprintf("NOT EXISTS (SELECT 1 FROM %s status_answer WHERE status_answer.question_id = q.id)", answerTable))
	case "answered":
		query = query.Where(fmt.Sprintf("EXISTS (SELECT 1 FROM %s status_answer WHERE status_answer.question_id = q.id)", answerTable))
	default:
		httperror.StatusBadRequest(c, "Invalid FAQ status", errors.New("status must be all, open, or answered"))
		return nil, false
	}

	return query, true
}

func applyFAQQuestionOrder(query *bun.SelectQuery, sort string) *bun.SelectQuery {
	if sort == "most-answered" {
		return query.OrderExpr("answer_count DESC").OrderExpr("q.created_at DESC").OrderExpr("q.id DESC")
	}
	return query.OrderExpr("q.created_at DESC").OrderExpr("q.id DESC")
}

// ensureFAQEnabled keeps the feature disabled server-side even if a client
// calls the endpoint directly while the tab is hidden in the frontend.
func ensureFAQEnabled(c *gin.Context, db *bun.DB) bool {
	var settings models.PlatformSettings
	err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c.Request.Context())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// The setting defaults to enabled on fresh or partially migrated installs.
			return true
		}
		httperror.InternalServerError(c, "Failed to load FAQ settings", err)
		return false
	}

	if !settings.FAQEnabled {
		httperror.StatusNotFound(c, "FAQ is disabled", errors.New("FAQ feature is disabled"))
		return false
	}

	return true
}

func loadVisibleFAQApp(c *gin.Context, db *bun.DB, appID string) (models.Apps, bool) {
	if !ensureFAQEnabled(c, db) || !ensureAppStoreAccess(c, db) {
		return models.Apps{}, false
	}

	var app models.Apps
	err := db.NewSelect().Model(&app).Where("a.id = ?", appID).Relation("Owner").Scan(c.Request.Context())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "App not found", err)
		} else {
			httperror.InternalServerError(c, "Failed to load app for FAQ", err)
		}
		return models.Apps{}, false
	}

	viewerID, viewerRole, hasViewer := getViewerContext(c)
	editorAppIDs := map[string]struct{}{}
	if hasViewer {
		var editorErr error
		editorAppIDs, editorErr = loadEditorAppIDs(c.Request.Context(), db, viewerID)
		if editorErr != nil {
			httperror.InternalServerError(c, "Failed to load app permissions for FAQ", editorErr)
			return models.Apps{}, false
		}
	}
	if !canViewApp(app, viewerID, viewerRole, hasViewer, editorAppIDs) {
		httperror.StatusNotFound(c, "App not found", nil)
		return models.Apps{}, false
	}

	return app, true
}

func parseFAQUUID(c *gin.Context, parameter, label string) (uuid.UUID, bool) {
	parsed, err := uuid.Parse(c.Param(parameter))
	if err != nil || parsed == uuid.Nil {
		httperror.StatusBadRequest(c, fmt.Sprintf("Invalid %s", label), errors.New("invalid UUID"))
		return uuid.Nil, false
	}
	return parsed, true
}

func faqUserCanManageApp(app models.Apps, userID uuid.UUID, role string) bool {
	return role == "admin" || (userID != uuid.Nil && app.OwnerID == userID)
}

func faqQuestionResponse(row faqQuestionRow) models.FAQQuestion {
	return models.FAQQuestion{
		ID:          row.ID,
		AppID:       row.AppID,
		UserID:      row.UserID,
		Username:    row.Username,
		Question:    row.Question,
		CreatedAt:   row.CreatedAt,
		AnswerCount: row.AnswerCount,
		Answers:     make([]models.FAQAnswer, 0),
	}
}

// GetFAQ returns a filtered page of questions. Answers are loaded lazily through
// GetFAQAnswers when a question is opened.
func GetFAQ(c *gin.Context, db *bun.DB) {
	appID := c.Param("id")
	if _, ok := loadVisibleFAQApp(c, db, appID); !ok {
		return
	}

	page, pageSize, ok := parseFAQPagination(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	questionRows := make([]faqQuestionRow, 0)
	query := db.NewSelect().TableExpr("faq_questions AS q").
		ColumnExpr("q.id, q.app_id, q.user_id, q.username, q.question, q.created_at").
		ColumnExpr("(SELECT COUNT(*) FROM faq_answers answer WHERE answer.question_id = q.id)::int AS answer_count").
		Where("q.app_id = ?", appID)
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
	query, ok = applyFAQQuestionFilters(query, c, "faq_answers")
	if !ok {
		return
	}
	total, err := query.Clone().Count(ctx)
	if err == nil {
		err = applyFAQQuestionOrder(query, c.Query("sort")).Limit(pageSize).Offset((page-1)*pageSize).Scan(ctx, &questionRows)
	}
	if err != nil {
		httperror.InternalServerError(c, "Failed to load FAQ questions", err)
		return
	}

	questions := make([]models.FAQQuestion, 0, len(questionRows))
	for _, row := range questionRows {
		questions = append(questions, faqQuestionResponse(row))
	}
	c.JSON(http.StatusOK, gin.H{"questions": questions, "page": page, "pageSize": pageSize, "total": total, "hasMore": page*pageSize < total})
}

func GetFAQAnswers(c *gin.Context, db *bun.DB) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
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
	viewerID, _, _ := getViewerContext(c)
	rows := make([]faqAnswerRow, 0)
	query := db.NewSelect().TableExpr("faq_answers AS a").
		ColumnExpr("a.id, a.question_id, a.app_id, a.user_id, a.username, a.answer, a.is_pinned, a.creator_liked, a.created_at").
		ColumnExpr("COUNT(v.user_id)::int AS upvote_count").
		ColumnExpr("COALESCE(BOOL_OR(v.user_id = ?), FALSE) AS user_upvoted", viewerID).
		Join("LEFT JOIN faq_answer_upvotes AS v ON v.answer_id = a.id").
		Where("a.question_id = ? AND a.app_id = ?", questionID, app.ID).
		GroupExpr("a.id, a.question_id, a.app_id, a.user_id, a.username, a.answer, a.is_pinned, a.creator_liked, a.created_at")
	total, err := db.NewSelect().TableExpr("faq_answers AS a").Where("a.question_id = ? AND a.app_id = ?", questionID, app.ID).Count(c)
	if err == nil {
		err = query.OrderExpr("a.is_pinned DESC, a.creator_liked DESC, COUNT(v.user_id) DESC, a.created_at ASC, a.id ASC").Limit(pageSize).Offset((page-1)*pageSize).Scan(c, &rows)
	}
	if err != nil {
		httperror.InternalServerError(c, "Failed to load FAQ answers", err)
		return
	}
	answers := make([]models.FAQAnswer, 0, len(rows))
	for _, row := range rows {
		answers = append(answers, models.FAQAnswer{ID: row.ID, QuestionID: row.QuestionID, AppID: row.AppID, UserID: row.UserID, Username: row.Username, Answer: row.Answer, IsPinned: row.IsPinned, CreatorLiked: row.CreatorLiked, CreatedAt: row.CreatedAt, UpvoteCount: row.UpvoteCount, UserUpvoted: row.UserUpvoted})
	}
	c.JSON(http.StatusOK, gin.H{"answers": answers, "page": page, "pageSize": pageSize, "total": total, "hasMore": page*pageSize < total})
}

func CreateFAQQuestion(c *gin.Context, db *bun.DB) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
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
	questionText := strings.TrimSpace(request.Question)
	if questionText == "" {
		httperror.StatusBadRequest(c, "Question cannot be empty", errors.New("question is empty"))
		return
	}
	if len([]rune(questionText)) > maxFAQQuestionLength {
		httperror.StatusBadRequest(c, "Question is too long", errors.New("question exceeds maximum length"))
		return
	}

	question := &models.FAQQuestion{
		AppID:    app.ID,
		UserID:   userID,
		Username: strings.TrimSpace(c.GetString("username")),
		Question: questionText,
	}
	if err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(question).Exec(ctx); err != nil {
			return err
		}
		return createFAQQuestionNotifications(ctx, tx, *question)
	}); err != nil {
		httperror.InternalServerError(c, "Failed to create FAQ question", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.faq.question.create", fmt.Sprintf("created FAQ question for app %s", app.ID))
	c.JSON(http.StatusCreated, question)
}

func createFAQQuestionNotifications(ctx context.Context, tx bun.Tx, question models.FAQQuestion) error {
	type recipientRow struct {
		UserID uuid.UUID `bun:"user_id"`
	}

	var recipients []recipientRow
	if err := tx.NewRaw(`
		SELECT candidate.user_id
		FROM (
			SELECT owner_id AS user_id
			FROM apps
			WHERE id = ? AND owner_id IS NOT NULL
			UNION
			SELECT user_id
			FROM app_editors
			WHERE app_id = ?
		) AS candidate
		JOIN users AS recipient ON recipient.id = candidate.user_id
		WHERE candidate.user_id <> ?
		  AND recipient.disabled = FALSE
	`, question.AppID, question.AppID, question.UserID).Scan(ctx, &recipients); err != nil {
		return err
	}

	if len(recipients) == 0 {
		return nil
	}

	now := time.Now().UTC()
	items := make([]models.UserFAQInboxItem, 0, len(recipients))
	for _, recipient := range recipients {
		items = append(items, models.UserFAQInboxItem{
			UserID:     recipient.UserID,
			QuestionID: question.ID,
			AppID:      question.AppID,
			CreatedAt:  now,
		})
	}

	_, err := tx.NewInsert().Model(&items).On("CONFLICT (user_id, question_id) DO NOTHING").Exec(ctx)
	return err
}

func CreateFAQAnswer(c *gin.Context, db *bun.DB) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
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
	answerText := strings.TrimSpace(request.Answer)
	if answerText == "" {
		httperror.StatusBadRequest(c, "Answer cannot be empty", errors.New("answer is empty"))
		return
	}
	if len([]rune(answerText)) > maxFAQAnswerLength {
		httperror.StatusBadRequest(c, "Answer is too long", errors.New("answer exceeds maximum length"))
		return
	}

	var question models.FAQQuestion
	if err := db.NewSelect().Model(&question).
		Where("id = ? AND app_id = ?", questionID, app.ID).
		Scan(c); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httperror.StatusNotFound(c, "Question not found", errors.New("FAQ question not found"))
			return
		}
		httperror.InternalServerError(c, "Failed to check FAQ question", err)
		return
	}

	answer := &models.FAQAnswer{
		QuestionID: questionID,
		AppID:      app.ID,
		UserID:     userID,
		Username:   strings.TrimSpace(c.GetString("username")),
		Answer:     answerText,
	}
	if err := db.RunInTx(c.Request.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(answer).Exec(ctx); err != nil {
			return err
		}
		notification := newAppFAQAnswerNotification(question, *answer)
		if notification == nil {
			return nil
		}
		_, err := tx.NewInsert().Model(notification).On("CONFLICT DO NOTHING").Exec(ctx)
		return err
	}); err != nil {
		httperror.InternalServerError(c, "Failed to create FAQ answer", err)
		return
	}

	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.faq.answer.create", fmt.Sprintf("created FAQ answer for app %s", app.ID))
	c.JSON(http.StatusCreated, answer)
}

func DeleteFAQQuestion(c *gin.Context, db *bun.DB) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
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

	var question models.FAQQuestion
	if err := db.NewSelect().Model(&question).Where("id = ? AND app_id = ?", questionID, app.ID).Scan(c); err != nil {
		httperror.StatusNotFound(c, "Question not found", err)
		return
	}
	if question.UserID != userID && !faqUserCanManageApp(app, userID, role) {
		httperror.Forbidden(c, "You are not allowed to delete this question", errors.New("FAQ question ownership required"))
		return
	}

	if _, err := db.NewDelete().Model((*models.FAQQuestion)(nil)).Where("id = ? AND app_id = ?", questionID, app.ID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to delete FAQ question", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.faq.question.delete", fmt.Sprintf("deleted FAQ question %s for app %s", questionID, app.ID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func DeleteFAQAnswer(c *gin.Context, db *bun.DB) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
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

	var answer models.FAQAnswer
	if err := db.NewSelect().Model(&answer).
		Where("id = ? AND app_id = ? AND question_id = ?", answerID, app.ID, questionID).
		Scan(c); err != nil {
		httperror.StatusNotFound(c, "Answer not found", err)
		return
	}
	if answer.UserID != userID && !faqUserCanManageApp(app, userID, role) {
		httperror.Forbidden(c, "You are not allowed to delete this answer", errors.New("FAQ answer ownership required"))
		return
	}

	if _, err := db.NewDelete().Model((*models.FAQAnswer)(nil)).
		Where("id = ? AND app_id = ? AND question_id = ?", answerID, app.ID, questionID).
		Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to delete FAQ answer", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.faq.answer.delete", fmt.Sprintf("deleted FAQ answer %s for app %s", answerID, app.ID))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func setFAQAnswerUpvote(c *gin.Context, db *bun.DB, upvoted bool) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
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

	answerExists, err := db.NewSelect().Model((*models.FAQAnswer)(nil)).
		Where("id = ? AND app_id = ?", answerID, app.ID).
		Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to check FAQ answer", err)
		return
	}
	if !answerExists {
		httperror.StatusNotFound(c, "Answer not found", errors.New("FAQ answer not found"))
		return
	}

	if upvoted {
		vote := &models.FAQAnswerUpvote{AnswerID: answerID, UserID: userID}
		if _, err := db.NewInsert().Model(vote).On("CONFLICT DO NOTHING").Exec(c); err != nil {
			httperror.InternalServerError(c, "Failed to upvote FAQ answer", err)
			return
		}
	} else if _, err := db.NewDelete().Model((*models.FAQAnswerUpvote)(nil)).
		Where("answer_id = ? AND user_id = ?", answerID, userID).
		Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to remove FAQ upvote", err)
		return
	}

	upvoteCount, err := db.NewSelect().Model((*models.FAQAnswerUpvote)(nil)).
		Where("answer_id = ?", answerID).
		Count(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to count FAQ upvotes", err)
		return
	}

	operation := "app.faq.answer.upvote.remove"
	if upvoted {
		operation = "app.faq.answer.upvote.add"
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), operation, fmt.Sprintf("changed FAQ upvote for answer %s in app %s", answerID, app.ID))
	c.JSON(http.StatusOK, gin.H{"ok": true, "upvoted": upvoted, "upvoteCount": upvoteCount})
}

func UpvoteFAQAnswer(c *gin.Context, db *bun.DB) {
	setFAQAnswerUpvote(c, db, true)
}

func RemoveFAQAnswerUpvote(c *gin.Context, db *bun.DB) {
	setFAQAnswerUpvote(c, db, false)
}

// UpdateFAQAnswerHighlights lets the app owner or an admin control the two
// prominent answer signals. Both fields are optional so pin and like can be
// changed independently in one endpoint.
func UpdateFAQAnswerHighlights(c *gin.Context, db *bun.DB) {
	app, ok := loadVisibleFAQApp(c, db, c.Param("id"))
	if !ok {
		return
	}
	userID, role, ok := getRequiredViewerContext(c)
	if !ok {
		return
	}
	if !faqUserCanManageApp(app, userID, role) {
		httperror.Forbidden(c, "Only the app creator or an admin can promote FAQ answers", errors.New("FAQ moderation permission required"))
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

	answerExists, err := db.NewSelect().Model((*models.FAQAnswer)(nil)).
		Where("id = ? AND app_id = ?", answerID, app.ID).
		Exists(c)
	if err != nil {
		httperror.InternalServerError(c, "Failed to check FAQ answer", err)
		return
	}
	if !answerExists {
		httperror.StatusNotFound(c, "Answer not found", errors.New("FAQ answer not found"))
		return
	}

	update := db.NewUpdate().Model((*models.FAQAnswer)(nil))
	if request.IsPinned != nil {
		update = update.Set("is_pinned = ?", *request.IsPinned)
	}
	if request.CreatorLiked != nil {
		update = update.Set("creator_liked = ?", *request.CreatorLiked)
	}
	if _, err := update.Where("id = ? AND app_id = ?", answerID, app.ID).Exec(c); err != nil {
		httperror.InternalServerError(c, "Failed to update FAQ answer highlights", err)
		return
	}

	var answer models.FAQAnswer
	if err := db.NewSelect().Model(&answer).Where("id = ?", answerID).Scan(c); err != nil {
		httperror.InternalServerError(c, "Failed to load updated FAQ answer", err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, audit.ActorID(userID, "unknown"), "app.faq.answer.highlight.update", fmt.Sprintf("updated FAQ highlights for answer %s in app %s", answerID, app.ID))
	c.JSON(http.StatusOK, gin.H{
		"ok":           true,
		"isPinned":     answer.IsPinned,
		"creatorLiked": answer.CreatorLiked,
	})
}
