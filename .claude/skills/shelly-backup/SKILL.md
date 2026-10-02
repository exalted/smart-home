---
name: shelly-backup
description: Back up the full configuration of every Shelly device (bin/shelly-backup), keep a sanitized, publishable copy per device in devices/ (bin/shelly-backup-sanitize, bin/shelly-split), and know what a replacement device needs. Use after any task that changes device settings, when the user asks for a backup or a config snapshot, when comparing a device with how it should be, or when a device fails and must be replaced.
---

# Backing up device configuration

Two copies, for two purposes:

| Where | What | In git? |
|---|---|---|
| `backups/<date>.jsonl` | Everything `bin/shelly-backup` reads, one JSON line per device: device info, `Shelly.GetConfig`, virtual components, scripts with code, schedules, webhooks, KVS | **No**: git-ignored, because it holds MACs, the home's coordinates, the cloud server, and possibly secrets in scripts or KVS |
| `devices/<name>.json` | The same, sanitized: no MAC/ID, location, SSIDs, servers, credentials, script code or KVS values, and none of the security posture (BLE settings, `enhanced_security`; device passwords aren't in the config anyway) | Yes, safe to publish; review the diff anyway |

Wi-Fi passwords and the calibration aren't readable from a device, so neither copy has them.

## Taking a backup

Needs local access (shelly-local-access skill).

```sh
bin/shelly-scan | bin/shelly-backup > backups/$(date +%F).jsonl
bin/shelly-backup-sanitize < backups/$(date +%F).jsonl | bin/shelly-split devices
git diff devices/
```

- `bin/shelly-backup` exits non-zero if any read failed; the line then has `{"error": ...}` in that section. Check that all devices are there (`wc -l`).
- `bin/shelly-backup-sanitize` replaces each device's own MAC wherever it appears (MQTT IDs, the setup Wi-Fi name) and refuses, with exit 1, any device whose result still looks like it holds a MAC or a location. Don't work around a refusal: find the field and add it to the sanitizer.
- Before committing, also run the check from CLAUDE.md "Publishing" on the staged diff.
- Older files in `backups/` are kept on purpose (history). It's git-ignored, so `git clean -x`/`-X` would delete it.

## When to refresh

After every task that changes device settings (names, cover settings, obstruction thresholds, a recalibration's new threshold, firmware updates, new scripts or schedules), take a new backup and update `devices/` before finishing. The user asked for this (2026-10-02).

## What the devices have in common

As of 2026-10-02 the 10 profiles are identical apart from `sys.device.name`, `cover:0.obstruction_detection.power_thr` and `sys.cfg_rev`. To see what differs:

```sh
jq -s 'map(.config | del(.sys.device.name, .sys.cfg_rev)) as $c
  | [$c[0] | paths(scalars)] | map(. as $p | {path: ($p | map(tostring) | join(".")),
    values: ([$c[] | getpath($p)] | unique)}) | map(select(.values | length > 1))' devices/*.json
```

## Replacing a failed device

Not done yet; a restore tool is to be written when it's first needed. The steps, from what this home needs:

1. Same model (`S3SW-002P16EU`), wired like the old one. All 10 have the motor and switch wires crossed, which `invert_directions` and `swap_inputs` correct; a replacement wired the other way needs both off (shelly-cover-direction skill).
2. Add it in the Shelly app: Wi-Fi "FRITZ!Box guest access", the right room, the app name (shelly-rename-device skill).
3. Update the firmware to at least the `ver` in its profile, and switch to the `cover` profile if it came as `switch` (`Shelly.SetProfile`).
4. Apply the settings from `devices/<name>.json` with `bin/shelly-rpc` per component (`Sys.SetConfig`, `Cover.SetConfig`, `Input.SetConfig`, `BLE.SetConfig`, ...), skipping read-only fields such as `sys.device.fw_id`, `profile`, `cfg_rev` and the redacted ones. Take what the public copy leaves out (BLE, `enhanced_security`) from the latest local backup in `backups/`. Location (`sys.location`) is probably set during setup in the app (not verified).
5. Test the direction, calibrate, then set the obstruction threshold to the new calibrated value + 10% (shelly-cover-direction, shelly-cover-calibration, shelly-cover-obstruction skills).
6. Put the new MAC and IP in `CLAUDE.local.md`, and take a new backup.
