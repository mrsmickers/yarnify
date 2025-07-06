using '../container-app.bicep'

param environment = 'dev'
param location = 'UK South'
param namePrefix = 'speek-it'
param imageTag = 'latest'

param tags = {
  Owner: 'Development Team'
  CostCenter: 'Engineering'
  Project: 'Speek-It'
}

// These parameters will be retrieved from the infrastructure deployment outputs
param containerAppsEnvironmentId = '' // Will be provided at deployment time
param containerRegistryLoginServer = '' // Will be provided at deployment time
param managedIdentityId = '' // Will be provided at deployment time
param postgresqlConnectionString = '' // Will be provided at deployment time
param redisConnectionString = '' // Will be provided at deployment time
param storageConnectionString = '' // Will be provided at deployment time
param applicationInsightsConnectionString = '' // Will be provided at deployment time