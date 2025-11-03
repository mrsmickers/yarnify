using '../container-app.bicep'

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

// These parameters will be retrieved from the infrastructure deployment outputs
param containerAppsEnvironmentId = '' // Will be provided at deployment time
param containerRegistryLoginServer = '' // Will be provided at deployment time
param managedIdentityId = '' // Will be provided at deployment time
param postgresqlConnectionString = '' // Will be provided at deployment time
param redisConnectionString = '' // Will be provided at deployment time
param storageConnectionString = '' // Will be provided at deployment time
param applicationInsightsConnectionString = '' // Will be provided at deployment time