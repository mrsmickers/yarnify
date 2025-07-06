@description('The managed identity principal ID')
param managedIdentityPrincipalId string

@description('The Key Vault resource ID (optional)')
param keyVaultId string = ''

@description('The Container Registry resource ID')
param containerRegistryId string

// Role assignment for managed identity to access Key Vault secrets (only if Key Vault ID is provided)
resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (keyVaultId != '') {
  name: guid(keyVaultId, managedIdentityPrincipalId, 'Key Vault Secrets User')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Role assignment for managed identity to pull from ACR
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistryId, managedIdentityPrincipalId, 'AcrPull')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output keyVaultRoleAssignmentId string = keyVaultId != '' ? keyVaultSecretsUserRole.id : ''
output acrRoleAssignmentId string = acrPullRoleAssignment.id