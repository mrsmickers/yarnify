@description('The name of the managed identity')
param identityName string

@description('The Azure region to deploy the managed identity to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

// User Assigned Managed Identity
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

// Outputs
output identityId string = managedIdentity.id
output identityName string = managedIdentity.name
output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId