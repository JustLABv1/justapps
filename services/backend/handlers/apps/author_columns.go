package apps

import "github.com/uptrace/bun"

// authorProfileSQL selects the display name and picture of the user whose id
// is in idExpr, as <prefix>display_name and <prefix>avatar_url. idExpr is
// always a column reference written in code, never user input.
func authorProfileSQL(idExpr, prefix string) (string, string) {
	return "COALESCE((SELECT u.display_name FROM users u WHERE u.id = " + idExpr + "), '') AS " + prefix + "display_name",
		"COALESCE((SELECT u.avatar_url FROM users u WHERE u.id = " + idExpr + "), '') AS " + prefix + "avatar_url"
}

// withAuthorProfile adds the author's display name and picture to a query.
func withAuthorProfile(query *bun.SelectQuery, idExpr string) *bun.SelectQuery {
	name, avatar := authorProfileSQL(idExpr, "")
	return query.ColumnExpr(name).ColumnExpr(avatar)
}

// replyToNameSQL selects the display name of the author of the answer being replied to.
func replyToNameSQL(idExpr string) string {
	name, _ := authorProfileSQL(idExpr, "reply_to_")
	return name
}
