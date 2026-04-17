package backups

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"
	"unicode/utf8"

	"justapps-backend/pkg/models"

	"golang.org/x/crypto/argon2"
)

const (
	backupContainerFormat    = "justapps.backup"
	backupContainerVersion   = "1"
	backupCipherName         = "AES-256-GCM"
	backupKDFName            = "argon2id"
	backupPassphraseMinRunes = 12
	backupKeyLength          = 32
	backupArgonIterations    = 3
	backupArgonMemoryKiB     = 64 * 1024
	backupArgonParallelism   = 4
	backupSaltLength         = 16
)

var errEncryptedBackupInvalid = errors.New("backup payload could not be decrypted or verified")

type backupContainerAAD struct {
	Format     string                      `json:"format"`
	Version    string                      `json:"version"`
	Encrypted  bool                        `json:"encrypted"`
	ExportedAt string                      `json:"exportedAt"`
	KDF        models.BackupKDFMetadata    `json:"kdf"`
	Cipher     models.BackupCipherMetadata `json:"cipher"`
}

func validateBackupPassphrase(passphrase string) error {
	if utf8.RuneCountInString(passphrase) < backupPassphraseMinRunes || passphrase == "" {
		return fmt.Errorf("backup passphrase must be at least %d characters", backupPassphraseMinRunes)
	}
	return nil
}

func encryptBackupManifest(manifest models.BackupManifest, passphrase string) ([]byte, error) {
	if err := validateBackupPassphrase(passphrase); err != nil {
		return nil, err
	}

	plaintext, err := json.Marshal(manifest)
	if err != nil {
		return nil, err
	}

	salt := make([]byte, backupSaltLength)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	key := argon2.IDKey([]byte(passphrase), salt, backupArgonIterations, backupArgonMemoryKiB, backupArgonParallelism, backupKeyLength)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	container := models.EncryptedBackupContainer{
		Format:     backupContainerFormat,
		Version:    backupContainerVersion,
		Encrypted:  true,
		ExportedAt: manifest.ExportedAt,
		KDF: models.BackupKDFMetadata{
			Name:        backupKDFName,
			Salt:        base64.RawStdEncoding.EncodeToString(salt),
			Iterations:  backupArgonIterations,
			MemoryKiB:   backupArgonMemoryKiB,
			Parallelism: backupArgonParallelism,
			KeyLength:   backupKeyLength,
		},
		Cipher: models.BackupCipherMetadata{
			Name:  backupCipherName,
			Nonce: base64.RawStdEncoding.EncodeToString(nonce),
		},
	}

	aad, err := marshalBackupContainerAAD(container)
	if err != nil {
		return nil, err
	}

	container.Payload = base64.RawStdEncoding.EncodeToString(aead.Seal(nil, nonce, plaintext, aad))
	return json.MarshalIndent(container, "", "  ")
}

func decodeBackupPayload(payload []byte, passphrase string) (models.BackupManifest, []string, error) {
	var container models.EncryptedBackupContainer
	if err := json.Unmarshal(payload, &container); err == nil && container.Format == backupContainerFormat {
		manifest, err := decryptBackupContainer(container, passphrase)
		if err != nil {
			return models.BackupManifest{}, nil, err
		}
		return manifest, nil, nil
	}

	var manifest models.BackupManifest
	if err := json.Unmarshal(payload, &manifest); err != nil {
		return models.BackupManifest{}, nil, errors.New("invalid backup payload")
	}
	return manifest, []string{"Imported a legacy unencrypted backup. Re-export it with a passphrase after restore."}, nil
}

func decryptBackupContainer(container models.EncryptedBackupContainer, passphrase string) (models.BackupManifest, error) {
	if container.Format != backupContainerFormat || !container.Encrypted {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	if passphrase == "" {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	if container.KDF.Name != backupKDFName || container.Cipher.Name != backupCipherName {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}

	salt, err := base64.RawStdEncoding.DecodeString(container.KDF.Salt)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	nonce, err := base64.RawStdEncoding.DecodeString(container.Cipher.Nonce)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	ciphertext, err := base64.RawStdEncoding.DecodeString(container.Payload)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}

	key := argon2.IDKey([]byte(passphrase), salt, container.KDF.Iterations, container.KDF.MemoryKiB, container.KDF.Parallelism, container.KDF.KeyLength)
	block, err := aes.NewCipher(key)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	aad, err := marshalBackupContainerAAD(container)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	plaintext, err := aead.Open(nil, nonce, ciphertext, aad)
	if err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}

	var manifest models.BackupManifest
	if err := json.Unmarshal(plaintext, &manifest); err != nil {
		return models.BackupManifest{}, errEncryptedBackupInvalid
	}
	return manifest, nil
}

func marshalBackupContainerAAD(container models.EncryptedBackupContainer) ([]byte, error) {
	return json.Marshal(backupContainerAAD{
		Format:     container.Format,
		Version:    container.Version,
		Encrypted:  container.Encrypted,
		ExportedAt: container.ExportedAt.UTC().Format(time.RFC3339Nano),
		KDF:        container.KDF,
		Cipher:     container.Cipher,
	})
}
