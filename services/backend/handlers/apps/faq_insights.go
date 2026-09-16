package apps

import (
	"net/http"
	"time"

	"justapps-backend/functions/httperror"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type faqInsightsSummary struct {
	TotalQuestions       int      `bun:"total_questions" json:"totalQuestions"`
	OpenQuestions        int      `bun:"open_questions" json:"openQuestions"`
	AnsweredQuestions    int      `bun:"answered_questions" json:"answeredQuestions"`
	QuestionsLast7Days   int      `bun:"questions_last_7_days" json:"questionsLast7Days"`
	QuestionsLast30Days  int      `bun:"questions_last_30_days" json:"questionsLast30Days"`
	AnswersLast7Days     int      `bun:"answers_last_7_days" json:"answersLast7Days"`
	AnswersLast30Days    int      `bun:"answers_last_30_days" json:"answersLast30Days"`
	MedianFirstAnswerSec *float64 `bun:"median_first_answer_seconds" json:"medianFirstAnswerSeconds"`
}

type faqInsightsOpenQuestion struct {
	ID        uuid.UUID `bun:"id" json:"id"`
	Scope     string    `bun:"scope" json:"scope"`
	AppID     *string   `bun:"app_id" json:"appId,omitempty"`
	AppName   string    `bun:"app_name" json:"appName,omitempty"`
	Question  string    `bun:"question" json:"question"`
	Username  string    `bun:"username" json:"username"`
	CreatedAt time.Time `bun:"created_at" json:"createdAt"`
}

const faqInsightsQuestionsCTE = `
	WITH faq_question_activity AS (
		SELECT q.id, 'global'::text AS scope, NULL::text AS app_id, ''::text AS app_name,
			q.question, q.username, q.created_at,
			(SELECT MIN(a.created_at) FROM global_faq_answers a WHERE a.question_id = q.id) AS first_answer_at
		FROM global_faq_questions q
		UNION ALL
		SELECT q.id, 'app'::text AS scope, q.app_id, app.name AS app_name,
			q.question, q.username, q.created_at,
			(SELECT MIN(a.created_at) FROM faq_answers a WHERE a.question_id = q.id) AS first_answer_at
		FROM faq_questions q
		JOIN apps app ON app.id = q.app_id
	)`

func GetFAQInsights(c *gin.Context, db *bun.DB) {
	var summary faqInsightsSummary
	summaryQuery := faqInsightsQuestionsCTE + `
		SELECT
			COUNT(*)::int AS total_questions,
			COUNT(*) FILTER (WHERE first_answer_at IS NULL)::int AS open_questions,
			COUNT(*) FILTER (WHERE first_answer_at IS NOT NULL)::int AS answered_questions,
			COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days')::int AS questions_last_7_days,
			COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')::int AS questions_last_30_days,
			(SELECT COUNT(*)::int FROM (
				SELECT created_at FROM global_faq_answers UNION ALL SELECT created_at FROM faq_answers
			) answers WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') AS answers_last_7_days,
			(SELECT COUNT(*)::int FROM (
				SELECT created_at FROM global_faq_answers UNION ALL SELECT created_at FROM faq_answers
			) answers WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS answers_last_30_days,
			EXTRACT(EPOCH FROM percentile_cont(0.5) WITHIN GROUP (ORDER BY first_answer_at - created_at)
				FILTER (WHERE first_answer_at IS NOT NULL))::float8 AS median_first_answer_seconds
		FROM faq_question_activity`
	if err := db.NewRaw(summaryQuery).Scan(c.Request.Context(), &summary); err != nil {
		httperror.InternalServerError(c, "FAQ-Insights konnten nicht geladen werden", err)
		return
	}

	oldestOpen := make([]faqInsightsOpenQuestion, 0)
	openQuery := faqInsightsQuestionsCTE + `
		SELECT id, scope, app_id, app_name, question, username, created_at
		FROM faq_question_activity
		WHERE first_answer_at IS NULL
		ORDER BY created_at ASC, id ASC
		LIMIT 5`
	if err := db.NewRaw(openQuery).Scan(c.Request.Context(), &oldestOpen); err != nil {
		httperror.InternalServerError(c, "Offene FAQ-Fragen konnten nicht geladen werden", err)
		return
	}

	answerRate := 0.0
	if summary.TotalQuestions > 0 {
		answerRate = float64(summary.AnsweredQuestions) / float64(summary.TotalQuestions) * 100
	}
	c.JSON(http.StatusOK, gin.H{
		"summary":     summary,
		"answerRate":  answerRate,
		"oldestOpen":  oldestOpen,
		"generatedAt": time.Now().UTC(),
	})
}
