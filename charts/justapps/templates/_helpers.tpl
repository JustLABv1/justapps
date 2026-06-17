{{/*
Expand the name of the chart.
*/}}
{{- define "justapps.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "justapps.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "justapps.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "justapps.labels" -}}
helm.sh/chart: {{ include "justapps.chart" . }}
{{ include "justapps.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "justapps.selectorLabels" -}}
app.kubernetes.io/name: {{ include "justapps.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "justapps.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "justapps.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Resolve the Kubernetes Secret name for a credential.
Expected input: dict "root" . "ref" "<credential>"
*/}}
{{- define "justapps.secretRefName" -}}
{{- $ref := index .root.Values.secrets.refs .ref -}}
{{- $generatedName := printf "%s-secrets" (include "justapps.fullname" .root) -}}
{{- $ref.name | default .root.Values.secrets.existingSecret | default $generatedName -}}
{{- end }}

{{/*
Resolve and validate the Kubernetes Secret data key for a credential.
Expected input: dict "root" . "ref" "<credential>"
*/}}
{{- define "justapps.secretRefKey" -}}
{{- $ref := index .root.Values.secrets.refs .ref -}}
{{- $key := $ref.key | default "" -}}
{{- if empty $key -}}
{{- fail (printf "secrets.refs.%s.key must not be empty" .ref) -}}
{{- end -}}
{{- if not (regexMatch "^[A-Za-z0-9._-]+$" $key) -}}
{{- fail (printf "secrets.refs.%s.key %q is invalid: Secret data keys may only contain letters, numbers, '.', '_' and '-'" .ref $key) -}}
{{- end -}}
{{- $key -}}
{{- end }}

{{/*
Validate every configured Secret data key, including credentials not used by
the selected deployment mode.
*/}}
{{- define "justapps.validateSecretRefs" -}}
{{- $root := . -}}
{{- range $refName := list "databasePassword" "postgresqlPassword" "jwtSecret" "repositoryProviderEncryptionSecret" "frontendAuthSecret" -}}
  {{- $_ := include "justapps.secretRefKey" (dict "root" $root "ref" $refName) -}}
{{- end -}}
{{- end }}

{{/*
Fail when two credentials would be written to the same key in the
chart-generated Secret.
*/}}
{{- define "justapps.validateManagedSecretRefs" -}}
{{- $root := . -}}
{{- $generatedName := printf "%s-secrets" (include "justapps.fullname" $root) -}}
{{- $seen := dict -}}
{{- range $refName := list "databasePassword" "postgresqlPassword" "jwtSecret" "repositoryProviderEncryptionSecret" "frontendAuthSecret" -}}
  {{- $name := include "justapps.secretRefName" (dict "root" $root "ref" $refName) -}}
  {{- $key := include "justapps.secretRefKey" (dict "root" $root "ref" $refName) -}}
  {{- if eq $name $generatedName -}}
    {{- if hasKey $seen $key -}}
      {{- fail (printf "secrets.refs.%s.key duplicates chart-managed Secret key %q already used by %s" $refName $key (index $seen $key)) -}}
    {{- end -}}
    {{- $_ := set $seen $key $refName -}}
  {{- end -}}
{{- end -}}
{{- end }}
