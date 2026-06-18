package auths

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
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
	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
	"golang.org/x/oauth2"
)

const oidcStateTokenType = "oidc_state"
const oidcPKCECookieBase = "oidc_pkce"

type oidcStateClaims struct {
	ProviderKey    string `json:"providerKey"`
	CallbackURL    string `json:"callbackUrl"`
	FrontendOrigin string `json:"frontendOrigin"`
	Nonce          string `json:"nonce"`
	CodeVerifier   string `json:"codeVerifier"`
	Type           string `json:"type"`
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
	codeVerifier := oauth2.GenerateVerifier()
	stateToken, err := buildOIDCStateToken(provider.Key, callbackURL, resolveFrontendOrigin(c), codeVerifier)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-State konnte nicht erstellt werden", err)
		return
	}
	stateClaims, err := parseOIDCStateToken(stateToken)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-State konnte nicht erstellt werden", err)
		return
	}

	if err := setOIDCPKCECookie(c, provider.Key, stateClaims.Nonce, codeVerifier); err != nil {
		httperror.InternalServerError(c, "OIDC-PKCE konnte nicht vorbereitet werden", err)
		return
	}

	oauthConfig, err := buildProviderOAuthConfig(c, provider)
	if err != nil {
		httperror.InternalServerError(c, "OIDC-Provider konnte nicht initialisiert werden", err)
		return
	}

	authURL := oauthConfig.AuthCodeURL(
		stateToken,
		oauth2.AccessTypeOnline,
		oauth2.S256ChallengeOption(codeVerifier),
	)
	c.Redirect(http.StatusFound, authURL)
}

func HandleOIDCCallback(c *gin.Context, db *bun.DB) {
	providerKey := strings.TrimSpace(c.Param("key"))
	stateToken := strings.TrimSpace(c.Query("state"))
	code := strings.TrimSpace(c.Query("code"))
	callbackError := strings.TrimSpace(c.Query("error"))
	callbackErrorDescription := strings.TrimSpace(c.Query("error_description"))

	if callbackError != "" {
		errMsg := "OIDC-Anmeldung wurde abgebrochen"
		if callbackErrorDescription != "" {
			errMsg = callbackErrorDescription
		} else if callbackError != "" {
			errMsg = callbackError
		}

		if providerKey == "" || stateToken == "" {
			redirectOIDCError(c, "", "/", errMsg)
			return
		}

		stateClaims, err := parseOIDCStateToken(stateToken)
		if err != nil {
			redirectOIDCError(c, "", "/", errMsg)
			return
		}
		clearOIDCPKCECookie(c, providerKey)
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), errMsg)
		return
	}

	if providerKey == "" || stateToken == "" || code == "" {
		redirectOIDCError(c, "", "/", "Ungültiger OIDC-Callback")
		return
	}

	stateClaims, err := parseOIDCStateToken(stateToken)
	if err != nil {
		redirectOIDCError(c, "", "/", "OIDC-Status ungültig oder abgelaufen")
		return
	}
	if !strings.EqualFold(stateClaims.ProviderKey, providerKey) {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider passt nicht zum Callback")
		return
	}

	codeVerifier, err := getOIDCPKCEVerifier(c, providerKey, stateClaims.Nonce)
	if err != nil {
		log.WithError(err).WithField("providerKey", providerKey).Warn("OIDC: PKCE cookie missing or invalid, falling back to state verifier")
		if strings.TrimSpace(stateClaims.CodeVerifier) == "" {
			redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Status ungültig oder abgelaufen")
			return
		}
		codeVerifier = stateClaims.CodeVerifier
	}
	clearOIDCPKCECookie(c, providerKey)

	provider, found, err := authfunc.ResolveOIDCProvider(c.Request.Context(), db, config.Config, providerKey)
	if err != nil {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider konnte nicht geladen werden")
		return
	}
	if !found {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider ist nicht verfügbar")
		return
	}

	oauthConfig, err := buildProviderOAuthConfig(c, provider)
	if err != nil {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider konnte nicht initialisiert werden")
		return
	}

	providerClient, verifyCtx, err := oidcProviderContext(c.Request.Context(), provider)
	if err != nil {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Provider-Metadaten konnten nicht geladen werden")
		return
	}
	oauthToken, err := oauthConfig.Exchange(verifyCtx, code, oauth2.VerifierOption(codeVerifier))
	if err != nil {
		if isOIDCClientAuthError(err) {
			retryConfig := *oauthConfig
			retryConfig.Endpoint = oauthConfig.Endpoint
			retryConfig.Endpoint.AuthStyle = oauth2.AuthStyleInParams
			oauthToken, err = retryConfig.Exchange(verifyCtx, code, oauth2.VerifierOption(codeVerifier))
		}
	}
	if err != nil {
		log.WithError(err).WithFields(log.Fields{
			"providerKey": providerKey,
			"issuer":      provider.Issuer,
			"redirectURL": oauthConfig.RedirectURL,
		}).Warn("OIDC: code exchange failed")
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Codeaustausch fehlgeschlagen")
		return
	}

	rawIDToken, _ := oauthToken.Extra("id_token").(string)
	if strings.TrimSpace(rawIDToken) == "" {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-ID-Token fehlt")
		return
	}

	verifier := providerClient.Verifier(&oidc.Config{ClientID: provider.ClientID})
	idToken, err := verifier.Verify(verifyCtx, rawIDToken)
	if err != nil {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-ID-Token ungültig")
		return
	}

	claims, err := authfunc.GetOIDCClaims(idToken)
	if err != nil {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "OIDC-Claims konnten nicht gelesen werden")
		return
	}

	user, err := upsertOIDCUser(c, db, claims, provider.AdminGroup)
	if err != nil {
		log.WithError(err).WithField("email", claims.Email).Warn("OIDC: user provisioning failed")
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "Benutzer konnte nicht erstellt werden")
		return
	}

	sessionToken, _, err := authfunc.GenerateOIDCSessionJWT(user.Email, user.Username, user.Role)
	if err != nil {
		redirectOIDCError(c, stateClaims.FrontendOrigin, sanitizeCallbackURL(stateClaims.CallbackURL), "Sitzung konnte nicht erstellt werden")
		return
	}

	values := url.Values{}
	values.Set("oidc_token", sessionToken)
	values.Set("callbackUrl", sanitizeCallbackURL(stateClaims.CallbackURL))
	values.Set("oidc_provider", provider.Key)
	c.Redirect(http.StatusFound, buildLoginRedirectURL(stateClaims.FrontendOrigin, values))
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

