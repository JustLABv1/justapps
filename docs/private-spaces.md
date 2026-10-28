# Private Spaces

Use the **Space** selector on the homepage to switch between the public catalog and your accepted spaces. Search, filters and pagination stay within the selected space. Open **Private Spaces** from the navigation to create a personal space. A space without invited members is visible only to its owner. Space creation follows the global rule configured by an administrator. Creating apps still requires the existing app submission permission.

The space owner can rename a space or delete it with all contained private apps after confirmation. Published apps remain in the public catalog.

The space owner can invite existing, active accounts by email address. Invitations appear under **Private Spaces** in the invited account. Access begins after acceptance. The owner can remove members or cancel invitations, and members can leave the space.

Accepted members can see the space's apps, including drafts, and create their own apps. App ownership and editor permissions continue to control editing. Platform roles and app editor assignments alone do not grant access to another user's private space. An app's own owner retains access to that app if they leave the space.

To publish, the app owner selects **Für alle veröffentlichen** from the app actions under **Meine Apps** and confirms the dialog. Description and category are required. Publication moves the app out of the space into the public catalog, clears the hidden flag, and changes a draft to **In Erprobung**. Its documentation, ratings and discussions become public with it. Ordinary edits cannot change the space assignment.

Private entries are excluded from the public catalog, MCP catalog, global FAQ and catalog stewardship. App-specific endpoints, AI retrieval, related-app results, health data and notification lists enforce space access. Backups include spaces and memberships with the apps section.

Database migration `62_create_private_spaces.go` adds spaces, invitations/memberships and the nullable `apps.space_id` reference. Existing apps remain in the public catalog.

## OIDC / Keycloak group access

Space owners can open **⋯ → Gruppenzugriff** to assign an active OIDC provider and an exact group name or full path, for example `/teams/digitalisierung`. Several mappings are allowed; any matching group grants membership. The mapping is bound to both the provider key and its configured issuer. This grants space membership, not ownership or global app submission/editing permissions.

In Keycloak, configure a **Group Membership** protocol mapper for the client:

- Token Claim Name: `groups`
- Add to ID token: enabled
- Full group path: enabled when using paths such as `/teams/digitalisierung`

See the [official Keycloak protocol mapper documentation](https://www.keycloak.org/admin-api/protocol-mappers). Names are case-sensitive and exact: a mapping for `/teams/A` does not automatically match `/teams/A/sub`. Roles and realm/client roles are not interpreted as group membership.

The claim path is configurable per provider under **Verwaltung → Benutzer & Zugriff → Zugriff & Berechtigungen → Anmeldung & SSO → Gruppen-Claim-Pfad**. The default is `groups`. Supported examples:

| Setting | Token structure |
| --- | --- |
| `memberOf` | `{ "memberOf": ["/teams/A"] }` |
| `realm.groups` | `{ "realm": { "groups": ["/teams/A"] } }` |
| `/organization/acme/groups` | `{ "organization": { "acme": { "groups": ["/teams/A"] } } }` |

JSON Pointer is unambiguous and supports escaped keys: `~1` means `/`, and `~0` means `~`. A dotted path first checks for an exact top-level claim name, then traverses nested objects. Claim values must be arrays of strings. Invalid value types fail the login; missing claims are treated as no groups. The configured claim is also used by the provider's existing admin-group check.

The claim path describes where the list is stored; the Space mapping describes an exact value inside that list. No prefix stripping, case folding, or automatic group-path conversion takes place.

On a successful OIDC login, the backend synchronizes the verified token's groups before issuing its session. Matching users gain access immediately without accepting an invitation. Groups missing from the token, including an absent `groups` claim, remove the corresponding group-derived access at that login. There is no background Keycloak polling: changing Keycloak membership alone does not revoke an existing user's access until their next OIDC login. Removing a mapping in JustApps revokes its grants immediately. If a provider is disabled or replaced, remove obsolete mappings to revoke old grants without requiring another login.

Manual invitations and accepted manual memberships are stored separately and survive group changes. Multiple mappings/providers can independently grant access. Group-managed members are marked **Über OIDC verwaltet** and cannot be deselected in the manual member picker. Existing app ownership remains an independent source of access to an owner's own apps.

Migration `64_add_oidc_groups_claim.go` adds the provider-specific claim path with `groups` as its default. Migration `63_add_space_oidc_groups.go` adds mappings and independent membership sources. Backups include mappings and manual memberships. Group grants are regenerated from a verified token on the next OIDC login after restore; they are not trusted from backup data.


## Central administration and creation rules

Administrators can open **Verwaltung → Katalog → Private Spaces** to search all spaces by name or owner. The overview shows owners, app counts, accepted members, invitations and group mappings. Administrators can rename spaces, change ownership, manage membership and group mappings, and delete spaces. Transferring a space does not transfer ownership of its apps.

Under **Zugriff & Berechtigungen → Globale Regeln**, the global **Wer darf Spaces erstellen?** rule has four modes:

| Rule | Who can create spaces |
| --- | --- |
| Everyone | All authenticated, active accounts |
| OIDC group | Accounts in the configured provider's exact group, from their latest verified OIDC login |
| Administrators | Administrators only |
| Allowed users | Accounts explicitly granted **Spaces erstellen erlauben** in the user administration |

Administrators can create spaces in every mode. Individual user flags apply only in **Allowed users** mode and cannot bypass the administrator-only or OIDC-group modes. The initial rule is **Allowed users**, with individual grants disabled by default. Existing spaces and membership access are unaffected.

For the OIDC-group rule, configure the provider and exact group under the global rule in the access workspace. The provider's configured claim path is used. Verified group snapshots are refreshed at OIDC login even when no per-space group mappings exist. They are not included in backups. A user may need to sign in again through OIDC before the group rule recognizes their membership. Disabling or deleting the configured provider blocks creation via this rule.

Rules are checked against current database state for each creation request. Migrations `65_add_space_creation_permission.go` and `66_add_space_creation_policy.go` add the individual flag, global policy and verified group snapshots. The apps backup section includes the global creation policy; individual flags are included with users.


### Rollenrechte für Spaces

Unter **Benutzer & Zugriff → Zugriffssteuerung → Rollen** können Rollen folgende unabhängige Rechte erhalten:
`spaces:create`, `spaces:view`, `spaces:manage` (Umbenennen), `spaces:members:manage`, `spaces:groups:manage`, `spaces:ownership:transfer` und `spaces:delete`.
Verwaltungsrechte gelten für alle Spaces. Eigentümer behalten ihre bisherigen Rechte an eigenen Spaces. Die Übersicht gewährt keinen Zugriff auf private App-Inhalte.
Delegierte Verwalter erreichen die Übersicht über **Ihre Spaces → Alle Spaces verwalten** (`/spaces/verwaltung`), ohne Zugriff auf die übrige Administration zu benötigen.
Das Erstellungsrecht greift im globalen Modus **Nur für freigegebene Nutzer oder Rollen** zusätzlich zur individuellen Freigabe. Die Modi **Nur Administratoren** und **OIDC-Gruppe** werden dadurch nicht übersteuert.
