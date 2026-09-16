package apps

import "justapps-backend/pkg/models"

func newAppFAQAnswerNotification(question models.FAQQuestion, answer models.FAQAnswer) *models.UserFAQAnswerNotification {
	if question.UserID == answer.UserID {
		return nil
	}
	return &models.UserFAQAnswerNotification{
		UserID:        question.UserID,
		AppID:         &answer.AppID,
		AppQuestionID: &question.ID,
		AppAnswerID:   &answer.ID,
		CreatedAt:     answer.CreatedAt,
	}
}

func newGlobalFAQAnswerNotification(question models.GlobalFAQQuestion, answer models.GlobalFAQAnswer) *models.UserFAQAnswerNotification {
	if question.UserID == answer.UserID {
		return nil
	}
	return &models.UserFAQAnswerNotification{
		UserID:           question.UserID,
		GlobalQuestionID: &question.ID,
		GlobalAnswerID:   &answer.ID,
		CreatedAt:        answer.CreatedAt,
	}
}
