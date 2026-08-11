# Graph Report - .  (2026-08-10)

## Corpus Check
- 357 files · ~208,034 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1960 nodes · 4329 edges · 167 communities (154 shown, 13 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 601 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 163
- Community 164
- Community 165
- Community 166

## God Nodes (most connected - your core abstractions)
1. `InternalServerError()` - 102 edges
2. `fetchApi()` - 77 edges
3. `Apps` - 53 edges
4. `StatusBadRequest()` - 48 edges
5. `AppConfig` - 37 edges
6. `useAuth()` - 37 edges
7. `RegisterApps()` - 36 edges
8. `RestfulConf` - 35 edges
9. `WriteAudit()` - 34 edges
10. `useSettings()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Compose Backend Environment Configuration` --semantically_similar_to--> `Backend Config File`  [INFERRED] [semantically similar]
  deploy/compose/backend.config.yaml → services/backend/config/config.yaml
- `Runtime-Configured OIDC Providers` --semantically_similar_to--> `Keycloak OIDC Authentication`  [INFERRED] [semantically similar]
  services/backend/README.md → KEYCLOAK_SETUP.md
- `Deployment-Ready App Instructions` --conceptually_related_to--> `Docker Compose Stack`  [INFERRED]
  README.md → deploy/compose/compose.yaml
- `Generated Backend Runtime Configuration` --shares_data_with--> `Backend Config File`  [INFERRED]
  charts/justapps/templates/configmap-backend.yaml → services/backend/config/config.yaml
- `Deployment-Ready App Instructions` --conceptually_related_to--> `Helm Application Chart`  [INFERRED]
  README.md → charts/justapps/Chart.yaml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Authentication and Access Control Flow** — readme_oidc_authentication, keycloak_setup_oidc_authentication, keycloak_setup_offline_access, services_backend_readme_runtime_oidc_providers, keycloak_setup_user_management [INFERRED 0.85]
- **Deployment Delivery Paths** — readme_deployment_ready, deploy_compose_compose_compose_stack, charts_justapps_chart_helm_application_chart, _github_workflows_release_helm_chart_publish, _github_workflows_release_multiarch_images [INFERRED 0.85]
- **Backend Configuration Flow** — services_backend_config_config_backend_config, deploy_compose_backend_config_environment_config, charts_justapps_templates_configmap_backend_backend_runtime_config, charts_justapps_templates_deployment_secret_injection, charts_justapps_values_secret_externalization [INFERRED 0.85]
- **App Grid Gradient Palette** — services_frontend_app_icon_app_grid_layer, services_frontend_app_icon_cyan_blue, services_frontend_app_icon_purple_pink, services_frontend_app_icon_green_teal, services_frontend_app_icon_yellow_red [EXTRACTED 1.00]

## Communities (167 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (74): AppRelease, legacyDetailFieldBinding, diffOp, unifiedHunk, GitLabSyncSummary, AppField, AppGroupSummary, AppLink (+66 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (68): createConversationRequest, publicAssistantMessage, publicHistoryMessage, publicSendMessageRequest, publicSendMessageResponse, RetrievalQuery, sendMessageRequest, AppField (+60 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (57): ChatPageContent(), initialChatParams(), QUICK_PROMPTS, AIProviderSettingsPanel(), defaultDraft(), parseApiError(), ProviderDraft, AIChatWidget() (+49 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (43): createAIProviderRequest, createGitLabProviderRequest, settingsResponse, updateAIProviderRequest, updateGitLabProviderRequest, Context, StatusConflict(), CreateAIProvider() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (33): react, getSafeCallbackUrl(), LoginPage(), readOIDCResult(), readSafeCallbackUrl(), dynamic, getApps(), HomeContent() (+25 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (37): AppPageContent(), AppCreationFlow(), Branches, CATEGORIES, EMOJIS, emptyApp(), links(), SectionId (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (25): ChatMessage, ChatProvider, ChatRequest, ChatResponse, httpChatProvider, ProviderCapabilities, ProviderRuntime, providerTextMessage (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (36): OIDCProviderRuntime, OIDCProviderAdminResponse, OIDCProviderSettings, OIDCProviderSummary, OIDCProviderSummary, createOIDCProviderRequest, updateOIDCProviderRequest, DecryptOIDCProviderSecret() (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (35): oidcPKCECookieClaims, oidcStateClaims, Config, Users, Provider, buildLoginRedirectURL(), buildOIDCStateToken(), buildProviderOAuthConfig() (+27 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (37): RetrievedContext, AIProviderSummary, AIConversation, AIKnowledgeChunk, AIMessage, AIMessageSource, AIProviderAdminResponse, AIProviderSettings (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (38): importExecutionResult, importResponse, importSectionStats, restoreMode, clearDatabaseForReplace(), dedupeWarnings(), executeBackupImport(), AIConversation (+30 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (31): ChangeUserDetails(), Context, DB, ChangeUserPassword(), Context, DB, getUserIDFromContext(), Context (+23 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (29): AppCreationFlowProps, AppEditorFormProps, AppEditorsModal(), AppEditorsModalProps, userMatchesSearch(), AppList(), AppListProps, DeploymentAssistant() (+21 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (28): AppGroup, getTopCategories(), GruppenDetailPageContent(), loadGroupApps(), loadGroups(), AppGroup, dynamic, EnrichedAppGroup (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (33): Backend ConfigMap Template, Generated Backend Runtime Configuration, Custom CA Workload Mount, Application Data Volume, Database Readiness Init Container, Application Deployment Template, Application Health Probes, Microservices Backend and Frontend Deployments (+25 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (30): BackupMode, exportBackupRequest, appendSummary(), buildBackupFilename(), collectReferencedUploadPaths(), exportAIConversations(), exportAIProviders(), exportAppEditors() (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (26): appEditorSummaryRow, AppUserSummary, SelectQuery, applyStatusFilter(), applySyncStatusFilter(), applyVisibilityFilter(), GetApp(), GetApps() (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (21): AppGroup, AppSummary, emptyForm, GroupFormState, VerwaltungGruppenPage(), getSyncMeta(), PROVIDER_TYPE_LABEL, providerTypeLabel() (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (21): DeleteUser(), Context, DB, AddFavorite(), GetFavorites(), Context, DB, RemoveFavorite() (+13 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (22): FavoriteButton(), FavoriteButtonProps, AuthContext, AuthContextType, AuthProvider(), clearStoredAuthSession(), emptyLocalAuthSession, getCurrentCallbackUrl() (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (20): backupContainerAAD, BackupCipherMetadata, BackupKDFMetadata, BackupManifest, BackupMode, BackupSectionSummary, BackupToken, BackupUser (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (17): ConfigurationManager, CORSConf, DatabaseConf, JWTConf, OIDCConf, RepositoryProviderEncryptionConf, RestfulConf, GetConfigInstance() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (14): Desc, Metric, aiTotalsRow, appRow, auditCountRow, collector, recentLoginRow, userRoleRow (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (17): Context, StatusBadRequest(), CreateUser(), Context, DB, DisableUser(), Context, DB (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.21
Nodes (20): appEditorUserResponse, applyViewerPermissions(), appViewerPermissions(), canManageAppEditors(), canViewApp(), getRequiredViewerContext(), AppViewerPermissions, Context (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (12): RepositoryProviderConf, APIError, Client, projectResponse, SyncResult, treeEntry, GitLabSyncSnapshot, Values (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (17): BackupAsset, DetailFieldDef, FooterLink, PlatformSettings, canonicalUploadReference(), normalizeBackupAssetPath(), normalizeUploadReference(), canonicalizeAppGroupUploadReferences() (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.30
Nodes (18): Context, InternalServerError(), AddGroupMember(), AddRelatedApp(), CreateGroup(), DeleteGroup(), GetGroupMembers(), GetRelatedApps() (+10 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (12): MyAppsContent(), BenutzerPage(), SystemUser, formatDate(), isExpired(), Token, TokensPage(), ConfirmDialog() (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (19): backupImportJob, backupUploadSession, completeBackupUploadRequest, createBackupUploadRequest, AppendBackupUploadChunk(), cleanupExpiredBackupImportJobs(), cleanupExpiredBackupUploads(), CompleteBackupUpload() (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (18): allSectionIds, assetDependentSectionIds, BackupImportJob, BackupImportJobStatus, BackupMode, BackupsPage(), BackupUpload, getRequestError() (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (4): AdminSettingsWorkspace(), defaultBaseUrlForProviderType(), defaultProviderDraft(), parseProviderAllowlist()

### Community 33 - "Community 33"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/js-yaml (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (19): @heroui/react, @heroui/styles, js-yaml, lucide-react, next, next-auth, next-themes, remark-gfm (+11 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (16): AppEditor, AppGroup, AppGroupMember, AppRelation, BackupData, UserFavorite, AIConversation, AIMessage (+8 more)

### Community 36 - "Community 36"
Cohesion: 0.19
Nodes (14): Forbidden(), Context, Context, StatusNotFound(), Context, Unauthorized(), normalizeAppBanner(), normalizeAppDetailFields() (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (14): AppsContent(), AppsPage(), buildAppsQuery(), FILTER_PARAM_KEYS, readFilters(), AppTable(), AppTableProps, EditorsAvatarGroup() (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (13): reasonLabel(), UpdatesPage(), AppCard(), GitHubIcon(), GitHubIconProps, LinkStatusDot(), normalizeProbeStatus(), ProbeStatus (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (10): GitHubClient, githubContentResponse, githubReadmeResponse, githubRepoResponse, decodeGitHubContent(), githubAPIBase(), Values, NewGitHubClient() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.31
Nodes (16): ProviderRuntime, GitLabProviderSettings, providerLabel(), buildProviderRuntime(), Context, DB, GitLabProviderSummary, ListAdminProviders() (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (14): AdminSettingsSection, AdminSettingsWorkspaceProps, allowedAppSortFields, defaultState, normalizeAppSortField(), normalizeSettingsState(), ProviderDraftState, SettingsState (+6 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (12): DeleteToken(), Context, DB, GetAudit(), Context, DB, GetTokens(), Context (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.12
Nodes (12): CheckUserTaken(), Context, DB, Context, DB, RegisterUser(), Auth(), DB (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.41
Nodes (14): upsertGitLabLinkRequest, ApproveGitLabIntegration(), buildGitLabIntegrationResponse(), DeleteGitLabIntegration(), GetGitLabIntegration(), getGitLabLink(), Context, DB (+6 more)

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (11): GetUserIDFromToken(), UUID, Context, DB, RefreshToken(), Context, DB, Context (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.26
Nodes (11): AppCardSkeleton(), AppGrid(), AppGridProps, sortAppStatuses(), addRecentlyViewed(), emptyRecentlyViewed, getRecentlyViewed(), notifyRecentlyViewedChange() (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (12): FlagBar(), BrandingPresetOption, CUSTOM_BRANDING_PRESET, DEFAULT_HERO_TITLE_PRESET, DEFAULT_TOP_BAR_PRESET, getPresetColors(), HERO_TITLE_PRESET_OPTIONS, normalizeColorList() (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.15
Nodes (12): config:recommended, dependencies, eslint, extends, ignoreDeps, labels, packageRules, prConcurrentLimit (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.22
Nodes (8): metadata, AppShell(), isChatRoute(), isCreationRoute(), PageTransition(), Providers(), BANNER_STYLES, TopBanner()

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (9): Context, DB, ValidateTokenDBEntry(), CheckAdmin(), DB, UUID, Admin(), DB (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.27
Nodes (10): parseSections(), inferManifestSections(), parseImportSections(), canonicalBackupSection(), filterUnavailableSections(), manifestAvailableSections(), normalizeSectionList(), T (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.23
Nodes (9): Context, ServeUpload(), T, TestServeUploadSupportsNestedRestoredPaths(), TestUploadLogoAllowsAuthenticatedNonAdminUser(), UploadLogo(), DB, RouterGroup (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.23
Nodes (3): AdminOverviewCard, AdminOverviewPage(), AdminOverviewPageProps

### Community 54 - "Community 54"
Cohesion: 0.30
Nodes (11): ApprovalDiffItem, buildApprovalDiffItems(), formatList(), formatRepositories(), GitLabFormState, GitLabTab(), mergeRepositories(), mergeTags() (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (11): collapseLines(), DiffLine, getDiffClasses(), parseUnifiedDiff(), ReleaseDiffViewer(), renderDiffLine(), shouldShowSideBySide(), SideBySideView() (+3 more)

### Community 56 - "Community 56"
Cohesion: 0.18
Nodes (8): Engine, Server, RouterGroup, Health(), DB, StartRouter(), DB, Metrics()

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (10): LinkProbeResult, collectURLs(), BaseModel, Context, DB, Time, probeURL(), resetProbeState() (+2 more)

### Community 58 - "Community 58"
Cohesion: 0.40
Nodes (10): AppRelease, ReleaseChangeDetail, ReleaseInboxListItem, UserRecentlyViewedApp, UserReleaseInboxItem, UserUpdatePreferences, BaseModel, ReleaseChangeDetail (+2 more)

### Community 59 - "Community 59"
Cohesion: 0.24
Nodes (10): AuditEntry, getEndpointLabel(), normalizeStatsResponse(), OPERATION_LABELS, ProbeEndpoint, ProbeIssue, RawStatsResponse, relativeTime() (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (10): Keycloak Admin Group Mapping, Keycloak CORS Configuration, Keycloak Integration and Admin Setup, Keycloak Client and Realm, OIDC Offline Access, OIDC Environment Configuration, PKCE S256, OIDC Token Validation Troubleshooting (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.31
Nodes (8): CleanToken(), GetBridgeDataFromToken(), GetIDFromToken(), GetTypeFromToken(), RefreshToken(), ValidateToken(), GenerateJWT(), UUID

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (5): NewMyAppContent(), NewAppContent(), NewAppPage(), cloneLinks(), prepareAppCopyDraft()

### Community 63 - "Community 63"
Cohesion: 0.24
Nodes (8): AuditEntry, AuditPage(), AuditResponse, FILTER_OPTIONS, getOperationMeta(), OPERATION_META, OperationColor, SKELETON_IDS

### Community 64 - "Community 64"
Cohesion: 0.25
Nodes (8): oidcExchangeRequest, oidcExchangeResponse, oidcExchangeUser, GenerateOIDCSessionJWT(), Context, DB, UUID, OIDCExchange()

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (9): Compose Backend Configuration, Compose Backend Environment Configuration, GitLab and GitHub Repository Sync, Backend Config File, Backend Database Settings, Backend JWT Settings, Backend OIDC Local-Auth Settings, Repository Provider Token Encryption (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.25
Nodes (9): Keycloak OIDC Authentication, AI Catalog and Deployment Chat, Application Catalog, JustApps README, OIDC Authentication with Local Fallback, Ratings and Reviews, Self-Hosted Application Store, AI Usage Snapshots (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (7): ensureAppsCreatedAtColumn(), Context, DB, StartDatabase(), StartPostgres(), DB, SeedDatabase()

### Community 68 - "Community 68"
Cohesion: 0.22
Nodes (9): App Grid Layer, App Icon, App Shadow, Squircle Background, Cyan-Blue Gradient, Green-Teal Gradient, Prefers-Color-Scheme Adaptation, Purple-Pink Gradient (+1 more)

### Community 69 - "Community 69"
Cohesion: 0.29
Nodes (8): Helm Chart Linting, Manual Helm Chart Publish, GitHub Container Registry Helm OCI, Helm Chart Release Workflow, Tag-Triggered Helm Chart Publish, JustApps Helm Chart Metadata, Helm Application Chart, Deployment-Ready App Instructions

### Community 70 - "Community 70"
Cohesion: 0.50
Nodes (7): OIDCClaims, ResourceRole, GetOIDCClaims(), getString(), getStringSlice(), IsAdminOIDC(), IsAdminOIDCWithGroup()

### Community 71 - "Community 71"
Cohesion: 0.29
Nodes (6): OIDCSessionClaim, RegisteredClaims, ValidateOIDCSessionToken(), Auth(), DB, HandlerFunc

### Community 72 - "Community 72"
Cohesion: 0.43
Nodes (6): Syncer, DefaultBaseURLForType(), IsProviderTypeSupported(), NewSyncer(), normalizeProviderBaseURL(), NormalizeProviderType()

### Community 73 - "Community 73"
Cohesion: 0.32
Nodes (8): Admin User Management UI, Admin Integrations Authentication UI, Backend Documentation, Catalog and Audit-Backed Metrics, Cluster-Global Observability, Lifecycle and Login Activity Metrics, Prometheus OpenMetrics Endpoint, OIDC Provider-Key Flow

### Community 74 - "Community 74"
Cohesion: 0.32
Nodes (6): legacyDetailField, init(), columnExists(), Context, DB, tableExists()

### Community 75 - "Community 75"
Cohesion: 0.25
Nodes (7): sharp, unrs-resolver, name, pnpm, onlyBuiltDependencies, private, version

### Community 76 - "Community 76"
Cohesion: 0.25
Nodes (5): { handlers, auth, signIn, signOut }, next-auth, oidcConfigured, oidcIssuer, Session

### Community 77 - "Community 77"
Cohesion: 0.39
Nodes (7): defaultProviderDraft(), normalizeScopes(), OIDCProviderDraft, OIDCProviderSettingsPanel(), readClipboardFromPasteEvent(), scopesToText(), OIDCProviderAdminSettings

### Community 78 - "Community 78"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (6): LinkProbeEndpointIssue, LinkProbeIssue, GetStats(), Context, DB, Time

### Community 80 - "Community 80"
Cohesion: 0.43
Nodes (6): GitLabIntegrationResponse, GitLabProviderAdminResponse, GitLabProviderSummary, GitLabSyncSnapshot, GitLabSyncSummary, Time

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (6): IncBridgeTokenRequest, IncExpireTokenRequest, Tokens, BaseModel, Time, UUID

### Community 82 - "Community 82"
Cohesion: 0.48
Nodes (5): VerwaltungLayout(), AdminNavLink, adminNavLinks, isAdminNavLinkActive(), matchesPrefix()

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (7): scripts, build, check, dev, lint, start, typecheck

### Community 84 - "Community 84"
Cohesion: 0.47
Nodes (6): Conventional Changelog Generation, GitHub Release Creation, Multi-Architecture Container Images, Pre-Release Detection, Image Provenance and SBOM, Release Workflow

### Community 85 - "Community 85"
Cohesion: 0.73
Nodes (6): Compose Backend Service, Docker Compose Stack, Compose Frontend Service, Optional Nginx Edge Service, Compose Database and Upload Volumes, Compose PostgreSQL Service

### Community 86 - "Community 86"
Cohesion: 0.40
Nodes (5): IDToken, InitOIDC(), ValidateOIDCToken(), logging(), main()

### Community 87 - "Community 87"
Cohesion: 0.53
Nodes (5): Audit, AuditWithUser, BaseModel, Time, UUID

### Community 88 - "Community 88"
Cohesion: 0.60
Nodes (5): createSchema(), dropSchema(), Context, DB, init()

### Community 89 - "Community 89"
Cohesion: 0.47
Nodes (5): Context, DB, HandlerFunc, OptionalAuth(), populateOptionalAuthContext()

### Community 90 - "Community 90"
Cohesion: 0.40
Nodes (6): Adaptive Dark/Light Background, App Store Squircle Background, Apple App Icon, Colorful App Grid, Drop Shadow, Vibrant Gradient Tiles

### Community 91 - "Community 91"
Cohesion: 0.70
Nodes (5): Backend Vet and Build, Changed Component Detection, Component Docker Image Checks, Frontend Typecheck Lint and Build, Pull Request Check Workflow

### Community 92 - "Community 92"
Cohesion: 0.60
Nodes (4): JWTBridgeClaim, JWTClaim, RegisteredClaims, UUID

### Community 93 - "Community 93"
Cohesion: 0.40
Nodes (4): Rating, BaseModel, Time, UUID

### Community 94 - "Community 94"
Cohesion: 0.70
Nodes (4): Context, DB, RunScheduledSyncs(), StartScheduler()

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (4): *.jpeg, *.jpg, *.png, *.webp

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (3): BackupUploadResponse, T, TestGetBackupImportJob()

### Community 97 - "Community 97"
Cohesion: 0.50
Nodes (3): GetUsers(), Context, DB

### Community 98 - "Community 98"
Cohesion: 0.50
Nodes (3): DeleteRunnerToken(), Context, DB

### Community 99 - "Community 99"
Cohesion: 0.50
Nodes (3): DisableUser(), Context, DB

### Community 100 - "Community 100"
Cohesion: 0.50
Nodes (4): Angular Geometric Brand Mark, Dark Monochrome Brand Palette, Stylized JL Monogram, JustLab Logo Image

### Community 101 - "Community 101"
Cohesion: 0.50
Nodes (3): DB, RouterGroup, RegisterBackups()

## Knowledge Gaps
- **266 isolated node(s):** `$schema`, `config:recommended`, `timezone`, `dependencies`, `rangeStrategy` (+261 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `InternalServerError()` connect `Community 28` to `Community 1`, `Community 3`, `Community 7`, `Community 8`, `Community 11`, `Community 16`, `Community 19`, `Community 24`, `Community 25`, `Community 36`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 50`, `Community 52`, `Community 64`, `Community 71`, `Community 79`, `Community 97`, `Community 98`, `Community 99`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `Apps` connect `Community 0` to `Community 1`, `Community 35`, `Community 36`, `Community 8`, `Community 10`, `Community 44`, `Community 16`, `Community 25`, `Community 27`, `Community 57`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `StartRouter()` connect `Community 56` to `Community 1`, `Community 3`, `Community 101`, `Community 42`, `Community 43`, `Community 11`, `Community 52`, `Community 86`, `Community 22`, `Community 28`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 100 inferred relationships involving `InternalServerError()` (e.g. with `ValidateTokenDBEntry()` and `CreateUser()`) actually correct?**
  _`InternalServerError()` has 100 INFERRED edges - model-reasoned connections that need verification._
- **Are the 46 inferred relationships involving `StatusBadRequest()` (e.g. with `CreateUser()` and `DisableUser()`) actually correct?**
  _`StatusBadRequest()` has 46 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `config:recommended`, `timezone` to the rest of the system?**
  _266 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05308641975308642 - nodes in this community are weakly interconnected._