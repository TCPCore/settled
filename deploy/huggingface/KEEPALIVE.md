# Keeping the Space awake for judging

Hugging Face **free CPU-basic** Spaces sleep after **48 hours of inactivity**. A visitor wakes the Space automatically, so a judge opening the link is never permanently blocked.

For a continuously warm demo:

1. Put the public URL in the GitHub repository variable `HF_SPACE_URL`
   (Settings → Secrets and variables → Actions → Variables).
2. The workflow `.github/workflows/keep-space-awake.yml` pings
   `HF_SPACE_URL/api/health` every 6 hours. GitHub cron can be delayed, but the
   interval is well below HF's 48-hour sleep threshold.
3. If your HF Pro plan includes upgraded Space hardware, set sleep time to
   `-1` (never sleep) in the Space settings or via:
   `POST /api/spaces/<user>/bit-settled/sleeptime` with `{"seconds":-1}`.
   CPU-basic does not allow this setting.

The keepalive only touches the public SIM demo. It does not expose keys.
