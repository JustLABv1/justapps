# Private Spaces

Use the **Space** selector on the homepage to switch between the public catalog and your accepted spaces. Search, filters and pagination stay within the selected space. Open **Private Spaces** from the navigation to create a personal space. A space without invited members is visible only to its owner. Space creation is available to authenticated users; creating apps still requires the existing app submission permission.

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

The claim path is configurable per provider under **Verwaltung → Einstellungen → OIDC-Provider → Gruppen-Claim-Pfad**. The default is `groups`. Supported examples:

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
