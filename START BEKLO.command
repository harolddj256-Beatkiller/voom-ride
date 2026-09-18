#!/bin/bash
cd "$(dirname "$0")" || exit 1
clear
printf '\n==================================\n     BEKLO v2.1 - EXPO GO\n==================================\n\n'
source scripts/setup.sh
printf '\nStarting Beklo...\n'
echo 'Open the Expo Go app on your phone and scan the QR code below.'
echo 'Keep the Mac and phone on the same Wi-Fi network.'
echo 'Keep this window open. To stop, press Control + C.'
echo
./node_modules/.bin/expo start --go --lan --clear
status=$?
if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
  echo 'Expo stopped with an error. Please share the last lines above.'
  pause_exit "$status"
fi
