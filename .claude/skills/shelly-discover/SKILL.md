---
name: shelly-discover
description: Find the home's Shelly devices on the local network and build an inventory (name, IP, ID/MAC, model, firmware, profile, restart_required, available updates, cover state and calibration, Wi-Fi signal, cloud connection) with bin/shelly-scan, bin/shelly-info and bin/shelly-table. Use whenever you need to know which devices exist, their IPs or state, whether any need a restart or an update, before any bulk action, or to verify the device snapshot in CLAUDE.md.
---

# Discover and inspect devices

Local access comes first: see the shelly-local-access skill (`bin/shelly-netcheck`).

## Tools

Every `bin/shelly-*` tool reads one device per line on stdin, either a bare IP or a JSON object with an `"ip"` key. Each tool merges its own fields into the object and prints JSON lines, so fields such as `name` flow through a whole pipeline.

- `bin/shelly-scan [SUBNET]` probes the /24 (default 192.168.179) with `GET /shelly`, which answers without a password. It prints name, ip, id, mac, model, gen, ver, profile, auth_en, and more. It takes about 10 seconds.
- `bin/shelly-info` adds the highlights of `Shelly.GetDeviceInfo` and `Shelly.GetStatus`: fw, auth, uptime, restart_required, updates, cover_state, cover_pos, calibrated, rssi, cloud.
- `bin/shelly-table [KEY...]` renders an aligned table for humans, sorted by the first column. Put `name` first.

```sh
bin/shelly-scan | bin/shelly-info | bin/shelly-table name ip restart_required cover_state calibrated rssi
```

When you'll reuse the result, save the JSON lines under `.scratch/` (git-ignored) and filter them with jq, e.g. `jq -c 'select(.restart_required)' .scratch/info.jsonl`.

## Presenting devices

Refer to each device by its name, with technical details after it in parentheses: "Tapparella cucina (192.168.179.4, <device-id>)". The user reasons about the home by room and window, and IPs or IDs alone mean nothing to them.

## Reading the fields

- `name` is the on-device name (`sys.device.name`). The Shelly app keeps its own copy (see the shelly-naming skill).
- `ip` comes from DHCP and can change. `mac`/`id` is the stable identity, so re-scan rather than trust an old IP before writing anything.
- `restart_required` means a config change is waiting for a reboot. The Shelly app shows it as "<name> requires the device to be rebooted". See the shelly-reboot skill.
- `updates`: `["beta"]` means only a beta is offered, so stable is current.
- `cover_state` is open, closed, opening, closing, or stopped. `calibrated: false` (`pos_control`) means the cover has no position percentage, only up/down/stop. All 10 were calibrated on 2026-10-02; `calibrated: false` on one of them now means its calibration was lost or thrown away (shelly-cover-calibration skill).
- `rssi` is in dBm. Around -80 or worse is weak (Tapparella camera ospiti was at -79).
- `cloud` tells whether the device is connected to Shelly Cloud.
- `auth` tells whether a device password is set.

## Keep CLAUDE.md and CLAUDE.local.md current

CLAUDE.md's "Home setup" section holds a device snapshot with a "last verified" date; the IDs/MACs and last-seen IPs live in the device table in the git-ignored `CLAUDE.local.md` (see "Publishing" in CLAUDE.md). After a scan, compare the count, models, generation, profile, names, IDs and IPs against them. On any mismatch, update the right file and the date. If the date is more than about 3 months old, suggest a re-check to the user.
