@description('The name of the Container Apps environment')
param environmentName string

@description('The Azure region to deploy the Container Apps environment to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('The Log Analytics workspace ID')
param logAnalyticsWorkspaceId string

@description('The subnet ID for the Container Apps environment')
param infrastructureSubnetId string

@description('Enable zone redundancy')
param zoneRedundant bool = false

// Container Apps Environment
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    zoneRedundant: zoneRedundant
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// Outputs
output environmentId string = containerAppsEnvironment.id
output environmentName string = containerAppsEnvironment.name
output defaultDomain string = containerAppsEnvironment.properties.defaultDomain
output staticIp string = containerAppsEnvironment.properties.staticIp