@description('The name of the Redis cache')
param redisCacheName string

@description('The Azure region to deploy the Redis cache to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('The subnet ID for private endpoint')
param subnetId string

@description('The private DNS zone ID for Redis')
param privateDnsZoneId string

@description('The SKU family for the Redis cache')
param skuFamily string = 'C'

@description('The SKU name for the Redis cache')
param skuName string = 'Standard'

@description('The SKU capacity for the Redis cache')
param skuCapacity int = 1

@description('Enable non-SSL port')
param enableNonSslPort bool = false

@description('Redis version')
param redisVersion string = '6'

// Redis Cache
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisCacheName
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
      family: skuFamily
      capacity: skuCapacity
    }
    enableNonSslPort: enableNonSslPort
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    redisVersion: redisVersion
    redisConfiguration: {
      'maxfragmentationmemory-reserved': '50'
      'maxmemory-delta': '50'
      'maxmemory-reserved': '50'
      'maxmemory-policy': 'volatile-lru'
    }
  }
}

// Private Endpoint for Redis
resource redisPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: '${redisCacheName}-private-endpoint'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${redisCacheName}-private-link'
        properties: {
          privateLinkServiceId: redisCache.id
          groupIds: [
            'redisCache'
          ]
        }
      }
    ]
  }
}

// Private DNS Zone Group for Redis Private Endpoint
resource redisPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: redisPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-redis-cache-windows-net'
        properties: {
          privateDnsZoneId: privateDnsZoneId
        }
      }
    ]
  }
}

// Outputs
output cacheId string = redisCache.id
output cacheName string = redisCache.name
output hostName string = redisCache.properties.hostName
output sslPort int = redisCache.properties.sslPort
output port int = redisCache.properties.port
output primaryKey string = redisCache.listKeys().primaryKey
output connectionString string = '${redisCache.properties.hostName}:${redisCache.properties.sslPort},password=${redisCache.listKeys().primaryKey},ssl=True,abortConnect=False'
output redisUrl string = 'rediss://:${redisCache.listKeys().primaryKey}@${redisCache.properties.hostName}:${redisCache.properties.sslPort}/0'