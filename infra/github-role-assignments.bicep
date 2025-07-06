@description('The GitHub managed identity principal ID')
param githubManagedIdentityPrincipalId string

@description('The Container Registry resource ID')
param containerRegistryId string

@description('The resource group name')
param resourceGroupName string

// Role assignment for GitHub Actions to push to ACR
resource acrPushRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistryId, githubManagedIdentityPrincipalId, 'AcrPush')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec') // AcrPush role
    principalId: githubManagedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Role assignment for GitHub Actions to deploy resources (Contributor)
resource contributorRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, githubManagedIdentityPrincipalId, 'Contributor')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor role
    principalId: githubManagedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output acrPushRoleAssignmentId string = acrPushRoleAssignment.id
output contributorRoleAssignmentId string = contributorRoleAssignment.id