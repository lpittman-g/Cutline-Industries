#!/usr/bin/env bash
set -euo pipefail
DOMAIN=cutline-industries.studio
WANT_NS=(ns-1727.awsdns-23.co.uk ns-964.awsdns-56.net ns-1261.awsdns-29.org ns-57.awsdns-07.com)
APP=dlbg4dsrs0mjb
REGION=us-east-2
LOG=/tmp/thermal-dns-watch.log
STATE=/tmp/thermal-dns-watch.state
echo "watching $DOMAIN -> Route53/Amplify" | tee -a "$LOG"
while true; do
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  NS=$(dig @8.8.8.8 NS "$DOMAIN" +short 2>/dev/null | tr 'A-Z' 'a-z' | sed 's/\.$//' | sort)
  echo "$TS ns:" $NS >>"$LOG"
  OK=1
  for n in "${WANT_NS[@]}"; do
    echo "$NS" | grep -qi "^${n}$" || OK=0
  done
  TITLE_WWW=$(curl -sS -L --max-time 20 "https://www.$DOMAIN/" 2>/dev/null | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' | head -1)
  TITLE_APEX=$(curl -sS -L --max-time 20 "https://$DOMAIN/" 2>/dev/null | tr '\n' ' ' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' | head -1)
  echo "$TS titles www='$TITLE_WWW' apex='$TITLE_APEX'" >>"$LOG"
  if [[ "$OK" == "1" ]]; then
    echo "$TS ROUTE53_NS_LIVE" | tee -a "$LOG"
    # refresh amplify association status if permitted
    aws amplify get-domain-association --app-id "$APP" --domain-name "$DOMAIN" --region "$REGION" --output json > /tmp/amplify-domain.json 2>>"$LOG" || true
    if echo "$TITLE_WWW$TITLE_APEX" | grep -qi Thermal; then
      echo LIVE >"$STATE"
      echo "$TS THERMAL_LIVE_ON_CUSTOM_DOMAIN" | tee -a "$LOG"
      exit 0
    fi
    echo WAITING_CONTENT >"$STATE"
  else
    echo WAITING_NS >"$STATE"
  fi
  sleep 120
done
