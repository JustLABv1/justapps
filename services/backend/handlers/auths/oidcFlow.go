package auths

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"justapps-backend/config"
	authfunc "justapps-backend/functions/auth"
	"justapps-backend/functions/httperror"
	"justapps-backend/pkg/models"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"golang.org/x/oauth2"
)

const oidcStateTokenType = "oidc_state"

type oidcStateClaims struct {
	ProviderKey string `json:"providerKey"`
	CallbackURL string `json:"callbackUrl"`
	Nonce       string `json:"nonce"`
	Type        string `json:"type"`
	jwt.RegisteredClaims
}

func StartOIDCLogin(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	if providerKey == "" {
		httperror.StatusBadRequest(c, "OIDC-Provider fehlt", errors.New("missing provider key"))
		return
	}

	provider, found, err := authfunc.ResolveOIDCProvider(c.Request.Context(), db, config.Config, providerKey)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht geladen werden", err)
		return
	}
	if !found {
		httperror.StatusNotFound(c, "OIDC-Provider ist nicht verfügbar", errors.New("provider not found"))
		return
	}

	callbackURL := sanitizeCallbackURL(c.Query("callbackUrl"))
	stateToken, err := buildOIDCStateToken(provider.Key, callbackURL)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-State konnte nicht erstellt werden", err)
		return
	}

	oauthConfig, err := buildProviderOAuthConfig(c, provider)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht initialisiert werden", err)
		return
	}

	authURL := oauthConfig.AuthCodeURL(stateToken, oauth2.AccessTypeOnline)
	c.Redirect(http.StatusFound, authURL)
}

func HandleOIDCCallback(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	stateToken := strings.TrimSpace(c.Query("state"))
	code := strings.TrimSpace(c.Query("code"))

	if providerKey == "" || stateToken == "" || code == "" {
		redirectOIDCError(c, "/", "Ungültiger OIDC-Callback")
		return
	}

	stateClaims, err := parseOIDCStateToken(stateToken)
	if err != nil {
		redirectOIDCError(c, "/", "OIDC-Status ungültig oder abgelaufen")
		return
	}
	if !strings.EqualFold(stateClaims.ProviderKey, providerKey) {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider passt nicht zum Callback")
		return
	}

	provider, found, err := authfunc.ResolveOIDCProvider(c.Request.Context(), db, config.Config, providerKey)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider konnte nicht geladen werden")
		return
	}
	if !found {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider ist nicht verfügbar")
		return
	}

	oauthConfig, err := buildProviderOAuthConfig(c, provider)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider konnte nicht initialisiert werden")
		return
	}

	providerClient, verifyCtx, err := oidcProviderContext(c.Request.Context(), provider)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider-Metadaten konnten nicht geladen werden")
		return
	}
	oauthToken, err := oauthConfig.Exchange(verifyCtx, code)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Codeaustausch fehlgeschlagen")
		return
	}

	rawIDToken, _ := oauthToken.Extra("id_token").(string)
	if strings.TrimSpace(rawIDToken) == "" {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-ID-Token fehlt")
		return
	}

	verifier := providerClient.Verifier(&oidc.Config{ClientID: provider.ClientID})
	idToken, err := verifier.Verify(verifyCtx, rawIDToken)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-ID-Token ungültig")
		return
	}

	claims, err := authfunc.GetOIDCClaims(idToken)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Claims konnten nicht gelesen werden")
		return
	}

	user, err := upsertOIDCUser(c, db, claims, provider.AdminGroup)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "Benutzer konnte nicht erstellt werden")
		return
	}

	sessionToken, _, err := authfunc.GenerateOIDCSessionJWT(user.Email, user.Username, user.Role)
	if err != nil {
		redirectOIDCError(c, sanitizeCallbackURL(stateClaims.CallbackURL), "Sitzung konnte nicht erstellt werden")
		return
	}

	values := url.Values{}
	values.Set("oidc_token", sessionToken)
	values.Set("callbackUrl", sanitizeCallbackURL(stateClaims.CallbackURL))
	values.Set("oidc_provider", provider.Key)
	c.Redirect(http.StatusFound, "/login?"+values.Encode())
}

