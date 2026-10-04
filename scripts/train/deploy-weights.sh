#!/usr/bin/env bash
# Deploy Artemis weights to Azure Container Apps.
#
# Two modes:
#   --base   Use the public gpt2 model directly (instant, no training needed)
#   --fine   Upload a fine-tuned checkpoint from ./artemis-checkpoint
#
# Usage:
#   bash scripts/train/deploy-weights.sh --base          # get live now
#   bash scripts/train/deploy-weights.sh --fine          # after training
#
# Prerequisites:
#   az login  (or az login --use-device-code)
#   az extension add --name containerapp  (if not already installed)
#
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-}"
CONTAINER_APP="artemis-api"
ENVIRONMENT="whitemeadow-751c0637"

# Derive resource group from the container app if not set
if [[ -z "$RESOURCE_GROUP" ]]; then
  echo "[deploy-weights] Looking up resource group for $CONTAINER_APP…"
  RESOURCE_GROUP=$(az containerapp show --name "$CONTAINER_APP" --query resourceGroup -o tsv 2>/dev/null || true)
  if [[ -z "$RESOURCE_GROUP" ]]; then
    echo "[deploy-weights] ERROR: set RESOURCE_GROUP env var or log in with az login"
    exit 1
  fi
fi

echo "[deploy-weights] Container App : $CONTAINER_APP"
echo "[deploy-weights] Resource Group: $RESOURCE_GROUP"

MODE="${1:---base}"

if [[ "$MODE" == "--base" ]]; then
  # Point directly at gpt2 on HuggingFace — no weights to upload.
  # The container downloads ~500 MB on first start then caches in the volume.
  echo "[deploy-weights] Mode: base (gpt2 from HuggingFace)"
  az containerapp update \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars "ARTEMIS_MODEL_PATH=gpt2" \
    --output table
  echo "[deploy-weights] Done. Container will restart and download gpt2 (~500 MB)."
  echo "  Check: az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --follow"

elif [[ "$MODE" == "--fine" ]]; then
  CHECKPOINT="${CHECKPOINT:-./artemis-checkpoint}"
  ACR="${ACR:-}"  # Azure Container Registry, e.g. cutlineacr.azurecr.io

  if [[ ! -d "$CHECKPOINT" ]]; then
    echo "[deploy-weights] ERROR: checkpoint not found at $CHECKPOINT"
    echo "  Run: python scripts/train/corpus.py && python scripts/train/train.py"
    exit 1
  fi

  if [[ -z "$ACR" ]]; then
    echo "[deploy-weights] ERROR: set ACR=<registry>.azurecr.io to upload a custom image"
    exit 1
  fi

  echo "[deploy-weights] Mode: fine-tuned checkpoint ($CHECKPOINT)"

  # Build and push a new image with the checkpoint baked in
  IMAGE="$ACR/artemis-serve:$(date +%Y%m%d-%H%M)"
  echo "[deploy-weights] Building image $IMAGE…"
  docker build \
    -f scripts/serve/Dockerfile.artemis-serve \
    --build-arg CHECKPOINT_DIR="$CHECKPOINT" \
    -t "$IMAGE" \
    .

  echo "[deploy-weights] Pushing $IMAGE…"
  az acr login --name "${ACR%%.*}"
  docker push "$IMAGE"

  echo "[deploy-weights] Updating Container App to $IMAGE…"
  az containerapp update \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$IMAGE" \
    --set-env-vars "ARTEMIS_MODEL_PATH=/app/checkpoint" \
    --output table

  echo "[deploy-weights] Done. New revision rolling out with fine-tuned weights."

else
  echo "Usage: $0 --base | --fine"
  exit 1
fi
