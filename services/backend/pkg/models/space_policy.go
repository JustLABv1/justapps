package models

import "github.com/uptrace/bun"

type SpaceCreationPolicy struct {
	bun.BaseModel `bun:"table:space_creation_policy"`
	ID            string `bun:"id,pk" json:"id"`
	Mode          string `json:"mode"`
	ProviderKey   string `bun:"provider_key" json:"providerKey"`
	Issuer        string `json:"issuer"`
	GroupName     string `bun:"group_name" json:"groupName"`
}
