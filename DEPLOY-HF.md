# Persistent free demo on Hugging Face Spaces

The public demo is a **SIM-only** Docker Space: no keys, no money, no private ranges in buyer/index responses. It stays within HF's free CPU tier (2 vCPU / 16 GB) and can be kept warm for judging.

## One-time setup

1. Create a **write** token: https://huggingface.co/settings/tokens
2. In GitHub → **Settings → Secrets and variables → Actions**:
   - Secret **`HF_TOKEN`** = the token
   - Variable **`HF_USER`** = your Hugging Face username (default fallback: `cptlight`)
3. Run **Actions → Deploy Hugging Face Space → Run workflow**.
4. Copy the Space URL:
   - Page: `https://huggingface.co/spaces/<user>/bit-settled`
   - Direct: `https://<user>-bit-settled.hf.space`
5. Add repository variable **`HF_SPACE_URL`** = the direct URL. The keepalive workflow pings `/api/health` every 6 hours.

Or run locally:

```bash
HF_TOKEN=hf_xxx HF_USER=<your-hf-user> ./deploy/huggingface/deploy.sh
```

## Keeping it live for judging

- HF **free CPU-basic** sleeps after **48 hours of inactivity**. A judge opening the URL wakes it; this is fine for a link, but not “always warm”.
- The included keepalive workflow pings every 6 hours (GitHub cron can be delayed, but far below 48 h).
- If your **HF Pro** plan includes upgraded Space hardware, set sleep time to `-1` (never sleep) in Space settings, or call:
  `POST https://huggingface.co/api/spaces/<user>/bit-settled/sleeptime` with `{"seconds": -1}`.
  CPU-basic does not allow a custom sleep time.
- The Space is public and SIM-only. Do **not** add PayPal/AI secrets to it.

## What gets deployed

- `deploy/huggingface/Dockerfile` clones the public GitHub repo at build time.
- `deploy/huggingface/README.md` is the Space card.
- `deploy/huggingface/deploy.sh` creates/updates the Space through the HF API and pushes the two files.
- The app listens on `PORT=7860` and `HOST=0.0.0.0`.

## After deploy

- Test `/start.html`, `/demo.html`, `/api/health`, `/api/config` (must say `mode:"sim"`).
- Put the direct URL in `SUBMISSION.md` (`HOSTED_DEMO_URL`) and `DEVPOST.md`.
- If the Space build fails, open the Space **Logs** tab; the Dockerfile needs outbound GitHub access during build.
