@description('The name of the PostgreSQL server')
param serverName string

@description('The Azure region to deploy the PostgreSQL server to')
param location string

@description('Common tags to apply to all resources')
param tags object = {}

@description('PostgreSQL administrator username')
@secure()
param administratorLogin string

@description('PostgreSQL administrator password')
@secure()
param administratorPassword string

@description('The subnet ID for the PostgreSQL server')
param subnetId string

@description('The private DNS zone ID for PostgreSQL')
param privateDnsZoneId string

@description('The SKU name for the PostgreSQL server')
param skuName string = 'Standard_B2s'

@description('The tier for the PostgreSQL server')
param tier string = 'Burstable'

@description('The storage size in MB')
param storageSizeGB int = 32

@description('The PostgreSQL version')
param version string = '15'

// PostgreSQL Flexible Server
resource postgresqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: tier
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
    }
    highAvailability: {
      mode: 'Disabled'
    }
    maintenanceWindow: {
      customWindow: 'Disabled'
      dayOfWeek: 0
      startHour: 0
      startMinute: 0
    }
  }
}

// Database for the application
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresqlServer
  name: 'speekitdb'
  properties: {
    charset: 'utf8'
    collation: 'en_US.utf8'
  }
}

// Enable vector extension
resource vectorExtension 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgresqlServer
  name: 'shared_preload_libraries'
  properties: {
    value: 'vector'
    source: 'user-override'
  }
}

// Create vector extension in database
resource createVectorExtension 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: '${serverName}-create-vector-extension'
  location: location
  tags: tags
  kind: 'AzureCLI'
  properties: {
    azCliVersion: '2.47.0'
    timeout: 'PT30M'
    retentionInterval: 'PT1H'
    environmentVariables: [
      {
        name: 'POSTGRES_HOST'
        value: postgresqlServer.properties.fullyQualifiedDomainName
      }
      {
        name: 'POSTGRES_USER'
        value: administratorLogin
      }
      {
        name: 'POSTGRES_PASSWORD'
        secureValue: administratorPassword
      }
      {
        name: 'POSTGRES_DB'
        value: database.name
      }
    ]
    scriptContent: '''
      # Install PostgreSQL client
      apt-get update
      apt-get install -y postgresql-client

      # Wait for server to be ready
      sleep 30

      # Create vector extension
      PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "CREATE EXTENSION IF NOT EXISTS vector;"
      PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
    '''
  }
  dependsOn: [
    database
    vectorExtension
  ]
}

// Firewall rule to allow Azure services
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresqlServer
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Outputs
output serverId string = postgresqlServer.id
output serverName string = postgresqlServer.name
output fullyQualifiedDomainName string = postgresqlServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
output connectionString string = 'postgresql://${administratorLogin}:${administratorPassword}@${postgresqlServer.properties.fullyQualifiedDomainName}:5432/${database.name}?sslmode=require'