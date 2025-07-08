@description('The name of the Container App')
param containerAppName string

@description('The Azure region to deploy the Container App to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('The Container Apps environment ID')
param containerAppsEnvironmentId string

@description('The container image to deploy')
param containerImage string

@description('The container registry server')
param containerRegistryServer string

@description('The container registry username')
param containerRegistryUsername string = ''

@description('The managed identity resource ID for ACR access')
param managedIdentityId string

@description('Environment variables for the container')
param environmentVariables array = []

@description('Secrets for the container')
param secrets array = []

@description('The minimum number of replicas')
param minReplicas int = 1

@description('The maximum number of replicas')
param maxReplicas int = 3

@description('The target port for the container')
param targetPort int = 3000

@description('CPU allocation for the container')
param cpu string = '0.5'

@description('Memory allocation for the container')
param memory string = '1Gi'

@description('Current timestamp for unique revision naming')
param deploymentTimestamp string = utcNow()

// Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: containerRegistryServer
          username: containerRegistryUsername
          passwordSecretRef: 'container-registry-password'
        }
      ]
      secrets: secrets
    }
    template: {
      revisionSuffix: uniqueString(deployment().name, deploymentTimestamp)
      containers: [
        {
          name: 'api'
          image: containerImage
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: environmentVariables
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 30
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: targetPort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// Outputs
output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output applicationUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output fqdn string = containerApp.properties.configuration.ingress.fqdn