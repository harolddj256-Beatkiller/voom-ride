#!/bin/bash
cd "$(dirname "$0")" || exit 1
clear
printf '\n====================================\n   VOOM — ONE-CLICK BROWSER REVIEW\n====================================\n\n'

finish() {
  echo
  read -n 1 -s -r -p 'Press any key to close...'
  echo
  exit "${1:-1}"
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'VOOM needs Node.js 22.13 or newer. Install it from https://nodejs.org and double-click this file again.'
  finish 1
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<22||(major===22&&minor<13))process.exit(1)' || {
  echo 'Your Node.js is too old. Install Node.js 22.13 or newer.'
  finish 1
}

export npm_config_cache="$HOME/Library/Caches/VOOM/npm"
mkdir -p "$npm_config_cache" || finish 1
manifest_hash=$(shasum package.json | awk '{print $1}')
saved_hash=$(cat .voom-review-installed 2>/dev/null || true)
if [ ! -x node_modules/.bin/expo ] || [ "$manifest_hash" != "$saved_hash" ]; then
  echo 'Preparing VOOM. The first opening can take a few minutes...'
  npm install --include=dev --no-audit --no-fund --progress=false || {
    echo 'Setup failed. Check your internet connection, then double-click this file again.'
    finish 1
  }
  printf '%s\n' "$manifest_hash" > .voom-review-installed
fi

npm run check:syntax || finish 1
echo
echo 'Opening VOOM in your browser...'
echo 'Keep this Terminal window open while reviewing the app.'
echo 'Press Control + C here when you are finished.'
./node_modules/.bin/expo start --web
status=$?
[ "$status" -eq 0 ] || [ "$status" -eq 130 ] || finish "$status"
