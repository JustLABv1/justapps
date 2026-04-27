package gitlab

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
	errProviderEncryptionSecretMissing = errors.New("repository provider encryption secret is missing")
	errProviderTokenInvalid            = errors.New("repository provider token could not be decrypted or verified")
)

func EncryptProviderToken(conf *config.RestfulConf, plaintext string) (string, string, string, error) {
	secret, err := providerEncryptionSecret(conf)
	if err != nil {
		return "", "", "", err
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", "", "", fmt.Errorf("create provider token cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", "", fmt.Errorf("create provider token AEAD: %w", err)
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", "", fmt.Errorf("generate provider token nonce: %w", err)
	}

	ciphertext := aead.Seal(nil, nonce, []byte(plaintext), nil)
	return base64.RawStdEncoding.EncodeToString(ciphertext), base64.RawStdEncoding.EncodeToString(nonce), providerTokenKeyVersion, nil
}

func DecryptProviderToken(conf *config.RestfulConf, encryptedToken, tokenNonce, keyVersion string) (string, error) {
	if strings.TrimSpace(encryptedToken) == "" || strings.TrimSpace(tokenNonce) == "" {
		return "", nil
	}
	if strings.TrimSpace(keyVersion) != "" && strings.TrimSpace(keyVersion) != providerTokenKeyVersion {
		return "", fmt.Errorf("unsupported provider token key version %q", keyVersion)
	}

	secret, err := providerEncryptionSecret(conf)
	if err != nil {
		return "", err
	}

	ciphertext, err := base64.RawStdEncoding.DecodeString(encryptedToken)
	if err != nil {
		return "", errProviderTokenInvalid
	}
	nonce, err := base64.RawStdEncoding.DecodeString(tokenNonce)
	if err != nil {
		return "", errProviderTokenInvalid
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", fmt.Errorf("create provider token cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create provider token AEAD: %w", err)
	}
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errProviderTokenInvalid
	}

	return string(plaintext), nil
}

func providerEncryptionSecret(conf *config.RestfulConf) ([]byte, error) {
	if conf == nil {
		return nil, errProviderEncryptionSecretMissing
	}
	secret := strings.TrimSpace(conf.RepositoryProviderEncryption.Secret)
	if secret == "" {
		return nil, errProviderEncryptionSecretMissing
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:], nil
}
