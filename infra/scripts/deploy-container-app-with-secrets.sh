#!/bin/bash

# Azure Container App Deployment Script with Secrets for Speek-It Application
# This script deploys the Container App with secrets from GitHub Actions

set -e

# Configuration
SUBSCRIPTION_ID="470b7615-9fc2-4ab0-9f82-7541d20873cf"
RESOURCE_GROUP_NAME="SpeekIT"
IMAGE_TAG="${1:-latest}"

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

# Function to validate required secrets
validate_secrets() {
    local missing_secrets=()
    
    if [ -z "$CONNECTWISE_PRIVATE_KEY" ]; then
        missing_secrets+=("CONNECTWISE_PRIVATE_KEY")
    fi
    
    if [ -z "$OPENAI_API_KEY" ]; then
        missing_secrets+=("OPENAI_API_KEY")
    fi
    
    if [ -z "$VOIP_PASSWORD" ]; then
        missing_secrets+=("VOIP_PASSWORD")
    fi
    
    if [ -z "$WORKOS_API_KEY" ]; then
        missing_secrets+=("WORKOS_API_KEY")
    fi
    
    if [ -z "$POSTGRESQL_ADMIN_PASSWORD" ]; then
        print_warning "POSTGRESQL_ADMIN_PASSWORD not provided, will try to retrieve from deployment history"
    fi
    
    if [ ${#missing_secrets[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for secret in "${missing_secrets[@]}"; do
            echo "  - $secret"
        done
        print_error "Please set these environment variables before running this script."
        exit 1
    fi
}

# Function to deploy container app with secrets
deploy_container_app() {
    local param_file="parameters/container-app-with-secrets-dev.bicepparam"
    
    if [ ! -f "$param_file" ]; then
        print_error "Parameter file not found: $param_file"
        exit 1
    fi
    
    print_status "Deploying Container App with secrets to resource group: $RESOURCE_GROUP_NAME"
    print_status "Using parameter file: $param_file"
    print_status "Image tag: $IMAGE_TAG"
    
    # Get PostgreSQL password if not provided
    if [ -z "$POSTGRESQL_ADMIN_PASSWORD" ]; then
        print_status "Retrieving PostgreSQL password from deployment parameters..."
        # Note: This requires the password to be passed as a parameter when deploying
        print_error "PostgreSQL admin password is required but not provided."
        print_error "Please set POSTGRESQL_ADMIN_PASSWORD environment variable."
        exit 1
    fi
    
    # Ensure ACR role assignment exists
    print_status "Ensuring ACR role assignment exists..."
    local managed_identity_principal_id=$(az identity show --resource-group "$RESOURCE_GROUP_NAME" --name "id-speek-it" --query "principalId" --output tsv)
    local acr_id=$(az acr show --resource-group "$RESOURCE_GROUP_NAME" --name "crspeekit" --query "id" --output tsv)
    
    # Check if role assignment already exists
    local existing_assignment=$(az role assignment list --assignee "$managed_identity_principal_id" --scope "$acr_id" --role "AcrPull" --query "[0].id" --output tsv)
    
    if [ -z "$existing_assignment" ] || [ "$existing_assignment" == "null" ]; then
        print_status "Creating AcrPull role assignment..."
        az role assignment create --role "AcrPull" --assignee "$managed_identity_principal_id" --scope "$acr_id" || true
        # Wait a moment for the role assignment to propagate
        sleep 10
    else
        print_status "AcrPull role assignment already exists"
    fi
    
    # Deploy the container app template with secrets
    az deployment group create \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --template-file "container-app-with-secrets.bicep" \
        --parameters "$param_file" \
        --parameters imageTag="$IMAGE_TAG" \
                     connectwisePrivateKey="$CONNECTWISE_PRIVATE_KEY" \
                     openaiApiKey="$OPENAI_API_KEY" \
                     voipPassword="$VOIP_PASSWORD" \
                     workosApiKey="$WORKOS_API_KEY" \
                     postgresqlAdminPassword="$POSTGRESQL_ADMIN_PASSWORD" \
        --verbose
    
    print_status "Container App deployment completed successfully!"
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
    print_status "Starting Container App deployment with secrets"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --outputs)
                show_outputs
                exit 0
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS] [IMAGE_TAG]"
                echo "Options:"
                echo "  -t, --tag           Docker image tag (default: latest)"
                echo "  --outputs           Show deployment outputs"
                echo "  -h, --help          Show this help message"
                echo ""
                echo "Required environment variables:"
                echo "  CONNECTWISE_PRIVATE_KEY"
                echo "  OPENAI_API_KEY"
                echo "  VOIP_PASSWORD"
                echo "  WORKOS_API_KEY"
                echo "  POSTGRESQL_ADMIN_PASSWORD"
                echo ""
                echo "Example:"
                echo "  $0 v1.0.0"
                echo "  OPENAI_API_KEY=sk-... $0 --tag latest"
                exit 0
                ;;
            *)
                IMAGE_TAG="$1"
                shift
                ;;
        esac
    done
    
    # Run pre-flight checks
    check_azure_cli
    check_azure_login
    set_subscription
    validate_secrets
    
    # Deploy container app
    deploy_container_app
    show_outputs
    
    print_status "Container App deployment completed successfully!"
    
    # Get the application URL
    local app_url=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --name "container-app-with-secrets" \
        --query "properties.outputs.applicationUrl.value" \
        --output tsv 2>/dev/null || echo "URL not available")
    
    if [ "$app_url" != "URL not available" ]; then
        print_status "Application URL: $app_url"
    fi
}

# Change to the script directory
cd "$(dirname "$0")/.."

# Run main function with all arguments
main "$@"