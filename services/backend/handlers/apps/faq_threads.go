package apps

import (
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// Select whole conversations after paginating ranked top-level answers. UNION
// also guards against repeated IDs if malformed data ever contains a cycle.
func faqThreadQuery(db *bun.DB, query *bun.SelectQuery, table string, questionID uuid.UUID, roots []uuid.UUID) *bun.SelectQuery {
	ids := db.NewRaw(`WITH RECURSIVE thread_ids AS (
 SELECT id FROM ? WHERE question_id = ? AND id IN (?)
 UNION
 SELECT child.id FROM ? AS child
 JOIN thread_ids AS parent ON child.reply_to_answer_id = parent.id
 WHERE child.question_id = ?
 ) SELECT id FROM thread_ids`, bun.Ident(table), questionID, bun.In(roots), bun.Ident(table), questionID)
	return query.Clone().Where("a.id IN (?)", ids)
}
