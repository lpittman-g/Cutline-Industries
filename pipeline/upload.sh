#!/bin/bash
# Usage: ./upload.sh <local-path> <folder-in-raw-data>
set -euo pipefail
azcopy copy "$1" "https://artemistrainingdata.blob.core.windows.net/raw-data/${2}?$(cat /etc/artemis/sas-raw)" --recursive