func buildProviderOAuthConfig(c *gin.Context, provider authfunc.OIDCProviderRuntime) (*oauth2.Config, error) {
	providerClient, _, err := oidcProviderContext(c.Request.Context(), provider)
	if err != nil {
		return nil, err
	}
	oauthEndpoint := providerClient.Endpoint()
	redirectURL := requestBaseURL(c) + "/api/v1/auth/oidc/" + url.PathEscape(provider.Key) + "/callback"
	if strings.TrimSpace(oauthEndpoint.AuthURL) == "" || strings.TrimSpace(oauthEndpoint.TokenURL) == "" {
		return nil, errors.New("oidc endpoint metadata incomplete")
	}

	return &oauth2.Config{
		ClientID:     provider.ClientID,
		ClientSecret: provider.ClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       provider.Scopes,
		Endpoint:     oauthEndpoint,
	}, nil
}

func oidcProviderContext(ctx context.Context, provider authfunc.OIDCProviderRuntime) (*oidc.Provider, context.Context, error) {
	if provider.Insecure {
		transport := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}
		httpClient := &http.Client{Transport: transport}
		ctx = oidc.ClientContext(ctx, httpClient)
	}

	providerClient, err := oidc.NewProvider(ctx, provider.Issuer)
	if err != nil {
		return nil, ctx, err
	}
	return providerClient, ctx, nil
}

func requestBaseURL(c *gin.Context) string {
	proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	return proto + "://" + host
}

func sanitizeCallbackURL(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || !strings.HasPrefix(trimmed, "/") || strings.HasPrefix(trimmed, "//") {
		return "/"
	}
	return trimmed
}

func buildOIDCStateToken(providerKey, callbackURL string) (string, error) {
	nonce, err := randomNonce()
	if err != nil {
		return "", err
	}

	now := time.Now()
	claims := oidcStateClaims{
		ProviderKey: providerKey,
		CallbackURL: sanitizeCallbackURL(callbackURL),
		Nonce:       nonce,
		Type:        oidcStateTokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.Config.JWT.Secret))
}

func parseOIDCStateToken(value string) (*oidcStateClaims, error) {
	token, err := jwt.ParseWithClaims(value, &oidcStateClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(config.Config.JWT.Secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*oidcStateClaims)
	if !ok || !token.Valid || claims.Type != oidcStateTokenType {
		return nil, errors.New("invalid oidc state token")
	}
	return claims, nil
}

func randomNonce() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func redirectOIDCError(c *gin.Context, callbackURL, message string) {
	values := url.Values{}
	values.Set("oidc_error", message)
	values.Set("callbackUrl", sanitizeCallbackURL(callbackURL))
	c.Redirect(http.StatusFound, "/login?"+values.Encode())
}

func upsertOIDCUser(c *gin.Context, db *bun.DB, claims *authfunc.OIDCClaims, adminGroup string) (models.Users, error) {
	role := "user"
	if authfunc.IsAdminOIDCWithGroup(claims, adminGroup) {
		role = "admin"
	}

	username := claims.PreferredUser
	if strings.TrimSpace(username) == "" {
		username = claims.Email
	}

	var user models.Users
	exists, err := db.NewSelect().Model(&user).Where("email = ?", claims.Email).Exists(c)
	if err != nil {
		return models.Users{}, err
	}

	if !exists {
		user = models.Users{
			Email:         claims.Email,
			Username:      username,
			Role:          role,
			AuthType:      "oidc",
			CanSubmitApps: true,
		}
		if err := user.HashPassword(uuid.NewString()); err != nil {
			return models.Users{}, err
		}
		if _, err := db.NewInsert().Model(&user).Column("email", "username", "password", "role", "auth_type", "can_submit_apps").Exec(c); err != nil {
			return models.Users{}, err
		}
		if err := db.NewSelect().Model(&user).Where("email = ?", claims.Email).Scan(c); err != nil {
			return models.Users{}, err
		}
		return user, nil
	}

	if err := db.NewSelect().Model(&user).Where("email = ?", claims.Email).Scan(c); err != nil {
		return models.Users{}, err
	}
	if user.Disabled {
		return models.Users{}, errors.New("account disabled")
	}

	updates := map[string]any{}
	if user.AuthType != "oidc" {
		updates["auth_type"] = "oidc"
	}
	if strings.TrimSpace(user.Username) == "" && strings.TrimSpace(username) != "" {
		updates["username"] = username
	}
	if len(updates) > 0 {
		query := db.NewUpdate().Model((*models.Users)(nil)).Where("id = ?", user.ID)
		for col, val := range updates {
			query = query.Set(col+" = ?", val)
		}
		if _, err := query.Exec(c); err != nil {
			return models.Users{}, err
		}
		if err := db.NewSelect().Model(&user).Where("id = ?", user.ID).Scan(c); err != nil {
			return models.Users{}, err
		}
	}

	return user, nil
}
