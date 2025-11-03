#!/bin/bash

# Deploy infrastructure updates excluding PostgreSQL
# This script deploys infrastructure changes without affecting the existing PostgreSQL server

set -e

RESOURCE_GROUP="Yarnify"
LOCATION="uksouth"

echo "Deploying infrastructure updates (excluding PostgreSQL)..."

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "Using subscription: $SUBSCRIPTION"
echo "Resource group: $RESOURCE_GROUP"

# Validate the deployment
echo "Validating deployment..."
az deployment group validate \
    --resource-group "$RESOURCE_GROUP" \
    --template-file ../infrastructure.bicep \
    --parameters @../parameters/storage-update.json \
    --parameters postgresqlAdminPassword="NotUsed123!"

if [ $? -ne 0 ]; then
    echo "Validation failed. Please check the errors above."
    exit 1
fi

echo "Validation successful. Proceeding with deployment..."

# Deploy the infrastructure
DEPLOYMENT_NAME="storage-update-$(date +%Y%m%d%H%M%S)"
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file ../infrastructure.bicep \
    --parameters @../parameters/infrastructure-prod.bicepparam \
    --parameters deployPostgreSQL=false \
    --parameters postgresqlAdminPassword="NotUsed123!" \
    --name "$DEPLOYMENT_NAME"

if [ $? -eq 0 ]; then
    echo "Deployment completed successfully!"
    
    # Show deployment outputs
    echo ""
    echo "Deployment outputs:"
    az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query properties.outputs -o table
else
    echo "Deployment failed. Please check the errors above."
    exit 1
fi