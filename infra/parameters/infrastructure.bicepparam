using '../infrastructure.bicep'

param location = 'UK South'
param namePrefix = 'speek-it'

param tags = {
  Owner: 'Ingenio Tech'
  Project: 'Speek-It'
}

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'speekitadmin'
param postgresqlAdminPassword = '' // Will be provided at deployment time