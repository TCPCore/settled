#!/usr/bin/env bash
set -euo pipefail

# Create/update a Hugging Face Docker Space and upload this deployment.
# Usage:
#   HF_TOKEN=hf_xxx HF_USER=cptlight ./deploy/huggingface/deploy.sh
# Never commit the token.

: "${HF_TOKEN:?Set HF_TOKEN to a Hugging Face write token}"
: "${HF_USER:?Set HF_USER to your Hugging Face username}"
SPACE="bit-settled"
SPACE_ID="$HF_USER/$SPACE"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

api() { curl -fsS -H "Authorization: Bearer $HF_TOKEN" -H "Content-Type: application/json" "$@"; }

# Create the Space if it does not exist. 409 is fine (already exists).
api -X POST https://huggingface.co/api/repos/create \
  -d "{\"name\":\"$SPACE\",\"type\":\"space\",\"sdk\":\"docker\",\"private\":false}" \
  >/dev/null 2>&1 || true

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ASKPASS="$TMP/askpass.sh"
cat > "$ASKPASS" <<'ASK'
#!/bin/sh
case "$1" in
  *Username*) echo "$HF_USER" ;;
  *) echo "$HF_TOKEN" ;;
esac
ASK
chmod +x "$ASKPASS"
export GIT_ASKPASS="$ASKPASS"
git clone "https://huggingface.co/spaces/$SPACE_ID" "$TMP/space"

cp "$ROOT/deploy/huggingface/README.md" "$TMP/space/README.md"
cp "$ROOT/deploy/huggingface/Dockerfile" "$TMP/space/Dockerfile"

cd "$TMP/space"
git config user.name "cptlight"
git config user.email "29535497+cptlight@users.noreply.github.com"
git add README.md Dockerfile
if git diff --cached --quiet; then
  echo "No Space changes to upload."
else
  git commit -m "Deploy bit-settled SIM demo"
fi
git push origin main

echo "Space: https://huggingface.co/spaces/$SPACE_ID"
echo "Direct: https://$HF_USER-$SPACE.hf.space"
echo "If the Space is on upgraded hardware, disable sleep:"
echo "  POST https://huggingface.co/api/spaces/$SPACE_ID/sleeptime  {\\\"seconds\\\":-1}"
