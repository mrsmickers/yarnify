@description('The name of the virtual network')
param vnetName string

@description('The Azure region to deploy the virtual network to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}


var vnetAddressSpace = '10.0.0.0/16'
var subnets = {
  containerApps: {
    name: 'snet-container-apps'
    addressPrefix: '10.0.1.0/24'
  }
  database: {
    name: 'snet-database'
    addressPrefix: '10.0.2.0/24'
  }
  redis: {
    name: 'snet-redis'
    addressPrefix: '10.0.3.0/24'
  }
  storage: {
    name: 'snet-storage'
    addressPrefix: '10.0.4.0/24'
  }
}

// Virtual Network
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressSpace]
    }
    subnets: [
      {
        name: subnets.containerApps.name
        properties: {
          addressPrefix: subnets.containerApps.addressPrefix
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: subnets.database.name
        properties: {
          addressPrefix: subnets.database.addressPrefix
          delegations: [
            {
              name: 'Microsoft.DBforPostgreSQL.flexibleServers'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
          serviceEndpoints: [
            {
              service: 'Microsoft.Storage'
            }
          ]
        }
      }
      {
        name: subnets.redis.name
        properties: {
          addressPrefix: subnets.redis.addressPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: subnets.storage.name
        properties: {
          addressPrefix: subnets.storage.addressPrefix
          privateEndpointNetworkPolicies: 'Disabled'
          serviceEndpoints: [
            {
              service: 'Microsoft.Storage'
            }
          ]
        }
      }
    ]
  }
}

// Network Security Group for Container Apps
resource nsgContainerApps 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: 'nsg-${subnets.containerApps.name}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPSInbound'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 100
          direction: 'Inbound'
        }
      }
      {
        name: 'AllowHTTPInbound'
        properties: {
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 110
          direction: 'Inbound'
        }
      }
    ]
  }
}

// Private DNS Zone for PostgreSQL
resource postgresPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'yarnify.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

// Link Private DNS Zone to VNet
resource postgresPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresPrivateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// Private DNS Zone for Storage
resource storagePrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.core.windows.net'
  location: 'global'
  tags: tags
}

// Link Storage Private DNS Zone to VNet
resource storagePrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: storagePrivateDnsZone
  name: '${vnetName}-storage-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// Private DNS Zone for Redis
resource redisPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.redis.cache.windows.net'
  location: 'global'
  tags: tags
}

// Link Redis Private DNS Zone to VNet
resource redisPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: redisPrivateDnsZone
  name: '${vnetName}-redis-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// Outputs
output vnetId string = vnet.id
output vnetName string = vnet.name
output containerAppsSubnetId string = vnet.properties.subnets[0].id
output databaseSubnetId string = vnet.properties.subnets[1].id
output redisSubnetId string = vnet.properties.subnets[2].id
output storageSubnetId string = vnet.properties.subnets[3].id
output postgresPrivateDnsZoneId string = postgresPrivateDnsZone.id
output storagePrivateDnsZoneId string = storagePrivateDnsZone.id
output redisPrivateDnsZoneId string = redisPrivateDnsZone.id