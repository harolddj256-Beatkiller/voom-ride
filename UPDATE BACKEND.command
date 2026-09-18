#!/bin/bash
# Sends the new Beklo backend to your Vercel project "voom-backend"
# and (optionally) sets your admin phone number. Nothing on your Mac is changed.
cd "$(dirname "$0")" || exit 1
clear
printf '\n====================================\n   BEKLO - UPDATE THE ONLINE BRAIN\n====================================\n\n'
pause_exit() { echo; read -n 1 -s -r -p 'Press any key to close...'; echo; exit "${1:-1}"; }
command -v node >/dev/null 2>&1 && command -v npx >/dev/null 2>&1 || {
  echo 'Beklo needs Node.js. Install it from https://nodejs.org, then try again.'; pause_exit 1; }
[ -f backend/package.json ] || { echo 'Keep this file inside the Beklo folder.'; pause_exit 1; }
export npm_config_cache="$HOME/Library/Caches/Beklo/npm"
VERCEL="npx --yes vercel@latest"
PROJECT="voom-backend"

echo 'STEP 1 of 5 - Sign in to Vercel'
echo 'Getting the Vercel helper. The first time this can take a minute with no messages...'
if ! $VERCEL whoami >/dev/null 2>&1; then
  echo
  echo 'Vercel will now show a LINK and a short CODE below.'
  echo '  - If it says "Press ENTER", press the Enter key and your browser opens.'
  echo '  - If no browser opens, copy the link into Safari or Chrome yourself.'
  echo 'Sign in with the same account you used for voom-backend, then come back here.'
  echo
  $VERCEL login || { echo 'Vercel sign-in did not finish. Try again.'; pause_exit 1; }
fi
echo "Signed in as: $($VERCEL whoami 2>/dev/null | tail -1)"

echo
echo 'STEP 2 of 5 - Find your voom-backend project'
info=$($VERCEL project inspect "$PROJECT" 2>&1)
if [ $? -ne 0 ]; then
  echo "$info" | tail -5
  echo "Could not find the project \"$PROJECT\" in this Vercel account."
  echo 'Make sure you signed in to the right account, then try again.'
  pause_exit 1
fi
# Vercel may build from the "backend" folder (Root Directory) or from the folder we upload.
if echo "$info" | grep -i 'root directory' | grep -qi 'backend'; then DEPLOY_DIR="."; else DEPLOY_DIR="backend"; fi
( cd "$DEPLOY_DIR" && $VERCEL link --yes --project "$PROJECT" >/dev/null 2>&1 ) || {
  echo 'Could not connect this folder to voom-backend. Share a screenshot of this window.'; pause_exit 1; }
echo 'Found it.'

echo
echo 'STEP 3 of 5 - Admin phone number (the boss who approves drivers)'
echo 'Type the phone number you signed up with in the app, like +2519XXXXXXXX.'
read -r -p 'Admin phone (or press Enter to skip / keep the old one): ' phone
phone=$(printf '%s' "$phone" | tr -d ' ()-')
if [ -n "$phone" ]; then
  if ! printf '%s' "$phone" | grep -Eq '^\+[1-9][0-9]{7,14}$'; then
    echo 'That does not look like +2519XXXXXXXX. Skipping for now; run this file again to set it.'
  else
    ( cd "$DEPLOY_DIR" && $VERCEL env add ADMIN_PHONES production --value "$phone" --force --yes >/dev/null 2>&1 ) \
      && echo "Saved. $phone will be the admin." \
      || echo 'Could not save the admin phone. You can add ADMIN_PHONES in Vercel > Settings > Environment Variables.'
  fi
fi

echo
echo 'STEP 4 of 5 - Testing phones (sign up without SMS, until a real SMS service is set up)'
echo 'Type the phone numbers you want to test with, separated by commas.'
echo 'Example: +256770433003,+256700000001   (press Enter to skip / keep the old ones)'
read -r -p 'Test phones: ' tphones
tphones=$(printf '%s' "$tphones" | tr -d ' ()-')
if [ -n "$tphones" ]; then
  read -r -p 'Pick a secret 6-digit test code (not 123456 or 000000): ' tcode
  if ! printf '%s' "$tcode" | grep -Eq '^[0-9]{6}$'; then
    echo 'The code must be exactly 6 numbers. Skipping; run this file again to set it.'
  else
    ( cd "$DEPLOY_DIR" \
      && $VERCEL env add TEST_PHONES production --value "$tphones" --force --yes >/dev/null 2>&1 \
      && $VERCEL env add TEST_OTP_CODE production --value "$tcode" --force --yes >/dev/null 2>&1 ) \
      && echo "Saved. These phones will use code $tcode instead of an SMS." \
      || echo 'Could not save the test phones. Share a screenshot of this window.'
  fi
fi

echo
echo 'STEP 5 of 5 - Send the new backend online (1-2 minutes)'
( cd "$DEPLOY_DIR" && $VERCEL deploy --prod --yes ) || {
  echo 'The upload stopped. Share a screenshot of the lines above.'; pause_exit 1; }
echo
echo 'Checking it is awake...'
sleep 5
curl -s https://voom-backend-kappa.vercel.app/health; echo
echo
echo 'Done! If you see {"status":"ok"} above, the new brain is live.'
echo 'Admin page: https://voom-backend-kappa.vercel.app/admin'
pause_exit 0
