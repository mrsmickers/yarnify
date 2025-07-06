#!/bin/bash

# Azure Infrastructure Deployment Script for Speek-It Application
# This script deploys the Bicep templates to Azure

set -e

# Configuration
SUBSCRIPTION_ID=""
RESOURCE_GROUP_PREFIX="rg-speek-it"
LOCATION="uksouth"
ENVIRONMENT="dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed
check_azure_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
}

# Function to check if user is logged in to Azure
check_azure_login() {
    if ! az account show &> /dev/null; then
        print_error "You are not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
}

# Function to set Azure subscription
set_subscription() {
    if [ -n "$SUBSCRIPTION_ID" ]; then
        print_status "Setting Azure subscription to $SUBSCRIPTION_ID"
        az account set --subscription "$SUBSCRIPTION_ID"
    else
        print_warning "No subscription ID specified. Using default subscription."
    fi
}

# Function to validate parameters
validate_parameters() {
    if [ -z "$ENVIRONMENT" ]; then
        print_error "Environment parameter is required"
        exit 1
    fi
    
    if [ -z "$LOCATION" ]; then
        print_error "Location parameter is required"
        exit 1
    fi
}

# Function to create resource group
create_resource_group() {
    local rg_name="${RESOURCE_GROUP_PREFIX}-${ENVIRONMENT}"
    
    print_status "Creating resource group: $rg_name"
    az group create \
        --name "$rg_name" \
        --location "$LOCATION" \
        --tags Environment="$ENVIRONMENT" Project="speek-it"
    
    echo "$rg_name"
}

# Function to generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Function to deploy infrastructure
deploy_infrastructure() {
    local rg_name=$1
    local param_file="parameters/${ENVIRONMENT}.bicepparam"
    
    if [ ! -f "$param_file" ]; then
        print_error "Parameter file not found: $param_file"
        exit 1
    fi
    
    # Generate secure password for PostgreSQL
    local postgres_password=$(generate_password)
    
    print_status "Deploying infrastructure to resource group: $rg_name"
    print_status "Using parameter file: $param_file"
    print_status "Using Azure Container Registry with managed identity authentication"
    
    # Deploy the main template
    az deployment group create \
        --resource-group "$rg_name" \
        --template-file "main.bicep" \
        --parameters "$param_file" \
        --parameters postgresqlAdminPassword="$postgres_password" \
        --verbose
    
    # Store credentials securely (you might want to use Azure Key Vault instead)
    print_status "Deployment completed successfully!"
    print_warning "Please store these credentials securely:"
    echo "PostgreSQL Admin Password: $postgres_password"
    echo ""
    print_status "Azure Container Registry created with managed identity authentication."
    print_status "Container Apps will use managed identity to pull images from ACR."
}

# Function to show deployment outputs
show_outputs() {
    local rg_name=$1
    
    print_status "Retrieving deployment outputs..."
    
    # Get the latest deployment
    local deployment_name=$(az deployment group list \
        --resource-group "$rg_name" \
        --query "[0].name" \
        --output tsv)
    
    if [ -n "$deployment_name" ]; then
        az deployment group show \
            --resource-group "$rg_name" \
            --name "$deployment_name" \
            --query "properties.outputs" \
            --output table
    else
        print_warning "No deployments found in resource group: $rg_name"
    fi
}

# Function to clean up resources
cleanup() {
    local rg_name="${RESOURCE_GROUP_PREFIX}-${ENVIRONMENT}"
    
    print_warning "This will delete the entire resource group: $rg_name"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deleting resource group: $rg_name"
        az group delete --name "$rg_name" --yes --no-wait
        print_status "Resource group deletion initiated"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main script logic
main() {
    print_status "Starting Speek-It infrastructure deployment"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -l|--location)
                LOCATION="$2"
                shift 2
                ;;
            -s|--subscription)
                SUBSCRIPTION_ID="$2"
                shift 2
                ;;
            --cleanup)
                cleanup
                exit 0
                ;;
            --outputs)
                show_outputs "${RESOURCE_GROUP_PREFIX}-${ENVIRONMENT}"
                exit 0
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -e, --environment    Environment (dev, staging, prod)"
                echo "  -l, --location       Azure region"
                echo "  -s, --subscription   Azure subscription ID"
                echo "  --cleanup           Delete all resources"
                echo "  --outputs           Show deployment outputs"
                echo "  -h, --help          Show this help message"
                echo ""
                echo "Example:"
                echo "  $0 --environment dev --location uksouth"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run pre-flight checks
    check_azure_cli
    check_azure_login
    validate_parameters
    set_subscription
    
    # Create resource group and deploy
    local rg_name=$(create_resource_group)
    deploy_infrastructure "$rg_name"
    show_outputs "$rg_name"
    
    print_status "Deployment completed successfully!"
}

# Change to the script directory
cd "$(dirname "$0")/.."

# Run main function with all arguments
main "$@"