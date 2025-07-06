using '../container-app.bicep'

param location = 'UK South'
param namePrefix = 'speek-it'
param imageTag = 'latest'

param tags = {
  Owner: 'Ingenio Tech'
  Project: 'Speek-It'
}

// These parameters will be retrieved from the infrastructure deployment outputs
param containerAppsEnvironmentId = '' // Will be provided at deployment time
param containerRegistryLoginServer = '' // Will be provided at deployment time
param managedIdentityId = '' // Will be provided at deployment time
param keyVaultName = '' // Will be provided at deployment time