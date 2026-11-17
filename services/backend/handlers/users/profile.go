package users

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

const maxDisplayNameLength = 80

// An avatar is a raster image from the upload endpoint. SVG is left out on
// purpose: it can carry script, and an avatar is shown to everyone.
var avatarURLPattern = regexp.MustCompile(`^/uploads/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$`)

// UpdateOwnProfile changes what others see of the signed-in user: the display
// name and the profile picture. Username, email and role are not touched here.
func UpdateOwnProfile(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}

	var req struct {
		DisplayName string `json:"displayName"`
		AvatarURL   string `json:"avatarUrl"`
	}
	if err := context.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(context, "Ungültige Profildaten", err)
		return
	}

	displayName := strings.Join(strings.Fields(req.DisplayName), " ")
	if utf8.RuneCountInString(displayName) > maxDisplayNameLength {
		httperror.StatusBadRequest(context, "Der Anzeigename darf höchstens 80 Zeichen lang sein", errors.New("display name too long"))
		return
	}
	avatarURL := strings.TrimSpace(req.AvatarURL)
	if avatarURL != "" && !avatarURLPattern.MatchString(avatarURL) {
		httperror.StatusBadRequest(context, "Das Profilbild muss ein hochgeladenes PNG-, JPEG- oder WebP-Bild sein", errors.New("invalid avatar url"))
		return
	}

	user := models.Users{DisplayName: displayName, AvatarURL: avatarURL, UpdatedAt: time.Now().UTC()}
	if _, err := db.NewUpdate().Model(&user).
		Column("display_name", "avatar_url", "updated_at").
		Where("id = ?", userID).
		Exec(context.Request.Context()); err != nil {
		httperror.InternalServerError(context, "Profil konnte nicht gespeichert werden", err)
		return
	}

	context.JSON(http.StatusOK, gin.H{"displayName": displayName, "avatarUrl": avatarURL})
}

type activityStats struct {
	Apps      int `bun:"apps" json:"apps"`
	Ratings   int `bun:"ratings" json:"ratings"`
	Questions int `bun:"questions" json:"questions"`
	Answers   int `bun:"answers" json:"answers"`
	Favorites int `bun:"favorites" json:"favorites"`
}

// ActivityItem is one thing the user did: published an app, rated one, asked
// or answered a question. App fields are empty for the global FAQ.
type ActivityItem struct {
	Type       string     `bun:"type" json:"type"`
	AppID      string     `bun:"app_id" json:"appId"`
	AppName    string     `bun:"app_name" json:"appName"`
	QuestionID string     `bun:"question_id" json:"questionId"`
	Title      string     `bun:"title" json:"title"`
	Body       string     `bun:"body" json:"body"`
	Rating     int        `bun:"rating" json:"rating"`
	CreatedAt  *time.Time `bun:"created_at" json:"createdAt"`
}

const activityStatsQuery = `
SELECT
  (SELECT count(*) FROM apps WHERE owner_id = ?0
     OR id IN (SELECT app_id FROM app_editors WHERE user_id = ?0)) AS apps,
  (SELECT count(*) FROM ratings WHERE user_id = ?1) AS ratings,
  (SELECT count(*) FROM faq_questions WHERE user_id = ?0)
    + (SELECT count(*) FROM global_faq_questions WHERE user_id = ?0) AS questions,
  (SELECT count(*) FROM faq_answers WHERE user_id = ?0)
    + (SELECT count(*) FROM global_faq_answers WHERE user_id = ?0) AS answers,
  (SELECT count(*) FROM user_favorites WHERE user_id = ?0) AS favorites`

const activityItemsQuery = `
SELECT * FROM (
  SELECT 'app' AS type, a.id AS app_id, a.name AS app_name, '' AS question_id,
         a.name AS title, '' AS body, 0 AS rating, a.created_at
    FROM apps a WHERE a.owner_id = ?0
  UNION ALL
  SELECT 'rating', a.id, a.name, '', a.name, LEFT(COALESCE(r.comment, ''), 280), r.rating, r.created_at
    FROM ratings r JOIN apps a ON a.id = r.app_id WHERE r.user_id = ?1
  UNION ALL
  SELECT 'question', a.id, a.name, q.id::text, q.question, '', 0, q.created_at
    FROM faq_questions q JOIN apps a ON a.id = q.app_id WHERE q.user_id = ?0
  UNION ALL
  SELECT 'question', '', '', q.id::text, q.question, '', 0, q.created_at
    FROM global_faq_questions q WHERE q.user_id = ?0
  UNION ALL
  SELECT 'answer', a.id, a.name, q.id::text, q.question, LEFT(ans.answer, 280), 0, ans.created_at
    FROM faq_answers ans
    JOIN faq_questions q ON q.id = ans.question_id
    JOIN apps a ON a.id = ans.app_id
   WHERE ans.user_id = ?0
  UNION ALL
  SELECT 'answer', '', '', q.id::text, q.question, LEFT(ans.answer, 280), 0, ans.created_at
    FROM global_faq_answers ans
    JOIN global_faq_questions q ON q.id = ans.question_id
   WHERE ans.user_id = ?0
) activity
ORDER BY created_at DESC NULLS LAST
LIMIT ?2 OFFSET ?3`

const activityPageSize = 20

// GetOwnActivity returns the signed-in user's counts and a page of what they
// did, newest first.
func GetOwnActivity(context *gin.Context, db *bun.DB) {
	userID, ok := getUserIDFromContext(context)
	if !ok {
		return
	}
	ctx := context.Request.Context()

	page, err := strconv.Atoi(context.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	var stats activityStats
	if err := db.NewRaw(activityStatsQuery, userID, userID.String()).Scan(ctx, &stats); err != nil {
		httperror.InternalServerError(context, "Aktivität konnte nicht geladen werden", err)
		return
	}

	// One more than a page, to know whether another follows.
	items := make([]ActivityItem, 0, activityPageSize+1)
	if err := db.NewRaw(activityItemsQuery, userID, userID.String(), activityPageSize+1, (page-1)*activityPageSize).
		Scan(ctx, &items); err != nil {
		httperror.InternalServerError(context, "Aktivität konnte nicht geladen werden", err)
		return
	}
	hasMore := len(items) > activityPageSize
	if hasMore {
		items = items[:activityPageSize]
	}

	context.JSON(http.StatusOK, gin.H{"stats": stats, "items": items, "hasMore": hasMore})
}
