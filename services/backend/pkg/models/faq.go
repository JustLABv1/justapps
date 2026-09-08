package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// FAQQuestion is a community question associated with an app.
type FAQQuestion struct {
	bun.BaseModel `bun:"table:faq_questions"`

	ID          uuid.UUID   `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	AppID       string      `bun:"app_id,notnull" json:"appId"`
	UserID      uuid.UUID   `bun:"user_id,notnull,type:uuid" json:"userId"`
	Username    string      `bun:"username,notnull,default:''" json:"username"`
	Question    string      `bun:"question,notnull" json:"question"`
	CreatedAt   time.Time   `bun:"created_at,nullzero,notnull,default:current_timestamp" json:"createdAt"`
	AnswerCount int         `bun:"-" json:"answerCount"`
	Answers     []FAQAnswer `bun:"-" json:"answers"`
}

// FAQAnswer is a community answer. IsPinned and CreatorLiked are the two
// app-owner/admin promotion signals; UpvoteCount and UserUpvoted are derived
// when the FAQ is read.
type FAQAnswer struct {
	bun.BaseModel `bun:"table:faq_answers"`

	ID           uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	QuestionID   uuid.UUID `bun:"question_id,notnull,type:uuid" json:"questionId"`
	AppID        string    `bun:"app_id,notnull" json:"appId"`
	UserID       uuid.UUID `bun:"user_id,notnull,type:uuid" json:"userId"`
	Username     string    `bun:"username,notnull,default:''" json:"username"`
	Answer       string    `bun:"answer,notnull" json:"answer"`
	IsPinned     bool      `bun:"is_pinned,notnull,default:false" json:"isPinned"`
	CreatorLiked bool      `bun:"creator_liked,notnull,default:false" json:"creatorLiked"`
	CreatedAt    time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp" json:"createdAt"`
	UpvoteCount  int       `bun:"-" json:"upvoteCount"`
	UserUpvoted  bool      `bun:"-" json:"userUpvoted"`
}

// FAQAnswerUpvote records one user's upvote for one answer.
type FAQAnswerUpvote struct {
	bun.BaseModel `bun:"table:faq_answer_upvotes"`

	AnswerID  uuid.UUID `bun:"answer_id,pk,type:uuid" json:"answerId"`
	UserID    uuid.UUID `bun:"user_id,pk,type:uuid" json:"userId"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp" json:"createdAt"`
}

// UserFAQInboxItem notifies an app owner or editor that a new question needs
// attention. The row is user-specific so each recipient can read it on their
// own schedule.
type UserFAQInboxItem struct {
	bun.BaseModel `bun:"table:user_faq_inbox_items,alias:ufii"`

	ID         uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID  `bun:"user_id,notnull,type:uuid" json:"userId"`
	QuestionID uuid.UUID  `bun:"question_id,notnull,type:uuid" json:"questionId"`
	AppID      string     `bun:"app_id,notnull,type:text" json:"appId"`
	SeenAt     *time.Time `bun:"seen_at,nullzero" json:"seenAt,omitempty"`
	CreatedAt  time.Time  `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
}

type FAQInboxListItem struct {
	ID          uuid.UUID  `json:"id"`
	QuestionID  uuid.UUID  `json:"questionId"`
	AppID       string     `json:"appId"`
	AppName     string     `json:"appName"`
	AppIcon     string     `json:"appIcon"`
	Questioner  string     `json:"questioner"`
	Question    string     `json:"question"`
	AnswerCount int        `json:"answerCount"`
	CreatedAt   time.Time  `json:"createdAt"`
	SeenAt      *time.Time `json:"seenAt,omitempty"`
}
