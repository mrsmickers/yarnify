#!/bin/bash

# Azure Infrastructure Deployment Script for Speek-It Application (Phase 1)
# This script deploys the core infrastructure including ACR, but NOT the Container App

set -e

# Configuration
SUBSCRIPTION_ID="470b7615-9fc2-4ab0-9f82-7541d20873cf"
RESOURCE_GROUP_NAME="SpeekIT"
LOCATION="uksouth"

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

# Function to verify resource group exists
verify_resource_group() {
    print_status "Verifying resource group exists: $RESOURCE_GROUP_NAME"
    if ! az group show --name "$RESOURCE_GROUP_NAME" &>/dev/null; then
        print_error "Resource group '$RESOURCE_GROUP_NAME' does not exist"
        exit 1
    fi
    print_status "Resource group '$RESOURCE_GROUP_NAME' found"
}

# Function to generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Function to deploy infrastructure
deploy_infrastructure() {
    local param_file="parameters/infrastructure.bicepparam"
    
    if [ ! -f "$param_file" ]; then
        print_error "Parameter file not found: $param_file"
        exit 1
    fi
    
    # Check if PostgreSQL server already exists
    local postgres_exists=$(az postgres flexible-server show \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --name "psql-speek-it" \
        --query "name" \
        --output tsv 2>/dev/null || echo "")
    
    # Handle PostgreSQL password
    local postgres_password=""
    if [ -z "$postgres_exists" ]; then
        postgres_password=$(generate_password)
        print_status "Creating new PostgreSQL server with generated password"
    else
        print_status "PostgreSQL server already exists, using placeholder password"
        # Use the existing password from environment or a placeholder
        postgres_password="${POSTGRESQL_ADMIN_PASSWORD:-ExistingPasswordNotChanged123!}"
        print_warning "Note: The existing PostgreSQL password will NOT be changed"
    fi
    
    print_status "Deploying core infrastructure to resource group: $RESOURCE_GROUP_NAME"
    print_status "Using parameter file: $param_file"
    print_status "This includes ACR, databases, networking, managed identities, but NOT the Container App"
    
    # Deploy the infrastructure template
    az deployment group create \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --template-file "infrastructure.bicep" \
        --parameters "$param_file" \
        --parameters postgresqlAdminPassword="$postgres_password" \
        --verbose
    
    # Store credentials securely (you might want to use Azure Key Vault instead)
    print_status "Infrastructure deployment completed successfully!"
    if [ -z "$postgres_exists" ]; then
        print_warning "Please store these credentials securely:"
        echo "PostgreSQL Admin Password: $postgres_password"
    fi
}

# Function to show deployment outputs
show_outputs() {
    print_status "Retrieving deployment outputs..."
    
    # Get the latest deployment
    local deployment_name=$(az deployment group list \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query "[0].name" \
        --output tsv)
    
    if [ -n "$deployment_name" ]; then
        az deployment group show \
            --resource-group "$RESOURCE_GROUP_NAME" \
            --name "$deployment_name" \
            --query "properties.outputs" \
            --output table
    else
        print_warning "No deployments found in resource group: $RESOURCE_GROUP_NAME"
    fi
}

# Main script logic
main() {
    print_status "Starting Speek-It infrastructure deployment to SpeekIT resource group"
    
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
            --outputs)
                show_outputs
                exit 0
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -l, --location       Azure region (default: uksouth)"
                echo "  -s, --subscription   Azure subscription ID (default: preset)"
                echo "  --outputs           Show deployment outputs"
                echo "  -h, --help          Show this help message"
                echo ""
                echo "This deploys to the existing SpeekIT resource group in subscription 470b7615-9fc2-4ab0-9f82-7541d20873cf"
                echo ""
                echo "Examples:"
                echo "  $0                    # Deploy infrastructure"
                echo "  $0 --outputs          # Show deployment outputs"
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
    # Skip verify_resource_group - we know it exists
    
    # Deploy to existing resource group
    deploy_infrastructure
    show_outputs
    
    print_status "Infrastructure deployment completed successfully!"
    print_status "ACR URL: $(az deployment group show --resource-group "$RESOURCE_GROUP_NAME" --name "infrastructure" --query "properties.outputs.containerRegistryLoginServer.value" --output tsv)"
    echo ""
    print_status "Next steps:"
    print_status "1. Push container images via GitHub Actions (using existing service principal)"
    print_status "2. Deploy Container App: ./deploy-container-app.sh"
}

# Change to the script directory
cd "$(dirname "$0")/.."

# Run main function with all arguments
main "$@"