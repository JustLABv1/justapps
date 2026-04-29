# AI Chat

JustApps includes an authenticated AI Chat that answers questions about catalog apps, deployment options, repository-synced README content, Helm values, Compose files, tags and descriptions.

The chat is available as:

- a global floating widget for signed-in users
- a dedicated `/chat` page
- contextual app detail entry points that scope retrieval to the current app

## Providers

Admins configure providers in **Verwaltung -> Einstellungen -> AI**. Supported provider types are:

| Type | Notes |
|------|-------|
| `openai` | OpenAI Chat Completions API |
| `azure-openai` | Azure OpenAI deployment endpoint |
| `anthropic` | Claude Messages API |
| `gemini` | Google Gemini generateContent API |
| `mistral` | Mistral chat API |
| `cohere` | Cohere chat API |
| `openrouter` | OpenRouter OpenAI-compatible API |
| `together` | Together OpenAI-compatible API |
| `openai-compatible` | Generic OpenAI-compatible endpoint |
| `vllm` | Local or hosted vLLM OpenAI-compatible endpoint |
| `ollama` | Local Ollama `/api/chat` endpoint |
| `lmstudio` | Local LM Studio OpenAI-compatible endpoint |

Tokens are encrypted before they are stored. The same backend secret used for repository provider tokens, `repository_provider_encryption.secret` or `BACKEND_REPOSITORY_PROVIDER_ENCRYPTION_SECRET`, protects AI provider tokens too.

## Local Provider Examples

### vLLM

Configure a provider with:

| Field | Example |
|-------|---------|
| Type | `vllm` |
| Base URL | `http://localhost:8000/v1` |
| Chat model | the served model name, for example `meta-llama/Llama-3.1-8B-Instruct` |
| API key | optional, depending on your vLLM server |

### Ollama

Configure a provider with:

| Field | Example |
|-------|---------|
| Type | `ollama` |
| Base URL | `http://localhost:11434` |
| Chat model | `llama3.1` |
| API key | leave empty |

When JustApps runs in Docker or Kubernetes, `localhost` is the backend container or pod. Use a reachable service DNS name or host gateway address for local model servers.

## Knowledge Index

JustApps builds AI knowledge chunks from app metadata and synced repository content. The index includes:

- app names, summaries, categories, tags and custom fields
- README markdown from repository sync
- Helm values, Compose files and deployment commands
- app links, version information and changelog content

The index is refreshed automatically when apps are created, updated, deleted, or when repository sync applies a new snapshot. Admins can manually rebuild it from **Verwaltung -> Einstellungen -> AI**.

Knowledge chunks are derived data and are not exported in backups. After a restore, use the manual reindex action if apps were restored from a backup.

## Privacy and Access

AI Chat requires a signed-in user. Retrieval respects app visibility: draft apps are only included for admins or their owners. Provider API keys are never returned to the frontend after saving.

## Backups

Backup exports include two AI sections:

| Section | Contents |
|---------|----------|
| `aiProviders` | Provider settings and encrypted token material |
| `aiConversations` | Chat conversations and stored messages |

The `aiConversations` section can contain user prompts and assistant responses, so treat backup files as sensitive even though `.jabackup` exports are encrypted with a passphrase.
