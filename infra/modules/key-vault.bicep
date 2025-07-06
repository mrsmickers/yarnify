@description('The name of the key vault')
param keyVaultName string

@description('The Azure region to deploy the key vault to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('The managed identity principal ID that needs access to the key vault')
param managedIdentityPrincipalId string

@description('Enable soft delete for the key vault')
param enableSoftDelete bool = true

@description('Soft delete retention days')
param softDeleteRetentionInDays int = 7

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    enabledForDeployment: false
    enableSoftDelete: enableSoftDelete
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enableRbacAuthorization: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: managedIdentityPrincipalId
        permissions: {
          keys: []
          secrets: [
            'get'
            'list'
          ]
          certificates: []
        }
      }
    ]
  }
}

// Note: Role assignment for managed identity to access Key Vault secrets
// This needs to be done separately with elevated permissions:
// az role assignment create --role "Key Vault Secrets User" --assignee <managed-identity-principal-id> --scope <key-vault-resource-id>

// Outputs
output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri