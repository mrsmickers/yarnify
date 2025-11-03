using '../main.bicep'

param environment = 'dev'
param location = 'UK South'
param namePrefix = 'yarnify'
param imageTag = 'latest'

param tags = {
  Owner: 'Development Team'
  CostCenter: 'Engineering'
  Project: 'Yarnify'
}

// Secure parameters - these should be provided via Azure Key Vault or deployment time
param postgresqlAdminUsername = 'yarnifyadmin'
param postgresqlAdminPassword = '' // Will be provided at deployment time