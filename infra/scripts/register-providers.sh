#!/bin/bash

# Script to register required Azure resource providers

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_status "Registering required Azure resource providers..."

# Register required providers
providers=(
    "Microsoft.Cache"
    "Microsoft.DBforPostgreSQL"
    "Microsoft.ContainerRegistry"
    "Microsoft.Storage"
    "Microsoft.App"
    "Microsoft.OperationalInsights"
    "Microsoft.Insights"
    "Microsoft.Network"
    "Microsoft.ManagedIdentity"
    "Microsoft.Authorization"
)

for provider in "${providers[@]}"; do
    print_status "Registering $provider..."
    az provider register --namespace "$provider"
done

print_status "Waiting for registrations to complete..."
for provider in "${providers[@]}"; do
    print_status "Checking $provider..."
    az provider show --namespace "$provider" --query "registrationState" -o tsv
done

print_status "Provider registration completed!"
print_warning "Note: Some providers may take a few minutes to fully register."