@description('The Azure region to deploy resources to')
param location string = resourceGroup().location

@description('Common tags to apply to all resources')
param tags object = {}

@description('The name prefix for all resources')
param namePrefix string = 'yarnify'

@description('The Docker image tag to deploy')
param imageTag string = 'latest'

@description('Container Apps Environment ID')
param containerAppsEnvironmentId string

@description('Container Registry Login Server')
param containerRegistryLoginServer string

@description('Managed Identity ID')
param managedIdentityId string

@description('Managed Identity Client ID')
param managedIdentityClientId string

@description('Key Vault name for retrieving secrets')
param keyVaultName string

// Variables
var commonTags = union(tags, {
  Project: 'Yarnify'
})

var namingConvention = {
  containerApp: 'ca-${namePrefix}-api'
}

// Container App (API)
module containerApp 'modules/container-app.bicep' = {
  name: 'container-app-deployment'
  params: {
    containerAppName: namingConvention.containerApp
    location: location
    tags: commonTags
    containerAppsEnvironmentId: containerAppsEnvironmentId
    containerImage: '${containerRegistryLoginServer}/yarnify-api:${imageTag}'
    containerRegistryServer: containerRegistryLoginServer
    managedIdentityId: managedIdentityId
    keyVaultName: keyVaultName
    environmentVariables: [
      {
        name: 'NODE_ENV'
        value: 'production'
      }
      {
        name: 'DATABASE_URL'
        secretRef: 'database-url'
      }
      {
        name: 'REDIS_URL'
        secretRef: 'redis-url'
      }
      {
        name: 'AZURE_STORAGE_CONNECTION_STRING'
        secretRef: 'storage-connection-string'
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        secretRef: 'app-insights-connection-string'
      }
      {
        name: 'OPENAI_API_KEY'
        secretRef: 'openai-api-key'
      }
      {
        name: 'AZURE_CLIENT_ID'
        value: managedIdentityClientId
      }
    ]
  }
}

// Outputs
output containerAppUrl string = containerApp.outputs.applicationUrl
output containerAppName string = containerApp.outputs.containerAppName