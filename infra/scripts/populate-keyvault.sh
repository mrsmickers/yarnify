#!/bin/bash

# Script to populate Key Vault with secrets for the Speek-It application

set -e

# Configuration
RESOURCE_GROUP_NAME="SpeekIT"

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

# Function to get infrastructure outputs
get_infrastructure_outputs() {
    print_status "Getting infrastructure deployment outputs..."
    
    local outputs=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --name "infrastructure" \
        --query "properties.outputs")
    
    echo "$outputs"
}

# Function to set secret in Key Vault
set_keyvault_secret() {
    local vault_name=$1
    local secret_name=$2
    local secret_value=$3
    
    print_status "Setting secret: $secret_name"
    az keyvault secret set \
        --vault-name "$vault_name" \
        --name "$secret_name" \
        --value "$secret_value" \
        --output none
}

# Main function
main() {
    print_status "Populating Key Vault with secrets for Speek-It application"
    
    # Get infrastructure outputs
    local outputs=$(get_infrastructure_outputs)
    
    # Extract values
    local key_vault_name=$(echo "$outputs" | jq -r '.keyVaultName.value')
    local postgres_connection=$(echo "$outputs" | jq -r '.postgresqlConnectionString.value')
    local redis_connection=$(echo "$outputs" | jq -r '.redisConnectionString.value')
    local storage_connection=$(echo "$outputs" | jq -r '.storageConnectionString.value')
    local app_insights_connection=$(echo "$outputs" | jq -r '.applicationInsightsConnectionString.value')
    
    if [ -z "$key_vault_name" ] || [ "$key_vault_name" == "null" ]; then
        print_error "Could not retrieve Key Vault name from infrastructure deployment"
        exit 1
    fi
    
    print_status "Using Key Vault: $key_vault_name"
    
    # Set infrastructure secrets
    set_keyvault_secret "$key_vault_name" "database-url" "$postgres_connection"
    set_keyvault_secret "$key_vault_name" "redis-url" "$redis_connection"
    set_keyvault_secret "$key_vault_name" "storage-connection-string" "$storage_connection"
    set_keyvault_secret "$key_vault_name" "app-insights-connection-string" "$app_insights_connection"
    
    # Handle OpenAI API Key
    if [ -n "$OPENAI_API_KEY" ]; then
        print_status "Setting OpenAI API Key from environment variable"
        set_keyvault_secret "$key_vault_name" "openai-api-key" "$OPENAI_API_KEY"
    else
        print_warning "OPENAI_API_KEY environment variable not set"
        print_warning "You'll need to set it manually:"
        echo "az keyvault secret set --vault-name $key_vault_name --name openai-api-key --value 'your-openai-api-key'"
    fi
    
    print_status "Key Vault population completed!"
    print_status "Secrets created:"
    echo "- database-url"
    echo "- redis-url"
    echo "- storage-connection-string"
    echo "- app-insights-connection-string"
    echo "- openai-api-key (if OPENAI_API_KEY was set)"
    
    print_warning "To view secrets:"
    echo "az keyvault secret list --vault-name $key_vault_name --output table"
}

# Run main function
main "$@"