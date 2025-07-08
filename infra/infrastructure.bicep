@description('The Azure region to deploy resources to')
param location string = resourceGroup().location

@description('Common tags to apply to all resources')
param tags object = {}

@description('The name prefix for all resources')
param namePrefix string = 'speek-it'

@description('PostgreSQL administrator username')
@secure()
param postgresqlAdminUsername string

@description('PostgreSQL administrator password')
@secure()
param postgresqlAdminPassword string

@description('Whether to deploy PostgreSQL (set to false to skip)')
param deployPostgreSQL bool = true

// Variables
var commonTags = union(tags, {
  Project: 'speek-it'
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

// GitHub Actions uses existing service principal with contributor permissions

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

// Storage Account
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    storageAccountName: namingConvention.storageAccount
    location: location
    tags: commonTags
    subnetId: networking.outputs.storageSubnetId
    privateDnsZoneId: networking.outputs.storagePrivateDnsZoneId
  }
}

// PostgreSQL
module postgresql 'modules/postgresql.bicep' = if (deployPostgreSQL) {
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
    privateDnsZoneId: networking.outputs.redisPrivateDnsZoneId
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

// Key Vault (optional - not currently used by container app)
// module keyVault 'modules/key-vault.bicep' = {
//   name: 'key-vault-deployment'
//   params: {
//     keyVaultName: namingConvention.keyVault
//     location: location
//     tags: commonTags
//     managedIdentityPrincipalId: managedIdentity.outputs.principalId
//   }
// }

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

// Role Assignments for ACR - Requires elevated permissions
// Uncomment this after deployment with appropriate permissions or run assign-acr-role.sh script
// module roleAssignments 'modules/role-assignments.bicep' = {
//   name: 'role-assignments-deployment'
//   params: {
//     managedIdentityPrincipalId: managedIdentity.outputs.principalId
//     containerRegistryId: containerRegistry.outputs.registryId
//   }
// }

// Outputs
output resourceGroupName string = resourceGroup().name
output containerRegistryLoginServer string = containerRegistry.outputs.registryLoginServer
output containerRegistryName string = containerRegistry.outputs.registryName
output storageAccountName string = storage.outputs.storageAccountName
output postgresqlServerName string = deployPostgreSQL ? postgresql.outputs.serverName : namingConvention.postgresql
output redisCacheName string = redis.outputs.cacheName
output vnetName string = networking.outputs.vnetName
output managedIdentityId string = managedIdentity.outputs.identityId
output managedIdentityPrincipalId string = managedIdentity.outputs.principalId
output managedIdentityClientId string = managedIdentity.outputs.clientId
output containerAppsEnvironmentId string = containerAppsEnvironment.outputs.environmentId
output postgresqlConnectionString string = deployPostgreSQL ? postgresql.outputs.connectionString : ''
output redisConnectionString string = redis.outputs.connectionString
output redisUrl string = redis.outputs.redisUrl
output storageConnectionString string = storage.outputs.connectionString
output applicationInsightsConnectionString string = applicationInsights.outputs.connectionString
// output keyVaultName string = keyVault.outputs.keyVaultName
// output keyVaultUri string = keyVault.outputs.keyVaultUri