@description('The name of the managed identity for GitHub Actions')
param identityName string

@description('The Azure region to deploy the managed identity to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('GitHub organization/user name')
param githubOrganization string = 'ingenio-Tech'

@description('GitHub repository name')
param githubRepository string = 'yarnify'

@description('GitHub environment name (optional)')
param githubEnvironment string = ''

@description('GitHub branch name (optional)')
param githubBranch string = ''

// User Assigned Managed Identity for GitHub Actions
resource githubManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

// Federated Identity Credential for GitHub Actions - Main/Master branch
resource federatedCredentialMain 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  name: 'github-main'
  parent: githubManagedIdentity
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrganization}/${githubRepository}:ref:refs/heads/main'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Federated Identity Credential for GitHub Actions - Pull Requests
resource federatedCredentialPR 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  name: 'github-pr'
  parent: githubManagedIdentity
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrganization}/${githubRepository}:pull_request'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Federated Identity Credential for specific branch (if provided)
resource federatedCredentialBranch 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (githubBranch != '') {
  name: 'github-branch'
  parent: githubManagedIdentity
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrganization}/${githubRepository}:ref:refs/heads/${githubBranch}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Federated Identity Credential for specific environment (if provided)
resource federatedCredentialEnvironment 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (githubEnvironment != '') {
  name: 'github-environment'
  parent: githubManagedIdentity
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrganization}/${githubRepository}:environment:${githubEnvironment}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Outputs
output identityId string = githubManagedIdentity.id
output identityName string = githubManagedIdentity.name
output principalId string = githubManagedIdentity.properties.principalId
output clientId string = githubManagedIdentity.properties.clientId
output tenantId string = githubManagedIdentity.properties.tenantId