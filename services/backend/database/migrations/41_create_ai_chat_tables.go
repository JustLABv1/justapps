package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 41: creating AI chat tables...")

		statements := []string{
			`CREATE TABLE IF NOT EXISTS ai_provider_settings (
				provider_key TEXT PRIMARY KEY,
				provider_type TEXT NOT NULL DEFAULT 'openai-compatible',
				label TEXT NOT NULL DEFAULT '',
				base_url TEXT NOT NULL DEFAULT '',
				api_path TEXT NOT NULL DEFAULT '',
				api_version TEXT NOT NULL DEFAULT '',
				region TEXT NOT NULL DEFAULT '',
				organization TEXT NOT NULL DEFAULT '',
				chat_model TEXT NOT NULL DEFAULT '',
				embedding_model TEXT NOT NULL DEFAULT '',
				encrypted_token TEXT NOT NULL DEFAULT '',
				token_nonce TEXT NOT NULL DEFAULT '',
				token_key_version TEXT NOT NULL DEFAULT 'v1',
				token_configured BOOLEAN NOT NULL DEFAULT false,
				enabled BOOLEAN NOT NULL DEFAULT true,
				is_default BOOLEAN NOT NULL DEFAULT false,
				timeout_seconds INTEGER NOT NULL DEFAULT 30,
				max_context_tokens INTEGER NOT NULL DEFAULT 6000,
				max_output_tokens INTEGER NOT NULL DEFAULT 1200,
				temperature DOUBLE PRECISION NOT NULL DEFAULT 0.2,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_settings_single_default_idx ON ai_provider_settings (is_default) WHERE is_default = true`,
			`CREATE TABLE IF NOT EXISTS ai_conversations (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				title TEXT NOT NULL DEFAULT '',
				scope_type TEXT NOT NULL DEFAULT '',
				app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx ON ai_conversations (user_id, updated_at DESC)`,
			`CREATE TABLE IF NOT EXISTS ai_messages (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
				role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
				content TEXT NOT NULL,
				provider_key TEXT NOT NULL DEFAULT '',
				provider_type TEXT NOT NULL DEFAULT '',
				model TEXT NOT NULL DEFAULT '',
				prompt_tokens INTEGER NOT NULL DEFAULT 0,
				response_tokens INTEGER NOT NULL DEFAULT 0,
				sources JSONB NOT NULL DEFAULT '[]',
				error TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx ON ai_messages (conversation_id, created_at ASC)`,
			`CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
				app_name TEXT NOT NULL DEFAULT '',
				source_type TEXT NOT NULL,
				source_id TEXT NOT NULL,
				title TEXT NOT NULL DEFAULT '',
				content TEXT NOT NULL,
				search_text TEXT NOT NULL DEFAULT '',
				metadata JSONB NOT NULL DEFAULT '{}',
				content_hash TEXT NOT NULL,
				source_updated_at TIMESTAMPTZ,
				indexed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_chunks_unique_content_idx ON ai_knowledge_chunks (app_id, source_type, source_id, content_hash)`,
			`CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_app_idx ON ai_knowledge_chunks (app_id)`,
			`CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_search_idx ON ai_knowledge_chunks USING GIN (to_tsvector('simple', search_text))`,
		}

		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return fmt.Errorf("migration 41: %w", err)
			}
		}

		fmt.Println("Migration 41: done.")
		return nil
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Println("Migration 41 rollback: dropping AI chat tables...")
		statements := []string{
			`DROP TABLE IF EXISTS ai_knowledge_chunks`,
			`DROP TABLE IF EXISTS ai_messages`,
			`DROP TABLE IF EXISTS ai_conversations`,
			`DROP TABLE IF EXISTS ai_provider_settings`,
		}
		for _, statement := range statements {
			if _, err := db.ExecContext(ctx, statement); err != nil {
				return err
			}
		}
		return nil
	})
}
