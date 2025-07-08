@description('The name of the environment (e.g., dev, staging, prod)')
param environment string

@description('The Azure region to deploy resources to')
param location string = resourceGroup().location

@description('Common tags to apply to all resources')
param tags object = {}

@description('The name prefix for all resources')
param namePrefix string

@description('The Docker image tag to deploy')
param imageTag string = 'latest'

// GitHub Secrets as secure parameters
@description('ConnectWise Private Key')
@secure()
param connectwisePrivateKey string

@description('OpenAI API Key')
@secure()
param openaiApiKey string

@description('VoIP Password')
@secure()
param voipPassword string

@description('WorkOS API Key')
@secure()
param workosApiKey string

@description('PostgreSQL administrator password')
@secure()
param postgresqlAdminPassword string

// Variables
var commonTags = union(tags, {
  Environment: environment
  Project: 'speek-it'
})

var namingConvention = {
  containerRegistry: 'cr${replace(namePrefix, '-', '')}'
  managedIdentity: 'id-${namePrefix}'
  containerAppsEnvironment: 'cae-${namePrefix}'
  containerApp: 'ca-${namePrefix}-api'
  postgresql: 'psql-${namePrefix}'
  redis: 'redis-${namePrefix}'
  storageAccount: 'st${replace(namePrefix, '-', '')}'
  applicationInsights: 'ai-${namePrefix}'
}

// Get existing resources
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: namingConvention.containerRegistry
}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: namingConvention.managedIdentity
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: namingConvention.containerAppsEnvironment
}

resource postgresql 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' existing = {
  name: namingConvention.postgresql
}

resource redis 'Microsoft.Cache/redis@2023-08-01' existing = {
  name: namingConvention.redis
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: namingConvention.storageAccount
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: namingConvention.applicationInsights
}

// Get database for connection string
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' existing = {
  parent: postgresql
  name: 'speekitdb'
}

// Container App with secrets and environment variables
module containerApp 'modules/container-app.bicep' = {
  name: 'container-app-deployment'
  params: {
    containerAppName: namingConvention.containerApp
    location: location
    tags: commonTags
    containerAppsEnvironmentId: containerAppsEnvironment.id
    containerImage: '${containerRegistry.properties.loginServer}/speek-it-api:${imageTag}'
    containerRegistryServer: containerRegistry.properties.loginServer
    containerRegistryUsername: containerRegistry.listCredentials().username
    managedIdentityId: managedIdentity.id
    secrets: [
      {
        name: 'container-registry-password'
        value: containerRegistry.listCredentials().passwords[0].value
      }
      {
        name: 'database-url'
        value: 'postgresql://${postgresql.properties.administratorLogin}:${postgresqlAdminPassword}@${postgresql.properties.fullyQualifiedDomainName}:5432/${database.name}?sslmode=require'
      }
      {
        name: 'redis-url'
        value: '${redis.properties.hostName}:${redis.properties.sslPort},password=${redis.listKeys().primaryKey},ssl=True,abortConnect=False'
      }
      {
        name: 'azure-storage-connection-string'
        value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
      }
      {
        name: 'connectwise-private-key'
        value: connectwisePrivateKey
      }
      {
        name: 'openai-api-key'
        value: openaiApiKey
      }
      {
        name: 'voip-password'
        value: voipPassword
      }
      {
        name: 'workos-api-key'
        value: workosApiKey
      }
    ]
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
        secretRef: 'azure-storage-connection-string'
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: applicationInsights.properties.ConnectionString
      }
      {
        name: 'CONNECTWISE_PRIVATE_KEY'
        secretRef: 'connectwise-private-key'
      }
      {
        name: 'OPENAI_API_KEY'
        secretRef: 'openai-api-key'
      }
      {
        name: 'VOIP_PASSWORD'
        secretRef: 'voip-password'
      }
      {
        name: 'WORKOS_API_KEY'
        secretRef: 'workos-api-key'
      }
      {
        name: 'VOIP_USERNAME'
        value: 'Simon%20Smyth'
      }
      {
        name: 'VOIP_BASE_URL'
        value: 'https://voip.ingeniotech.co.uk'
      }
      {
        name: 'CONNECTWISE_COMPANY_ID'
        value: 'computereyez'
      }
      {
        name: 'CONNECTWISE_URL'
        value: 'api-eu.myconnectwise.net'
      }
      {
        name: 'CONNECTWISE_PUBLIC_KEY'
        value: 'i4xUd6K9cB9n7BBY'
      }
      {
        name: 'CONNECTWISE_CLIENT_ID'
        value: 'c847f56f-5f48-478e-bc94-abc5c329497d'
      }
      {
        name: 'AZURE_STORAGE_CONTAINER_NAME'
        value: 'storage'
      }
      {
        name: 'WORKOS_CLIENT_ID'
        value: 'client_01JW3XNW90FZ157R90W1YCK13S'
      }
      {
        name: 'FRONTEND_URL'
        value: 'https://${namingConvention.containerApp}.${containerAppsEnvironment.properties.defaultDomain}'
      }
      {
        name: 'WORKOS_ORG_ID'
        value: 'org_01JW5KB3VMM5T0MH96H471ECVJ'
      }
      {
        name: 'EXTENSION_STARTS_WITH'
        value: '56360'
      }
      {
        name: 'VOIP_CUSTOMER_ID'
        value: '21677'
      }
      {
        name: 'EMBEDDING_CHUNK_SIZE_TOKENS'
        value: '7500'
      }
      {
        name: 'EMBEDDING_CHUNK_OVERLAP_TOKENS'
        value: '200'
      }
    ]
  }
}

// Outputs
output containerAppId string = containerApp.outputs.containerAppId
output containerAppName string = containerApp.outputs.containerAppName
output applicationUrl string = containerApp.outputs.applicationUrl
output fqdn string = containerApp.outputs.fqdn