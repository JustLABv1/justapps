# Administrative settings

Each global setting has one editable location. Entity-specific controls stay on their entity: user flags on users, membership/group mappings on spaces, and repository defaults on repository providers.

| Area | Canonical page | Contents |
| --- | --- | --- |
| Global access and creation policies | `/verwaltung/sicherheit/zugriff` → Globale Regeln | Catalog login requirement, app submissions, all four space-creation modes, FAQ activation, AI activation and anonymous AI use |
| Roles and permissions | Same page → Rollen & Rechte | Role definitions and role permission assignments |
| Authentication | Same page → Anmeldung & SSO | OIDC providers, client secrets, admin-group mapping, groups claim path and local-login behavior |
| Individual grants | `/verwaltung/sicherheit/benutzer` | Accounts, role assignments and per-user app/space creation flags |
| Catalog configuration | `/verwaltung/katalog/einstellungen` | Sorting, pinned entries, link probing and app detail-field definitions |
| Appearance | `/verwaltung/plattform/gestaltung` | Brand name, logos, colors, home page, banners and footer links |
| Catalog entities | Apps, App-Gruppen, Private Spaces | App records, collections, spaces, ownership and entity-specific access |
| Technical integrations | Repository providers, repository sync, KI-Provider & Modelle | Technical connections, synchronization, models and knowledge indexing |
| Operations | App-Gesundheit, Aktivitätsprotokoll, Sicherung & Wiederherstellung | Health monitoring, audit and backup management |

Global policy controls are not duplicated in catalog or space entity pages. Those pages link to the access workspace. Individual user grants do not override the selected global policy.

`admin-navigation.ts` is the shared source for the sidebar, navigation search and category landing cards. Active category matching follows destination ownership, including operations pages whose legacy URLs are nested under catalog or security.

## Existing links

Old URLs redirect to the appropriate canonical page and tab:

- `/verwaltung/plattform/governance` → global access rules
- `/verwaltung/sicherheit/rollen` → roles tab
- `/verwaltung/integrationen/auth` → authentication tab
- `/verwaltung/katalog/app-verhalten` → catalog sorting/link probing
- `/verwaltung/katalog/inhalte` → catalog detail fields
- `/verwaltung/plattform/branding` → brand/colors tab
- `/verwaltung/plattform/startseite` → home page/banner tab
- `/verwaltung/plattform` → appearance workspace
- `/verwaltung/einstellungen` → administration overview

Existing configuration values and API persistence behavior are preserved. Configuration workspaces fail closed on load errors rather than offering defaults that could overwrite saved settings. Technical repository-provider data is only fetched on its own integration page.
