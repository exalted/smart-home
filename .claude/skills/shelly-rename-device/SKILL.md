---
name: shelly-rename-device
description: Rename one or more Shelly devices end to end. Validate the new names, write them on the device (bin/shelly-set-name), update the Shelly app/cloud name through control.shelly.cloud, and verify both plus the room. Use whenever the user wants to rename, relabel or fix a device name, when on-device and app names differ, or after adopting or changing a naming convention.
---

# Renaming devices

A device's name lives in several places that don't sync (see the shelly-naming skill). This procedure keeps the two places we control, the device and the Shelly app, identical, and checks in with the user at each outward-facing step.

## Steps

1. **Agree on the names.** Propose them according to the shelly-naming convention and run `bin/shelly-name-check` on the **whole** set, which catches duplicates. Show a table: new name, bytes, current name (IP, ID). Wait until the user approves the exact list.
2. **Get local access** (shelly-local-access skill).
3. **Write the names on the devices.**
   ```sh
   bin/shelly-scan > .scratch/scan.jsonl
   # one device:
   jq -c 'select(.name == "Tapparella cucina") | .new_name = "Tapparella finestra cucina"' .scratch/scan.jsonl |
     bin/shelly-set-name | bin/shelly-table name previous_name ip restart_required
   ```
   For several devices, build one JSON line per device with `ip`, `mac`, and `new_name`. `shelly-set-name` validates the names, refuses to write when the MAC at that IP differs (DHCP may have moved it), writes `Sys.SetConfig`, and reads the name back.
   If the devices have no on-device name yet (they were all `null` before 2026-10-01), the app name is the only one. Match devices to app names by ID/MAC, using the cloud list from the shelly-cloud-web-app skill (`.id` in the cloud equals the lowercase MAC).
4. **Rename in the Shelly app.** It's a change in the user's cloud account, so ask for the go-ahead first. Then follow "Renaming a device in the app" in the shelly-cloud-web-app skill. Only rename devices whose app name actually changes.
5. **Verify.** Reload the web app and read `get_all_lists` again. For each device, compare the new app name with the on-device name (`bin/shelly-scan`), and check that `room_id` didn't change: the edit dialog also carries the room. Report a table by name.
6. **Tell the user what else still holds the old names**: Alexa/Google (rename there or rediscover), Apple Home, and Home Assistant entity IDs, which stay frozen.
7. **No restart needed.** A name change doesn't set `restart_required` (verified 2026-10-02). If `bin/shelly-info` shows the flag anyway, something else is pending: find out what before offering a reboot.

## Why this order

Writing on the device first means the canonical copy is right even if the web app step fails halfway. The app step is UI automation in the user's account, so it comes second and is verified against the device.
