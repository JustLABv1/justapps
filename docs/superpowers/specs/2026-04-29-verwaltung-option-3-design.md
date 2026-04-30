# Verwaltung Option 3 Design

Date: 2026-04-29

## Goal

Replace the current admin information architecture with a domain-based Verwaltung structure that removes the double-navigation pattern. The admin UI should present one strong primary navigation layer, dissolve the standalone Einstellungen area, and redistribute settings into the domain where they are actually used.

## Approved Decisions

- Use five primary Verwaltung areas: `Uebersicht`, `Katalog`, `Plattform`, `Integrationen`, and `Sicherheit`.
- Remove `Einstellungen` as a standalone primary destination.
- Redistribute all current settings sections into the new domain areas.
- Avoid horizontal sub-tab bars inside area pages.
- Use area overview pages with cards, summaries, and direct links instead of nested tab navigation.
- Keep heavy operational screens such as app lists, backup import, audit tables, and repository sync as dedicated subpages.
- Introduce redirects from legacy Verwaltung routes to the new route structure during migration.
- Roll the change out in two phases so the admin UI stays usable during the transition.

## Non-Goals

- Rewriting unrelated admin workflows or backend APIs.
- Redesigning the public site navigation outside Verwaltung.
- Combining or deleting existing operational features such as backups, repository sync, or audit.
- Rebranding the visual system of the whole app.
- Shipping a one-step big-bang migration that moves all content and routes at once.

## Current State

The admin surface currently has two competing navigation layers:

- Verwaltung uses a wide horizontal primary navigation listing many individual features.
- `Einstellungen` introduces another horizontal tab bar inside the page.

That structure creates three problems:

1. It makes settings feel disconnected from the domains they affect.
2. It creates horizontal scrolling and poor scanability on smaller screens.
3. It forces users to understand UI structure before understanding functional ownership.

## Proposed Information Architecture

Verwaltung becomes a domain-oriented admin surface with five primary areas.

### 1. Uebersicht

Purpose:

- Provide operational status, recent activity, and shortcuts into the rest of Verwaltung.

Content:

- Existing dashboard metrics and status widgets.
- Quick links into the most common admin tasks.
- Alerts and system health summaries.

### 2. Katalog

Purpose:

- Own all app-catalog structure, metadata, and organization.

Content:

- Apps
- Gruppen
- Detail fields / content model
- App behavior and catalog ordering

### 3. Plattform

Purpose:

- Own the platform-facing presentation and governance model.

Content:

- Governance
- Startseite
- Branding

### 4. Integrationen

Purpose:

- Own external system connectivity and automation.

Content:

- Repository Sync
- Repository providers
- AI configuration

### 5. Sicherheit

Purpose:

- Own access, traceability, sensitive operations, and recovery tooling.

Content:

- Benutzer
- Tokens
- Audit
- Backups

## Route Design

The new Verwaltung route tree should reflect the domain boundaries directly.

### Primary Routes

- `/verwaltung`
- `/verwaltung/katalog`
- `/verwaltung/plattform`
- `/verwaltung/integrationen`
- `/verwaltung/sicherheit`

### Secondary Routes

- `/verwaltung/katalog/apps`
- `/verwaltung/katalog/gruppen`
- `/verwaltung/katalog/inhalte`
- `/verwaltung/katalog/app-verhalten`
- `/verwaltung/plattform/governance`
- `/verwaltung/plattform/startseite`
- `/verwaltung/plattform/branding`
- `/verwaltung/integrationen/repository-sync`
- `/verwaltung/integrationen/repository-providers`
- `/verwaltung/integrationen/ai`
- `/verwaltung/sicherheit/benutzer`
- `/verwaltung/sicherheit/tokens`
- `/verwaltung/sicherheit/audit`
- `/verwaltung/sicherheit/backups`

### Legacy Route Redirects

Legacy routes remain temporarily valid but redirect to the new structure.

- `/verwaltung/apps` -> `/verwaltung/katalog/apps`
- `/verwaltung/gruppen` -> `/verwaltung/katalog/gruppen`
- `/verwaltung/einstellungen` -> `/verwaltung/plattform`
- `/verwaltung/gitlab` -> `/verwaltung/integrationen/repository-sync`
- `/verwaltung/repository-sync` -> `/verwaltung/integrationen/repository-sync`
- `/verwaltung/benutzer` -> `/verwaltung/sicherheit/benutzer`
- `/verwaltung/tokens` -> `/verwaltung/sicherheit/tokens`
- `/verwaltung/audit` -> `/verwaltung/sicherheit/audit`
- `/verwaltung/backups` -> `/verwaltung/sicherheit/backups`

If a legacy route points into content that was previously embedded as a tab inside `Einstellungen`, redirect it to the most relevant new area landing page or subpage.

## Navigation Behavior

Verwaltung should expose a single strong navigation layer.

### Primary Navigation

- Show only the five primary domains in the Verwaltung navigation.
- Highlight the active domain for all nested routes under that domain.
- Keep the navigation compact enough to work without horizontal overflow on normal desktop widths.

