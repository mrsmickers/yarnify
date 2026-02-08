#!/bin/bash
# Deploy staging environment via Coolify API
set -e

source /home/simon/clawd/.env
export BWS_ACCESS_TOKEN="$BITWARDEN_ACCESS_TOKEN"
COOLIFY_TOKEN=$(bws secret get 27b071a6-c84f-4861-a37e-b3e800e661f0 | jq -r '.value')

echo "Triggering staging deploy..."
RESULT=$(curl -s -X POST "http://100.99.183.58:8000/api/v1/applications/d4k0k00cwoog4kc0c4884kgk/restart" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json")

echo "$RESULT" | jq .
DEPLOY_UUID=$(echo "$RESULT" | jq -r '.deployment_uuid // empty')

if [ -n "$DEPLOY_UUID" ]; then
  echo "Deployment UUID: $DEPLOY_UUID"
  echo "Waiting for deployment (checking every 30s, max 10 min)..."
  
  for i in $(seq 1 20); do
    sleep 30
    STATUS=$(curl -s "http://100.99.183.58:8000/api/v1/deployments/$DEPLOY_UUID" \
      -H "Authorization: Bearer $COOLIFY_TOKEN" | jq -r '.status // "unknown"')
    echo "  [$i] Status: $STATUS"
    
    if [ "$STATUS" = "finished" ] || [ "$STATUS" = "success" ]; then
      echo "✅ Deployment successful!"
      exit 0
    elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ] || [ "$STATUS" = "cancelled" ]; then
      echo "❌ Deployment failed: $STATUS"
      exit 1
    fi
  done
  
  echo "⚠️ Deployment still in progress after 10 minutes"
  exit 2
fi
