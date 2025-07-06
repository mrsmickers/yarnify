#!/bin/bash

# Debug script to check Azure subscription and resource groups

echo "=== Azure Account Debug ==="
echo ""

# Show current account
echo "Current Azure account:"
az account show --query "{Name:name, ID:id, State:state}" -o table

echo ""
echo "Current subscription ID:"
az account show --query id -o tsv

echo ""
echo "=== Checking for SpeekIT Resource Group ==="

# Check if logged in to the right subscription
EXPECTED_SUB="470b7615-9fc2-4ab0-9f82-7541d20873cf"
CURRENT_SUB=$(az account show --query id -o tsv)

if [ "$CURRENT_SUB" != "$EXPECTED_SUB" ]; then
    echo "WARNING: Not in the expected subscription!"
    echo "Expected: $EXPECTED_SUB"
    echo "Current:  $CURRENT_SUB"
    echo ""
    echo "Available subscriptions:"
    az account list --query "[].{Name:name, ID:id}" -o table
    echo ""
    echo "To switch to the correct subscription, run:"
    echo "az account set --subscription $EXPECTED_SUB"
else
    echo "✓ Correct subscription is active"
fi

echo ""
echo "=== Resource Groups in Current Subscription ==="
echo "Listing all resource groups:"
az group list --query "[].{Name:name, Location:location}" -o table

echo ""
echo "=== Checking specific resource group names ==="
for rg in "SpeekIT" "speekit" "SPEEKIT" "Speekit" "speek-it"; do
    echo -n "Checking '$rg': "
    if az group exists --name "$rg" | grep -q "true"; then
        echo "EXISTS ✓"
        echo "  Details:"
        az group show --name "$rg" --query "{Name:name, Location:location, ID:id}" -o table
    else
        echo "NOT FOUND ✗"
    fi
done

echo ""
echo "=== Checking with pattern matching ==="
echo "Resource groups containing 'speek' (case-insensitive):"
az group list --query "[?contains(toLower(name), 'speek')].{Name:name, Location:location}" -o table

echo ""
echo "Resource groups containing 'it' (case-insensitive):"
az group list --query "[?contains(toLower(name), 'it')].{Name:name, Location:location}" -o table