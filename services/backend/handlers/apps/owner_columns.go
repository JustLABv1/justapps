package apps

import "github.com/uptrace/bun"

// ownerColumns keeps an app's owner to what may be shown about them. Without
// it the relation loads the whole users row, password hash included, and app
// responses are public.
func ownerColumns(query *bun.SelectQuery) *bun.SelectQuery {
	return query.Column("id", "username", "email", "display_name", "avatar_url")
}
