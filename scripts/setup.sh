#!/bin/bash
# Shared by the Beklo launchers: checks Node.js and installs app packages.
# macOS, user-local only. No sudo, no global npm edits, no cache deletion.
pause_exit() {
  echo
  read -n 1 -s -r -p 'Press any key to close...'
  echo
  exit "${1:-1}"
}
for tool in node npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo 'Beklo needs Node.js. Install it from https://nodejs.org (the LTS button), then double-click this file again.'
    pause_exit 1
  fi
done
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<22||(major===22&&minor<13))process.exit(1)' || {
  echo 'Your Node.js is too old. Install Node.js 22.13 or newer from https://nodejs.org, then try again.'; pause_exit 1;
}
[ -f package.json ] && [ -f App.js ] || { echo 'Keep this file inside the Beklo folder.'; pause_exit 1; }
VOOM_CACHE="$HOME/Library/Caches/Beklo/npm"
mkdir -p "$VOOM_CACHE" || { echo 'Cannot create the private Beklo cache.'; pause_exit 1; }
export npm_config_cache="$VOOM_CACHE"
export npm_config_registry='https://registry.npmjs.org/'
export npm_config_fetch_retries=3
export npm_config_fetch_retry_mintimeout=4000
export npm_config_fetch_retry_maxtimeout=20000
export npm_config_fetch_timeout=90000
export npm_config_maxsockets=2
export NODE_OPTIONS="--dns-result-order=ipv4first ${NODE_OPTIONS:-}"
export EXPO_UNSTABLE_BONJOUR=0
manifest_hash=$(shasum package.json | awk '{print $1}')
saved_hash=$(cat .beklo-deps-installed 2>/dev/null || true)
if [ ! -x node_modules/.bin/expo ] || [ "$manifest_hash" != "$saved_hash" ]; then
  echo 'Installing dependencies. First launch needs internet.'
  echo 'Existing Beklo downloads are reused; your global npm cache is untouched.'
  success=0
  for attempt in 1 2 3; do
    echo "Install attempt $attempt of 3..."
    npm install --include=dev --prefer-offline --no-audit --no-fund --progress=false > .beklo-install.log 2>&1
    result=$?
    if [ "$result" -eq 0 ] && [ -x node_modules/.bin/expo ]; then
      success=1; printf '%s\n' "$manifest_hash" > .beklo-deps-installed; break
    fi
    tail -n 15 .beklo-install.log
    if grep -Eq 'ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|EINTEGRITY' .beklo-install.log; then
      [ "$attempt" -lt 3 ] && { echo 'Download interrupted. Retrying with cached packages...'; sleep 6; }
    else
      echo 'This is not a temporary download error; stopping instead of retrying blindly.'
      break
    fi
  done
  if [ "$success" -ne 1 ]; then
    echo 'Installation did not complete. Details: .beklo-install.log in this folder.'
    echo 'Keep the folder. Relaunch to retry; no completed-install marker was written.'
    pause_exit 1
  fi
fi
node tests/check-syntax.cjs >/dev/null || { node tests/check-syntax.cjs; echo 'Code check failed; please share the error above.'; pause_exit 1; }
