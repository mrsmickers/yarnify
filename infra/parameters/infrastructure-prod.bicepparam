using '../infrastructure.bicep'

param environment = 'prod'
param location = 'UK South'
param namePrefix = 'speek-it'

param tags = {
  Owner: 'Production Team'
  CostCenter: 'Engineering'
  Project: 'Speek-It'
  Criticality: 'High'
}

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'speekitadmin'
param postgresqlAdminPassword = '' // Will be provided at deployment time