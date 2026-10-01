---
name: shelly-reboot
description: Safely reboot one or many Shelly devices over the local network with bin/shelly-reboot and verify they came back. Use when the Shelly app shows "<device> requires the device to be rebooted" notifications, when restart_required is true after a config or firmware change, when the user asks to restart or reboot devices (especially several at once, since the app has no bulk reboot), or when a misbehaving device needs a restart.
---

# Rebooting devices

The Shelly app has no bulk reboot and the public Cloud Control API has no reboot endpoint, so bulk reboots go through the local RPC `Shelly.Reboot`.

## Steps

1. Get local access (shelly-local-access skill, `bin/shelly-netcheck`).
2. Take an inventory and keep it for comparison:
   ```sh
   bin/shelly-scan | bin/shelly-info > .scratch/before.jsonl
   bin/shelly-table name ip restart_required cover_state < .scratch/before.jsonl
   ```
3. Show the user which devices need a reboot and what their covers are doing, by name. Then **stop and wait for the go-ahead**: the user wants to confirm every reboot.
4. Reboot, for example only the devices that need it:
   ```sh
   jq -c 'select(.restart_required)' .scratch/before.jsonl |
     bin/shelly-reboot | tee .scratch/reboot.jsonl |
     bin/shelly-table name ip rebooted uptime restart_required
   ```
5. Verify with `bin/shelly-scan | bin/shelly-info`. Expect a small uptime, `restart_required: false`, `cloud: true`, and the same names and cover positions as before. Report by name. The app's "requires the device to be rebooted" notifications clear by themselves (confirmed 2026-10-02: "No notifications").
6. Hand the network back (see "When the local work is done" in shelly-local-access).

## Why it works this way

- A reboot stops a moving cover, so `shelly-reboot` skips any device whose cover is opening or closing unless you pass `--force`. Positions survive a reboot.
- The script waits up to 60 seconds per device, polling uptime until it drops, and reports any device that didn't come back. Pass `--no-wait` to fire and forget.
- Rebooting all 10 devices in parallel is fine. On 2026-10-01 they were back on Wi-Fi and the cloud within about 7 seconds.

## Known causes of restart_required

- A bulk firmware update from the Shelly app (2026-10-01: all 10 devices after updating to 2.0.1).
- Some `Sys.SetConfig` writes, but **not** `device.name`. Renaming Tapparella studio and back on 2026-10-02 left `restart_required` false both in the reply and in the device status. The `true` replies to the renames on 2026-10-01 came while the firmware update's restart was still pending.
