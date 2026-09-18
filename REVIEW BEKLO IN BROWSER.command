#!/bin/bash
cd "$(dirname "$0")" || exit 1
clear
printf '\n====================================\n   BEKLO - QUICK LOOK IN BROWSER\n====================================\n\n'
source scripts/setup.sh
echo 'Opening Beklo in your browser...'
echo 'Keep this Terminal window open. Press Control + C when you are finished.'
./node_modules/.bin/expo start --web
status=$?
[ "$status" -eq 0 ] || [ "$status" -eq 130 ] || pause_exit "$status"
