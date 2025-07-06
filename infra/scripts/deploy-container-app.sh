#!/bin/bash

# Azure Container App Deployment Script for Speek-It Application (Phase 2)
# This script deploys the Container App after the infrastructure and image are ready

set -e

# Configuration
SUBSCRIPTION_ID="470b7615-9fc2-4ab0-9f82-7541d20873cf"
RESOURCE_GROUP_NAME="SpeekIT"
LOCATION="uksouth"
IMAGE_TAG="latest"

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
    if [ -z "$LOCATION" ]; then
        print_error "Location parameter is required"
        exit 1
    fi
}

# Function to get infrastructure outputs
get_infrastructure_outputs() {
    print_status "Retrieving infrastructure deployment outputs..."
    
    # Check if infrastructure deployment exists
    local infra_deployment=$(az deployment group list \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query "[?name=='infrastructure']" \
        --output tsv 2>/dev/null || echo "")
    
    if [ -z "$infra_deployment" ]; then
        print_error "Infrastructure deployment not found. Please run deploy-infrastructure.sh first."
        exit 1
    fi
    
    # Get outputs from infrastructure deployment
    local outputs=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --name "infrastructure" \
        --query "properties.outputs")
    
    echo "$outputs"
}

# Function to deploy container app
deploy_container_app() {
    local param_file="parameters/container-app.bicepparam"
    
    if [ ! -f "$param_file" ]; then
        print_error "Parameter file not found: $param_file"
        exit 1
    fi
    
    # Get infrastructure outputs
    local outputs=$(get_infrastructure_outputs)
    
    # Extract required values from outputs
    local container_apps_env_id=$(echo "$outputs" | jq -r '.containerAppsEnvironmentId.value')
    local acr_login_server=$(echo "$outputs" | jq -r '.containerRegistryLoginServer.value')
    local managed_identity_id=$(echo "$outputs" | jq -r '.managedIdentityId.value')
    local key_vault_name=$(echo "$outputs" | jq -r '.keyVaultName.value')
    
    print_status "Deploying Container App to resource group: $RESOURCE_GROUP_NAME"
    print_status "Using parameter file: $param_file"
    print_status "Container image: ${acr_login_server}/speek-it-api:${IMAGE_TAG}"
    
    # Check if image exists in ACR
    local acr_name=$(echo "$acr_login_server" | cut -d'.' -f1)
    if ! az acr repository show --name "$acr_name" --repository "speek-it-api" &>/dev/null; then
        print_warning "Container image 'speek-it-api:${IMAGE_TAG}' not found in ACR."
        print_warning "Please push your image to ACR first using GitHub Actions or manual push."
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled. Push your image first."
            exit 0
        fi
    fi
    
    # Deploy the container app template
    az deployment group create \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --template-file "container-app.bicep" \
        --parameters "$param_file" \
        --parameters imageTag="$IMAGE_TAG" \
        --parameters containerAppsEnvironmentId="$container_apps_env_id" \
        --parameters containerRegistryLoginServer="$acr_login_server" \
        --parameters managedIdentityId="$managed_identity_id" \
        --parameters keyVaultName="$key_vault_name" \
        --verbose
    
    print_status "Container App deployment completed successfully!"
}

# Function to show deployment outputs
show_outputs() {
    print_status "Retrieving Container App deployment outputs..."
    
    # Get the container app deployment
    local deployment_name=$(az deployment group list \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query "[?name=='container-app'][0].name" \
        --output tsv)
    
    if [ -n "$deployment_name" ]; then
        local app_url=$(az deployment group show \
            --resource-group "$RESOURCE_GROUP_NAME" \
            --name "$deployment_name" \
            --query "properties.outputs.containerAppUrl.value" \
            --output tsv)
        
        print_status "Container App URL: $app_url"
        
        az deployment group show \
            --resource-group "$RESOURCE_GROUP_NAME" \
            --name "$deployment_name" \
            --query "properties.outputs" \
            --output table
    else
        print_warning "No Container App deployments found in resource group: $RESOURCE_GROUP_NAME"
    fi
}

# Main script logic
main() {
    print_status "Starting Speek-It Container App deployment to SpeekIT resource group"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -l|--location)
                LOCATION="$2"
                shift 2
                ;;
            -s|--subscription)
                SUBSCRIPTION_ID="$2"
                shift 2
                ;;
            -t|--image-tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --outputs)
                show_outputs
                exit 0
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -l, --location       Azure region (default: uksouth)"
                echo "  -s, --subscription   Azure subscription ID (default: preset)"
                echo "  -t, --image-tag      Docker image tag (default: latest)"
                echo "  --outputs           Show deployment outputs"
                echo "  -h, --help          Show this help message"
                echo ""
                echo "This deploys to the existing SpeekIT resource group in subscription 470b7615-9fc2-4ab0-9f82-7541d20873cf"
                echo ""
                echo "Example:"
                echo "  $0"
                echo "  $0 --image-tag sha-abc123"
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
    
    # Deploy container app
    deploy_container_app
    show_outputs
    
    print_status "Container App deployment completed successfully!"
}

# Change to the script directory
cd "$(dirname "$0")/.."

# Run main function with all arguments
main "$@"