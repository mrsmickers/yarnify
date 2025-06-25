@description('The name of the environment (e.g., dev, staging, prod)')
param environment string

@description('The Azure region to deploy resources to')
param location string = resourceGroup().location

@description('Common tags to apply to all resources')
param tags object = {}

@description('The name prefix for all resources')
param namePrefix string

@description('PostgreSQL administrator username')
@secure()
param postgresqlAdminUsername string

@description('PostgreSQL administrator password')
@secure()
param postgresqlAdminPassword string

@description('GitHub Packages registry URL')
param githubRegistryUrl string = 'ghcr.io'

@description('GitHub username for packages access')
@secure()
param githubUsername string

@description('GitHub personal access token for packages access')
@secure()
param githubToken string

@description('The Docker image tag to deploy')
param imageTag string = 'latest'

// Variables
var commonTags = union(tags, {
  Environment: environment
  Project: 'speek-it'
})

var namingConvention = {
  resourceGroup: 'rg-${namePrefix}-${environment}'
  storageAccount: 'st${replace(namePrefix, '-', '')}${environment}'
  keyVault: 'kv-${namePrefix}-${environment}'
  logAnalytics: 'log-${namePrefix}-${environment}'
  applicationInsights: 'ai-${namePrefix}-${environment}'
  containerAppsEnvironment: 'cae-${namePrefix}-${environment}'
  containerApp: 'ca-${namePrefix}-api-${environment}'
  postgresql: 'psql-${namePrefix}-${environment}'
  redis: 'redis-${namePrefix}-${environment}'
  vnet: 'vnet-${namePrefix}-${environment}'
}

// Networking
module networking 'modules/networking.bicep' = {
  name: 'networking-deployment'
  params: {
    vnetName: namingConvention.vnet
    location: location
    tags: commonTags
    environment: environment
  }
}

// Note: Container Registry module removed - using GitHub Packages instead

// Storage Account
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    storageAccountName: namingConvention.storageAccount
    location: location
    tags: commonTags
    subnetId: networking.outputs.storageSubnetId
  }
}

// PostgreSQL
module postgresql 'modules/postgresql.bicep' = {
  name: 'postgresql-deployment'
  params: {
    serverName: namingConvention.postgresql
    location: location
    tags: commonTags
    administratorLogin: postgresqlAdminUsername
    administratorPassword: postgresqlAdminPassword
    subnetId: networking.outputs.databaseSubnetId
    privateDnsZoneId: networking.outputs.postgresPrivateDnsZoneId
  }
}

// Redis Cache
module redis 'modules/redis.bicep' = {
  name: 'redis-deployment'
  params: {
    redisCacheName: namingConvention.redis
    location: location
    tags: commonTags
    subnetId: networking.outputs.redisSubnetId
  }
}

// Log Analytics Workspace
module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics-deployment'
  params: {
    workspaceName: namingConvention.logAnalytics
    location: location
    tags: commonTags
  }
}

// Application Insights
module applicationInsights 'modules/application-insights.bicep' = {
  name: 'application-insights-deployment'
  params: {
    applicationInsightsName: namingConvention.applicationInsights
    location: location
    tags: commonTags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

// Container Apps Environment
module containerAppsEnvironment 'modules/container-apps-environment.bicep' = {
  name: 'container-apps-environment-deployment'
  params: {
    environmentName: namingConvention.containerAppsEnvironment
    location: location
    tags: commonTags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    infrastructureSubnetId: networking.outputs.containerAppsSubnetId
  }
}

// Container App (API)
module containerApp 'modules/container-app.bicep' = {
  name: 'container-app-deployment'
  params: {
    containerAppName: namingConvention.containerApp
    location: location
    tags: commonTags
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.environmentId
    containerImage: '${githubRegistryUrl}/adamhancock/speek-it-repo-api:${imageTag}'
    containerRegistryServer: githubRegistryUrl
    containerRegistryUsername: githubUsername
    containerRegistryPassword: githubToken
    environmentVariables: [
      {
        name: 'NODE_ENV'
        value: 'production'
      }
      {
        name: 'DATABASE_URL'
        value: postgresql.outputs.connectionString
      }
      {
        name: 'REDIS_URL'
        value: redis.outputs.connectionString
      }
      {
        name: 'AZURE_STORAGE_CONNECTION_STRING'
        value: storage.outputs.connectionString
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: applicationInsights.outputs.connectionString
      }
    ]
  }
}

// Outputs
output resourceGroupName string = resourceGroup().name
output containerAppUrl string = containerApp.outputs.applicationUrl
output storageAccountName string = storage.outputs.storageAccountName
output postgresqlServerName string = postgresql.outputs.serverName
output redisCacheName string = redis.outputs.cacheName
output vnetName string = networking.outputs.vnetName