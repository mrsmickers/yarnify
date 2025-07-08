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

// Skip PostgreSQL deployment
param deployPostgreSQL = false

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'speekitadmin'
param postgresqlAdminPassword = 'NotUsed123!' // Won't be used since PostgreSQL is not deployed