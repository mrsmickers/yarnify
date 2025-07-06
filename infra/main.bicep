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


@description('The Docker image tag to deploy')
param imageTag string = 'latest'

@description('Whether to deploy the Container App (set to false for initial deployment)')
param deployContainerApp bool = false

// Variables
var commonTags = union(tags, {
  Environment: environment
  Project: 'speek-it'
})

var namingConvention = {
  resourceGroup: 'rg-${namePrefix}-${environment}'
  containerRegistry: 'cr${replace(namePrefix, '-', '')}${environment}'
  storageAccount: 'st${replace(namePrefix, '-', '')}${environment}'
  managedIdentity: 'id-${namePrefix}-${environment}'
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
    sku: environment == 'prod' ? 'Standard' : 'Basic'
    adminUserEnabled: true
  }
}

// Role assignment moved to separate module due to permissions requirements

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

// Role Assignments for ACR access (requires elevated permissions)
// Deploy this separately if needed: az deployment group create --template-file role-assignments.bicep
// module roleAssignments 'modules/role-assignments.bicep' = {
//   name: 'role-assignments-deployment'
//   params: {
//     managedIdentityPrincipalId: managedIdentity.outputs.principalId
//     containerRegistryId: containerRegistry.outputs.registryId
//   }
// }

// Container App (API) - Deploy only if deployContainerApp is true
module containerApp 'modules/container-app.bicep' = if (deployContainerApp) {
  name: 'container-app-deployment'
  params: {
    containerAppName: namingConvention.containerApp
    location: location
    tags: commonTags
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.environmentId
    containerImage: '${containerRegistry.outputs.registryLoginServer}/speek-it-api:${imageTag}'
    containerRegistryServer: containerRegistry.outputs.registryLoginServer
    managedIdentityId: managedIdentity.outputs.identityId
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
output containerRegistryLoginServer string = containerRegistry.outputs.registryLoginServer
output containerRegistryName string = containerRegistry.outputs.registryName
output containerAppUrl string = containerApp.outputs.applicationUrl
output storageAccountName string = storage.outputs.storageAccountName
output postgresqlServerName string = postgresql.outputs.serverName
output redisCacheName string = redis.outputs.cacheName
output vnetName string = networking.outputs.vnetName
output managedIdentityId string = managedIdentity.outputs.identityId