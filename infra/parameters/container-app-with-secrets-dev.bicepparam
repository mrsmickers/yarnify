using '../container-app-with-secrets.bicep'

param environment = 'dev'
param location = 'UK South'
param namePrefix = 'speek-it'

param tags = {
  Owner: 'Development Team'
  CostCenter: 'Engineering'
  Project: 'Speek-It'
}

// Image tag will be provided at deployment time
param imageTag = 'latest'

// Secrets will be provided at deployment time via GitHub Actions
param connectwisePrivateKey = '' // Will be provided at deployment time
param openaiApiKey = '' // Will be provided at deployment time
param voipPassword = '' // Will be provided at deployment time
param workosApiKey = '' // Will be provided at deployment time