using '../main.bicep'

param environment = 'prod'
param location = 'UK South'
param namePrefix = 'yarnify'
param imageTag = 'latest'

param tags = {
  Owner: 'Production Team'
  CostCenter: 'Engineering'
  Project: 'Yarnify'
  Criticality: 'High'
}

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'yarnifyadmin'
param postgresqlAdminPassword = '' // Will be provided at deployment time