### Mobile Navigation

- Use the same five-domain structure.
- Avoid secondary horizontal tab rows.
- Prefer stacked links, menu sheets, or a compact selector over horizontally scrollable admin tabs.

### In-Area Navigation

- Do not use tab bars within the area landing pages.
- Use cards, section lists, inline summaries, and clear entry links.
- Use breadcrumbs only on deeper operational pages if necessary.

## Area Page Composition

Each primary area should use the same structural pattern.

### Header

- Area title
- One-sentence purpose statement
- One or two quick actions when relevant

### Overview Cards

- Two to six cards that represent the main topics within the area
- Each card includes a short description, status summary when useful, and a direct action link

### Operational Content

- Inline summaries or previews for the most important data
- Links into dedicated heavy subpages when tables or workflows need more space

This pattern preserves discoverability without reintroducing nested tabs.

## Detailed Mapping From Current UI

### Current Verwaltung Items

- `Dashboard` -> `Uebersicht`
- `Apps` -> `Katalog / Apps`
- `Gruppen` -> `Katalog / Gruppen`
- `Repository Sync` -> `Integrationen / Repository Sync`
- `Benutzer` -> `Sicherheit / Benutzer`
- `Tokens` -> `Sicherheit / Tokens`
- `Audit` -> `Sicherheit / Audit`
- `Backups` -> `Sicherheit / Backups`
- `Einstellungen` -> dissolved into `Plattform`, `Katalog`, and `Integrationen`

### Current Einstellungen Tabs

- `Governance` -> `Plattform / Governance`
- `Startseite` -> `Plattform / Startseite`
- `Branding` -> `Plattform / Branding`
- `Inhalte` -> `Katalog / Inhalte`
- `Apps` -> `Katalog / App-Verhalten`
- `Integrationen` -> `Integrationen / Repository Providers`
- `AI` -> `Integrationen / AI`

## Interaction Design

The redesign should make area ownership obvious on entry.

### Landing Pages

Each of the four non-dashboard domains should act as an overview page first, not only as a redirect target.

Examples:

- `Plattform` shows cards for Governance, Startseite, and Branding.
- `Integrationen` shows cards for Repository Sync, Repository Providers, and AI.
- `Sicherheit` shows cards for Benutzer, Tokens, Audit, and Backups.
- `Katalog` shows cards for Apps, Gruppen, Inhalte, and App behavior.

### Heavy Screens

Dedicated workflow screens stay separate when they need full-width content.

Examples:

- apps table and editor flows
- audit log table
- backup export/import flow
- repository sync status table

Those screens are entered from the overview cards and from direct deep links.

### No Nested Tab Recovery

If a domain later accumulates more content, the solution is not to add another tab strip. The solution is to add another area card, a grouped section, or a deeper dedicated route.

## Migration Plan

### Phase 1: Structure First

- Introduce the new primary admin navigation.
- Add the new domain landing pages.
- Add redirects from legacy Verwaltung routes.
- Keep existing operational pages functional, even if some still render old content internally.

Outcome:

- Users see the new information architecture immediately.
- Existing bookmarks and links continue to work.

### Phase 2: Content Redistribution

- Break apart the current `Einstellungen` page.
- Move its settings blocks into the new domain pages and subpages.
- Remove the old nested settings tab component.
- Finalize the new per-domain entry points and quick actions.

Outcome:

- The old `Einstellungen` mega-page disappears.
- Every setting lives in the domain where it is used.

## Validation Plan

Validation should prove both navigation correctness and UI simplification.

### Routing Validation

- Confirm every new primary route renders the correct active domain state.
- Confirm legacy routes redirect to the intended new destinations.
- Confirm deeper routes still highlight the correct primary domain.

### Layout Validation

- Confirm Verwaltung has only one strong navigation layer.
- Confirm there are no horizontal nested tab bars in the redesigned areas.
- Confirm mobile layouts do not rely on wide horizontal tab scrolling.

### Functional Validation

- Confirm major admin workflows remain reachable through the new domain pages.
- Confirm no settings block becomes orphaned during the transition.

### Build Validation

- Run `pnpm check` in `services/frontend` after implementation changes.

## Success Criteria

The redesign is successful when all of the following are true:

- Verwaltung navigation is understandable as five domains instead of a long feature list.
- `Einstellungen` no longer exists as a standalone primary admin destination.
- The UI does not present a second horizontal tab system inside Verwaltung.
- Users can still reach all existing admin workflows through the new structure.
- Legacy links continue to resolve during the migration period.

## Risks And Guardrails

### Risk: Users lose familiar entry points

Guardrail:

- Preserve legacy routes through redirects during the migration window.

### Risk: The redesign becomes a cosmetic relabeling only

Guardrail:

- Treat the breakup of `Einstellungen` as mandatory, not optional.

### Risk: New domain pages become empty wrappers

Guardrail:

- Every domain landing page must contain meaningful cards, summaries, and direct actions.

### Risk: Nested tabs creep back in later

Guardrail:

- Future additions should extend the route tree or card structure, not add secondary tab bars.
