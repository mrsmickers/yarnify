#!/bin/bash

# Script to assign ACR pull role to managed identity after infrastructure deployment

set -e

# Configuration
RESOURCE_GROUP_NAME="Yarnify"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get deployment outputs
print_status "Getting infrastructure deployment outputs..."

# Get outputs
ACR_NAME=$(az deployment group show --resource-group "$RESOURCE_GROUP_NAME" --name "infrastructure" --query "properties.outputs.containerRegistryName.value" -o tsv)
IDENTITY_PRINCIPAL_ID=$(az deployment group show --resource-group "$RESOURCE_GROUP_NAME" --name "infrastructure" --query "properties.outputs.managedIdentityPrincipalId.value" -o tsv)

if [ -z "$ACR_NAME" ] || [ -z "$IDENTITY_PRINCIPAL_ID" ]; then
    print_error "Could not retrieve ACR name or managed identity principal ID"
    exit 1
fi

print_status "ACR Name: $ACR_NAME"
print_status "Managed Identity Principal ID: $IDENTITY_PRINCIPAL_ID"

# Assign AcrPull role
print_status "Assigning AcrPull role to managed identity..."

az role assignment create \
    --assignee "$IDENTITY_PRINCIPAL_ID" \
    --role "AcrPull" \
    --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP_NAME/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"

print_status "Role assignment completed successfully!"
print_status "The managed identity can now pull images from ACR"