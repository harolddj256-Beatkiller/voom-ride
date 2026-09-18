#!/bin/bash
cd "$(dirname "$0")" || exit 1
clear
printf '\n==================================\n   BEKLO - MAKE THE IPHONE APP\n==================================\n\n'
source scripts/setup.sh
node scripts/iphone-build.cjs
pause_exit $?
