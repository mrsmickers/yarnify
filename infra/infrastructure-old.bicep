@description('The Azure region to deploy resources to')
param location string = resourceGroup().location

@description('Common tags to apply to all resources')
param tags object = {}

@description('The name prefix for all resources')
param namePrefix string = 'yarnify'

@description('PostgreSQL administrator username')
@secure()
param postgresqlAdminUsername string

@description('PostgreSQL administrator password')
@secure()
param postgresqlAdminPassword string

// Variables
var commonTags = union(tags, {
  Project: 'Yarnify'
})

var namingConvention = {
  containerRegistry: 'cr${replace(namePrefix, '-', '')}'
  storageAccount: 'st${replace(namePrefix, '-', '')}'
  managedIdentity: 'id-${namePrefix}'
  keyVault: 'kv-${namePrefix}'
  logAnalytics: 'log-${namePrefix}'
  applicationInsights: 'ai-${namePrefix}'
  containerAppsEnvironment: 'cae-${namePrefix}'
  postgresql: 'psql-${namePrefix}'
  redis: 'redis-${namePrefix}'
  vnet: 'vnet-${namePrefix}'
}

// Networking
module networking 'modules/networking.bicep' = {
  name: 'networking-deployment'
  params: {
    vnetName: namingConvention.vnet
    location: location
    tags: commonTags
  }
}

// Managed Identity for Container Apps
module managedIdentity 'modules/managed-identity.bicep' = {
  name: 'managed-identity-deployment'
  params: {
    identityName: namingConvention.managedIdentity
    location: location
    tags: commonTags
  }
}

// Container Registry
module containerRegistry 'modules/container-registry.bicep' = {
  name: 'container-registry-deployment'
  params: {
    registryName: namingConvention.containerRegistry
    location: location
    tags: commonTags
    sku: 'Standard'
    adminUserEnabled: true
  }
}

// Role assignment for managed identity to pull from ACR
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.outputs.registryId, managedIdentity.outputs.principalId, 'AcrPull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
    principalId: managedIdentity.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

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

// Outputs
output resourceGroupName string = resourceGroup().name
output containerRegistryLoginServer string = containerRegistry.outputs.registryLoginServer
output containerRegistryName string = containerRegistry.outputs.registryName
output storageAccountName string = storage.outputs.storageAccountName
output postgresqlServerName string = postgresql.outputs.serverName
output redisCacheName string = redis.outputs.cacheName
output vnetName string = networking.outputs.vnetName
output managedIdentityId string = managedIdentity.outputs.identityId
output containerAppsEnvironmentId string = containerAppsEnvironment.outputs.environmentId
output postgresqlConnectionString string = postgresql.outputs.connectionString
output redisConnectionString string = redis.outputs.connectionString
output storageConnectionString string = storage.outputs.connectionString
output applicationInsightsConnectionString string = applicationInsights.outputs.connectionString