# Speek-It Azure Infrastructure

This directory contains Azure Bicep templates for deploying the Speek-It application infrastructure to Azure.

## Architecture Overview

The infrastructure includes:

- **Virtual Network (VNet)** with dedicated subnets for Container Apps, PostgreSQL, Redis, and Storage
- **Azure Container Apps** for hosting the API service with auto-scaling
- **Azure PostgreSQL Flexible Server** with vector extension for embeddings
- **Azure Redis Cache** for session management and BullMQ queues
- **Azure Blob Storage** for storing transcripts and recordings
- **GitHub Packages** (ghcr.io) for hosting Docker images
- **Log Analytics Workspace** and **Application Insights** for monitoring
- **Private endpoints** for secure database and storage access

## Directory Structure

```
infra/
├── main.bicep                    # Main orchestration template
├── parameters/
│   ├── dev.bicepparam           # Development environment parameters
│   └── prod.bicepparam          # Production environment parameters
├── modules/
│   ├── networking.bicep         # Virtual network and subnets
│   ├── storage.bicep           # Azure Blob Storage with containers
│   ├── postgresql.bicep        # PostgreSQL with vector extension
│   ├── redis.bicep             # Redis Cache with private endpoint
│   ├── log-analytics.bicep     # Log Analytics workspace
│   ├── application-insights.bicep # Application Insights
│   ├── container-apps-environment.bicep # Container Apps environment
│   └── container-app.bicep     # Container App for API service
├── scripts/
│   └── deploy.sh               # Deployment script
└── README.md                   # This file
```

## Prerequisites

1. **Azure CLI** - [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
2. **Azure subscription** with appropriate permissions
3. **Bicep CLI** - Comes with Azure CLI 2.20.0+
4. **GitHub Personal Access Token** - With `read:packages` permission for pulling images from GitHub Packages

## Deployment

### Option 1: Using the Deployment Script (Recommended)

```bash
# Make the script executable
chmod +x scripts/deploy.sh

# Set GitHub credentials
export GITHUB_USERNAME="your-github-username"
export GITHUB_TOKEN="ghp_your_personal_access_token"

# Deploy to development environment
./scripts/deploy.sh --environment dev --location eastus

# Deploy to production environment
./scripts/deploy.sh --environment prod --location eastus --subscription "your-subscription-id"
```

### Option 2: Manual Deployment

1. **Login to Azure:**
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

2. **Create Resource Group:**
   ```bash
   az group create --name "rg-speek-it-dev" --location "eastus"
   ```

3. **Deploy Infrastructure:**
   ```bash
   az deployment group create \
     --resource-group "rg-speek-it-dev" \
     --template-file "main.bicep" \
     --parameters "parameters/dev.bicepparam" \
     --parameters postgresqlAdminPassword="YourSecurePassword123!" \
     --parameters githubUsername="your-github-username" \
     --parameters githubToken="ghp_your_personal_access_token"
   ```

## Configuration

### Environment Parameters

Update the parameter files in the `parameters/` directory:

- `dev.bicepparam` - Development environment settings
- `prod.bicepparam` - Production environment settings

### Required Secrets

The following secrets need to be provided during deployment:

- `postgresqlAdminPassword` - PostgreSQL administrator password
- `githubUsername` - Your GitHub username
- `githubToken` - GitHub personal access token with `read:packages` permission

### GitHub Actions Integration

The infrastructure is integrated with GitHub Actions for CI/CD. The workflow automatically builds and pushes images to GitHub Packages using the built-in `GITHUB_TOKEN`.

For Azure deployment, set the following secret in your GitHub repository:

- `AZURE_LOGIN` - Azure service principal credentials for deploying to Container Apps

## Network Architecture

```
VNet (10.0.0.0/16)
├── Container Apps Subnet (10.0.1.0/24)
│   └── Delegated to Microsoft.App/environments
├── Database Subnet (10.0.2.0/24)
│   └── Delegated to Microsoft.DBforPostgreSQL/flexibleServers
├── Redis Subnet (10.0.3.0/24)
│   └── Private endpoints enabled
└── Storage Subnet (10.0.4.0/24)
    └── Service endpoints for Microsoft.Storage
```

## Security Features

- **Private networking** for all database and cache connections
- **Private DNS zones** for name resolution
- **Network security groups** with restricted access
- **Service endpoints** for storage access
- **Managed identities** for secure resource access
- **TLS 1.2** minimum for all connections
- **Firewall rules** to restrict database access

## Monitoring and Logging

- **Log Analytics Workspace** collects all application and infrastructure logs
- **Application Insights** provides application performance monitoring
- **Container Apps** automatically forward logs to Log Analytics
- **Health checks** configured for container liveness and readiness

## Scaling Configuration

### Container Apps Auto-scaling

- **Minimum replicas:** 1
- **Maximum replicas:** 3
- **Scaling trigger:** HTTP concurrent requests (100 requests)
- **CPU allocation:** 0.5 cores
- **Memory allocation:** 1 GB

### Database Scaling

- **PostgreSQL Flexible Server** with Burstable tier (Standard_B2s)
- **Storage:** 32 GB with auto-grow enabled
- **Backup retention:** 7 days

### Redis Scaling

- **Standard tier** with 1 GB cache
- **High availability** in production environment

## Environment Variables

The Container App is configured with the following environment variables:

- `NODE_ENV` - Runtime environment (production)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `AZURE_STORAGE_CONNECTION_STRING` - Blob storage connection
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - Application Insights connection

## Maintenance

### Viewing Deployment Outputs

```bash
./scripts/deploy.sh --outputs --environment dev
```

### Cleanup Resources

```bash
./scripts/deploy.sh --cleanup --environment dev
```

### Updating Infrastructure

1. Modify the Bicep templates
2. Update parameter files if needed
3. Run the deployment script again

## Troubleshooting

### Common Issues

1. **PostgreSQL Vector Extension**
   - The deployment script automatically installs the vector extension
   - If it fails, manually connect and run: `CREATE EXTENSION IF NOT EXISTS vector;`

2. **GitHub Packages Authentication**
   - Ensure you have a GitHub personal access token with `read:packages` permission
   - Token creation: https://github.com/settings/tokens/new
   - Container Apps needs the token to pull images from ghcr.io

3. **Network Connectivity**
   - Check subnet delegations are correctly configured
   - Verify private DNS zones are linked to the VNet

### Logs and Monitoring

- Check Container Apps logs in Log Analytics
- View Application Insights for performance metrics
- Monitor resource usage in Azure Portal

## Cost Optimization

- Development environment uses Burstable/Basic tiers
- Production environment can be scaled up as needed
- Resources are tagged for cost tracking
- Consider using Azure Dev/Test pricing for non-production environments

## Support

For issues with the infrastructure deployment:

1. Check the deployment logs in Azure Portal
2. Review the Bicep template validation errors
3. Ensure all prerequisites are met
4. Verify Azure subscription permissions

## Security Best Practices

- Regularly rotate database and registry passwords
- Use Azure Key Vault for production secrets
- Monitor access logs and unusual activity
- Keep all services updated to latest versions
- Follow principle of least privilege for access control