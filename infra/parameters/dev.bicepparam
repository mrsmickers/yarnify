using '../main.bicep'

param environment = 'dev'
param location = 'UK South'
param namePrefix = 'speek-it'
param imageTag = 'latest'

param tags = {
  Owner: 'Development Team'
  CostCenter: 'Engineering'
  Project: 'Speek-It'
}

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'speekitadmin'
param postgresqlAdminPassword = '' // Will be provided at deployment time