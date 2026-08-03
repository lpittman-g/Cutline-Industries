#!/usr/bin/env bash
# Cutline AWS media bootstrap helpers (run where AWS CLI v2 is configured).
# Setup: docs/AWS-CLI.md — https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html
set -euo pipefail

BUCKET="${CUTLINE_MEDIA_BUCKET:-cutline-media-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo demo)}"
REGION="${AWS_REGION:-us-east-1}"

echo "Bucket: s3://${BUCKET} (region ${REGION})"

if [[ "${1:-}" == "create-bucket" ]]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    $([ "$REGION" = "us-east-1" ] || echo --create-bucket-configuration LocationConstraint="$REGION")
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  echo "Created s3://${BUCKET}"
  exit 0
fi

if [[ "${1:-}" == "sync-inbox" ]]; then
  ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  aws s3 sync "$ROOT/inbox" "s3://${BUCKET}/inbox/" --exclude ".gitkeep"
  aws s3 sync "$ROOT/shorts_out" "s3://${BUCKET}/shorts_out/" --exclude ".gitkeep"
  echo "Synced inbox/ and shorts_out/ to s3://${BUCKET}"
  exit 0
fi

cat <<EOF
Usage:
  CUTLINE_MEDIA_BUCKET=your-bucket $0 create-bucket
  CUTLINE_MEDIA_BUCKET=your-bucket $0 sync-inbox

AWS roles in Cutline:
  S3      raw footage, thumbs, audio, exports
  Lambda/EC2  FFmpeg processing / Autopilot
  DynamoDB    pipeline status + analytics logs
EOF
