package ai

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

const providerTokenKeyVersion = "v1"

var (
	errAIProviderEncryptionSecretMissing = errors.New("ai provider encryption secret is missing")
	errAIProviderTokenInvalid            = errors.New("ai provider token could not be decrypted or verified")
)

func EncryptProviderToken(conf *config.RestfulConf, plaintext string) (string, string, string, error) {
	secret, err := providerEncryptionSecret(conf)
	if err != nil {
		return "", "", "", err
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", "", "", fmt.Errorf("create ai provider token cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", "", fmt.Errorf("create ai provider token AEAD: %w", err)
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", "", fmt.Errorf("generate ai provider token nonce: %w", err)
	}

	ciphertext := aead.Seal(nil, nonce, []byte(plaintext), nil)
	return base64.RawStdEncoding.EncodeToString(ciphertext), base64.RawStdEncoding.EncodeToString(nonce), providerTokenKeyVersion, nil
}

func DecryptProviderToken(conf *config.RestfulConf, encryptedToken, tokenNonce, keyVersion string) (string, error) {
	if strings.TrimSpace(encryptedToken) == "" || strings.TrimSpace(tokenNonce) == "" {
		return "", nil
	}
	if strings.TrimSpace(keyVersion) != "" && strings.TrimSpace(keyVersion) != providerTokenKeyVersion {
		return "", fmt.Errorf("unsupported ai provider token key version %q", keyVersion)
	}

	secret, err := providerEncryptionSecret(conf)
	if err != nil {
		return "", err
	}

	ciphertext, err := base64.RawStdEncoding.DecodeString(encryptedToken)
	if err != nil {
		return "", errAIProviderTokenInvalid
	}
	nonce, err := base64.RawStdEncoding.DecodeString(tokenNonce)
	if err != nil {
		return "", errAIProviderTokenInvalid
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", fmt.Errorf("create ai provider token cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create ai provider token AEAD: %w", err)
	}
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errAIProviderTokenInvalid
	}

	return string(plaintext), nil
}

func providerEncryptionSecret(conf *config.RestfulConf) ([]byte, error) {
	if conf == nil {
		return nil, errAIProviderEncryptionSecretMissing
	}
	secret := strings.TrimSpace(conf.RepositoryProviderEncryption.Secret)
	if secret == "" {
		return nil, errAIProviderEncryptionSecretMissing
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:], nil
}
