@description('The name of the Application Insights component')
param applicationInsightsName string

@description('The Azure region to deploy the Application Insights component to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('The Log Analytics workspace ID')
param logAnalyticsWorkspaceId string

@description('The application type')
param applicationType string = 'web'

@description('The kind of Application Insights component')
param kind string = 'web'

// Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: tags
  kind: kind
  properties: {
    Application_Type: applicationType
    Flow_Type: 'Redfield'
    Request_Source: 'IbizaAIExtension'
    RetentionInDays: 90
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Outputs
output applicationInsightsId string = applicationInsights.id
output applicationInsightsName string = applicationInsights.name
output instrumentationKey string = applicationInsights.properties.InstrumentationKey
output connectionString string = applicationInsights.properties.ConnectionString