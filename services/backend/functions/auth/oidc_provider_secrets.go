package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	"justapps-backend/config"
)

const oidcProviderSecretKeyVersion = "v1"

var (
	errOIDCProviderEncryptionSecretMissing = errors.New("oidc provider encryption secret is missing")
	errOIDCProviderSecretInvalid           = errors.New("oidc provider secret could not be decrypted or verified")
)

func EncryptOIDCProviderSecret(conf *config.RestfulConf, plaintext string) (string, string, string, error) {
	secret, err := oidcProviderEncryptionSecret(conf)
	if err != nil {
		return "", "", "", err
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", "", "", fmt.Errorf("create oidc provider secret cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", "", fmt.Errorf("create oidc provider secret AEAD: %w", err)
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", "", fmt.Errorf("generate oidc provider nonce: %w", err)
	}

	ciphertext := aead.Seal(nil, nonce, []byte(plaintext), nil)
	return base64.RawStdEncoding.EncodeToString(ciphertext), base64.RawStdEncoding.EncodeToString(nonce), oidcProviderSecretKeyVersion, nil
}

func DecryptOIDCProviderSecret(conf *config.RestfulConf, encryptedSecret, secretNonce, keyVersion string) (string, error) {
	if strings.TrimSpace(encryptedSecret) == "" || strings.TrimSpace(secretNonce) == "" {
		return "", nil
	}
	if strings.TrimSpace(keyVersion) != "" && strings.TrimSpace(keyVersion) != oidcProviderSecretKeyVersion {
		return "", fmt.Errorf("unsupported oidc provider secret key version %q", keyVersion)
	}

	secret, err := oidcProviderEncryptionSecret(conf)
	if err != nil {
		return "", err
	}

	ciphertext, err := base64.RawStdEncoding.DecodeString(encryptedSecret)
	if err != nil {
		return "", errOIDCProviderSecretInvalid
	}
	nonce, err := base64.RawStdEncoding.DecodeString(secretNonce)
	if err != nil {
		return "", errOIDCProviderSecretInvalid
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", fmt.Errorf("create oidc provider secret cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create oidc provider secret AEAD: %w", err)
	}
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errOIDCProviderSecretInvalid
	}

	return string(plaintext), nil
}

func oidcProviderEncryptionSecret(conf *config.RestfulConf) ([]byte, error) {
	if conf == nil {
		return nil, errOIDCProviderEncryptionSecretMissing
	}
	secret := strings.TrimSpace(conf.RepositoryProviderEncryption.Secret)
	if secret == "" {
		return nil, errOIDCProviderEncryptionSecretMissing
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:], nil
}
