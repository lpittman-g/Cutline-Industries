#!/bin/bash
WATCH_DIR=/data/inbox
DEST=https://artemistrainingdata.blob.core.windows.net/raw-data
echo "$(date -Is) watching $WATCH_DIR"
inotifywait -m -r -e close_write,moved_to "$WATCH_DIR" --format '%w%f' | while IFS= read -r FILEPATH; do
  [ -f "$FILEPATH" ] || continue
  REL="${FILEPATH#"$WATCH_DIR"/}"
  if azcopy copy "$FILEPATH" "$DEST/$REL?$(cat /etc/artemis/sas-raw)" --log-level ERROR >/dev/null; then
    echo "$(date -Is) uploaded $REL"
  else
    echo "$(date -Is) FAILED $REL"
  fi
done
