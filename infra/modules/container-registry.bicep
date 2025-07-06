@description('The name of the container registry')
param registryName string

@description('The Azure region to deploy the container registry to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('The SKU of the container registry')
param sku string = 'Basic'

@description('Enable admin user for the registry')
param adminUserEnabled bool = false

// Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: adminUserEnabled
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'disabled'
      }
      exportPolicy: {
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: 'Disabled'
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Outputs
output registryId string = containerRegistry.id
output registryName string = containerRegistry.name
output registryLoginServer string = containerRegistry.properties.loginServer
output registryIdentityPrincipalId string = containerRegistry.identity.principalId