func buildOIDCStateToken(providerKey, callbackURL, frontendOrigin, codeVerifier string) (string, error) {
	nonce, err := randomNonce()
	if err != nil {
		return "", err
	}

	now := time.Now()
	claims := oidcStateClaims{
		ProviderKey:    providerKey,
		CallbackURL:    sanitizeCallbackURL(callbackURL),
		FrontendOrigin: sanitizeOriginURL(frontendOrigin),
		Nonce:          nonce,
		CodeVerifier:   codeVerifier,
		Type:           oidcStateTokenType,
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

type oidcPKCECookieClaims struct {
	Nonce    string `json:"nonce"`
	Verifier string `json:"verifier"`
}

func oidcPKCECookieName(providerKey string) string {
	normalized := strings.ToLower(strings.TrimSpace(providerKey))
	if normalized == "" {
		normalized = "default"
	}
	b := strings.Builder{}
	b.Grow(len(normalized))
	for _, r := range normalized {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
			continue
		}
		b.WriteRune('_')
	}
	return oidcPKCECookieBase + "_" + b.String()
}

func setOIDCPKCECookie(c *gin.Context, providerKey, nonce, verifier string) error {
	payload := oidcPKCECookieClaims{Nonce: nonce, Verifier: verifier}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	encoded := base64.RawURLEncoding.EncodeToString(raw)
	secure := strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")), "https") || c.Request.TLS != nil
	c.SetCookie(oidcPKCECookieName(providerKey), encoded, 10*60, "/", "", secure, true)
	return nil
}

func getOIDCPKCEVerifier(c *gin.Context, providerKey, expectedNonce string) (string, error) {
	rawCookie, err := c.Cookie(oidcPKCECookieName(providerKey))
	if err != nil {
		return "", err
	}
	decoded, err := base64.RawURLEncoding.DecodeString(rawCookie)
	if err != nil {
		return "", err
	}
	var payload oidcPKCECookieClaims
	if err := json.Unmarshal(decoded, &payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.Nonce) == "" || strings.TrimSpace(payload.Verifier) == "" {
		return "", errors.New("invalid oidc pkce cookie")
	}
	if payload.Nonce != expectedNonce {
		return "", errors.New("oidc pkce nonce mismatch")
	}
	return payload.Verifier, nil
}

func clearOIDCPKCECookie(c *gin.Context, providerKey string) {
	secure := strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")), "https") || c.Request.TLS != nil
	c.SetCookie(oidcPKCECookieName(providerKey), "", -1, "/", "", secure, true)
}

func redirectOIDCError(c *gin.Context, frontendOrigin, callbackURL, message string) {
	values := url.Values{}
	values.Set("oidc_error", message)
	values.Set("callbackUrl", sanitizeCallbackURL(callbackURL))
	c.Redirect(http.StatusFound, buildLoginRedirectURL(frontendOrigin, values))
}

func sanitizeOriginURL(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	parsed.Path = ""
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/")
}

func resolveFrontendOrigin(c *gin.Context) string {
	if value := sanitizeOriginURL(c.GetHeader("X-Frontend-Origin")); value != "" {
		return value
	}
	if value := sanitizeOriginURL(c.GetHeader("Origin")); value != "" {
		return value
	}
	referer := strings.TrimSpace(c.GetHeader("Referer"))
	if referer == "" {
		return ""
	}
	parsed, err := url.Parse(referer)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return sanitizeOriginURL(parsed.Scheme + "://" + parsed.Host)
}

func buildLoginRedirectURL(frontendOrigin string, values url.Values) string {
	query := values.Encode()
	origin := sanitizeOriginURL(frontendOrigin)
	if origin == "" {
		return "/login?" + query
	}
	return origin + "/login?" + query
}

func isOIDCClientAuthError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unauthorized_client") ||
		strings.Contains(msg, "invalid_client") ||
		strings.Contains(msg, "invalid client credentials")
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
	if err := reactivateOIDCUserDisabledBySafeRestore(c, db, &user); err != nil {
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

func reactivateOIDCUserDisabledBySafeRestore(ctx context.Context, db *bun.DB, user *models.Users) error {
	if !shouldReactivateOIDCUserDisabledBySafeRestore(user) {
		return nil
	}

	if _, err := db.NewUpdate().Model((*models.Users)(nil)).
		Set("disabled = false").
		Set("disabled_reason = ''").
		Where("id = ?", user.ID).
		Exec(ctx); err != nil {
		return err
	}
	user.Disabled = false
	user.DisabledReason = ""
	return nil
}

func shouldReactivateOIDCUserDisabledBySafeRestore(user *models.Users) bool {
	return user != nil &&
		user.Disabled &&
		strings.EqualFold(strings.TrimSpace(user.AuthType), "oidc") &&
		strings.TrimSpace(user.DisabledReason) == models.RestoredSafeBackupPasswordResetReason
}
