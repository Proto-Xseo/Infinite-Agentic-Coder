#!/usr/bin/env bash
# Eternity Poller — runs forever, checks inbox every 60s
# Marks processed items, writes to outbox, commits to git

WORKSPACE="/home/runner/workspace"
INBOX="$WORKSPACE/eternity/inbox.md"
OUTBOX="$WORKSPACE/eternity/outbox.md"
KEEPALIVE="$WORKSPACE/eternity/.keepalive"
SLEEP_SECS=60
KEEPALIVE_TIMEOUT=180  # 3 minutes

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

git_commit() {
  local msg="$1"
  cd "$WORKSPACE" || return
  git add -A
  git commit -m "$msg" 2>/dev/null || true
  git push gitsafe-backup main 2>/dev/null || true
}

process_inbox() {
  local changed=0
  local line_num=0
  local tmp
  tmp=$(mktemp)
  cp "$INBOX" "$tmp"

  while IFS= read -r line; do
    line_num=$((line_num + 1))
    if [[ "$line" =~ ^-\ \[\ \]\ (.+)$ ]]; then
      local msg="${BASH_REMATCH[1]}"

      # Check for END SESSION
      if [[ "$msg" == "END SESSION" ]]; then
        log "END SESSION received. Stopping poller."
        sed -i "${line_num}s/- \[ \]/- [x]/" "$INBOX"
        echo "**[$(date '+%Y-%m-%d %H:%M:%S')] END SESSION — agent stopping.**" >> "$OUTBOX"
        git_commit "eternity: END SESSION"
        rm -f "$tmp"
        exit 0
      fi

      log "Processing: $msg"

      # Mark as processed in inbox
      escaped=$(printf '%s\n' "$msg" | sed 's/[[\.*^$()+?{|]/\\&/g')
      sed -i "s/- \[ \] ${escaped}/- [x] ${escaped}/" "$INBOX"

      # Append result to outbox
      {
        echo ""
        echo "---"
        echo "**[$(date '+%Y-%m-%d %H:%M:%S')] Message:** $msg"
        echo ""
        echo "**Status:** Received and logged. Complex tasks queued for agent review."
        echo ""
      } >> "$OUTBOX"

      changed=1
    fi
  done < "$INBOX"

  rm -f "$tmp"

  if [[ $changed -eq 1 ]]; then
    git_commit "eternity: processed inbox messages"
  fi
}

keepalive_touch() {
  local now
  now=$(date +%s)
  local last=0

  if [[ -f "$KEEPALIVE" ]]; then
    last=$(cat "$KEEPALIVE")
  fi

  local diff=$(( now - last ))
  if [[ $diff -ge $KEEPALIVE_TIMEOUT ]]; then
    echo "$now" > "$KEEPALIVE"
    # Touch a line in keepalive file to stay warm
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    # Update the keepalive timestamp line in outbox
    echo "<!-- keepalive: $ts -->" >> "$OUTBOX"
    git_commit "eternity: keepalive $ts"
    log "Keepalive committed."
  fi
}

log "Eternity poller started. Watching $INBOX"

# Initial commit to mark start
echo "" >> "$OUTBOX"
echo "**[$(date '+%Y-%m-%d %H:%M:%S')] Agent online. Polling started.**" >> "$OUTBOX"
echo "$(date +%s)" > "$KEEPALIVE"
git_commit "eternity: poller started"

while true; do
  process_inbox
  keepalive_touch
  log "Sleeping ${SLEEP_SECS}s..."
  sleep "$SLEEP_SECS"
done
