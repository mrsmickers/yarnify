using '../main.bicep'

param environment = 'prod'
param location = 'East US'
param namePrefix = 'speek-it'
param imageTag = 'latest'

param tags = {
  Owner: 'Production Team'
  CostCenter: 'Engineering'
  Project: 'Speek-It'
  Criticality: 'High'
}

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'speekitadmin'
param postgresqlAdminPassword = '' // Will be provided at deployment time
param githubUsername = '' // Will be provided at deployment time
param githubToken = '' // Will be provided at deployment time