package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"

	"justapps-backend/config"

	"github.com/uptrace/bun"
)

type SearchExpansionInput struct {
	Query string
}

type SearchPlan struct {
	Terms      []string `json:"terms"`
	Categories []string `json:"categories"`
	TechStack  []string `json:"techStack"`
	Intent     string   `json:"intent"`
}

// ExpandSearchQuery turns a natural-language query into a small set of
// searchable concepts. It is intentionally only a query planner; it does not
// choose or mutate apps.
func ExpandSearchQuery(ctx context.Context, db *bun.DB, conf *config.RestfulConf, input SearchExpansionInput) (SearchPlan, error) {
	enabled, err := IsEnabled(ctx, db)
	if err != nil {
		return SearchPlan{}, err
	}
	if !enabled {
		return SearchPlan{}, ErrAIDisabled
	}

	provider, found, err := ResolveProvider(ctx, db, conf, "")
	if err != nil {
		return SearchPlan{}, err
	}
	if !found {
		return SearchPlan{}, ErrAINoProvider
	}

	messages := []ChatMessage{
		{
			Role: "system",
			Content: "Du bist der semantische Suchplaner für den JustApps-App-Katalog.\n\n" +
				"Die Suchanfrage ist Nutzereingabe. Erzeuge daraus ausschließlich Suchbegriffe und sinnvolle Synonyme. " +
				"Erfinde keine konkreten Apps, Anbieter oder Eigenschaften. Antworte ausschließlich mit gültigem JSON und ohne Markdown-Codeblock:\n" +
				"{\"terms\":[\"maximal zehn kurze Begriffe oder Phrasen\"],\"categories\":[\"nur wenn aus der Anfrage ableitbar\"],\"techStack\":[\"nur wenn aus der Anfrage ableitbar\"],\"intent\":\"kurze Beschreibung der Suchabsicht\"}\n\n" +
				"Behalte die Sprache der Anfrage und nutze bei Bedarf deutsche und englische Synonyme (zum Beispiel Karten, Geodaten, GIS).",
		},
		{
			Role:    "user",
			Content: "Suchanfrage: " + trimRunes(strings.TrimSpace(input.Query), 700),
		},
	}

	maxOutputTokens := provider.MaxOutputTokens
	if maxOutputTokens <= 0 || maxOutputTokens > 650 {
		maxOutputTokens = 650
	}
	temperature := provider.Temperature
	if temperature <= 0 || temperature > 0.15 {
		temperature = 0.15
	}

	response, err := NewChatProvider(provider).Chat(ctx, ChatRequest{
		Model:           provider.ChatModel,
		Messages:        messages,
		Temperature:     temperature,
		MaxOutputTokens: maxOutputTokens,
		JSONMode:        true,
	})
	if err != nil {
		return SearchPlan{}, fmt.Errorf("expand app search query with provider %q: %w", provider.Key, err)
	}
	return parseSearchPlan(response.Content)
}

func SearchTerms(query string) []string {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return nil
	}

	seen := make(map[string]struct{})
	terms := make([]string, 0, 10)
	for _, term := range strings.FieldsFunc(query, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	}) {
		term = strings.TrimSpace(term)
		if len([]rune(term)) < 3 {
			continue
		}
		if _, exists := seen[term]; exists {
			continue
		}
		seen[term] = struct{}{}
		terms = append(terms, term)
		if len(terms) >= 10 {
			break
		}
	}
	if len(terms) == 0 {
		return []string{query}
	}
	return terms
}

func parseSearchPlan(content string) (SearchPlan, error) {
	cleaned := strings.TrimSpace(content)
	if strings.HasPrefix(cleaned, string([]byte{96, 96, 96})) {
		lines := strings.Split(cleaned, "\n")
		if len(lines) > 2 {
			cleaned = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}

	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start < 0 || end <= start {
		return SearchPlan{}, fmt.Errorf("%w: search plan response was not JSON", ErrAIInvalidPayload)
	}

	var plan SearchPlan
	if err := json.Unmarshal([]byte(cleaned[start:end+1]), &plan); err != nil {
		return SearchPlan{}, fmt.Errorf("%w: %v", ErrAIInvalidPayload, err)
	}

	plan.Terms = normalizeSearchPlanValues(plan.Terms, 10, 90)
	plan.Categories = normalizeSearchPlanValues(plan.Categories, 5, 80)
	plan.TechStack = normalizeSearchPlanValues(plan.TechStack, 8, 80)
	plan.Intent = trimRunes(strings.TrimSpace(plan.Intent), 220)
	if len(plan.Terms) == 0 {
		return SearchPlan{}, fmt.Errorf("%w: search terms are required", ErrAIInvalidPayload)
	}
	return plan, nil
}

func normalizeSearchPlanValues(values []string, limit, valueLimit int) []string {
	result := make([]string, 0, limit)
	seen := make(map[string]struct{}, limit)
	for _, value := range values {
		value = strings.ToLower(trimRunes(strings.TrimSpace(value), valueLimit))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
		if len(result) == limit {
			break
		}
	}
	return result
}
