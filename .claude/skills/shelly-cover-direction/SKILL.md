---
name: shelly-cover-direction
description: Fix Shelly covers (roller shutters, blinds) that move the wrong way, i.e. the app's up/down (open/close) arrows or the wall switches move the shutter in the opposite direction. Covers the "Reverse directions" setting (Cover invert_directions), "Swap inputs" (swap_inputs), swapping the motor wires on O1/O2, which fix matches which symptom, reading the settings with bin/shelly-cover-config, and testing the direction room by room with the user watching (bin/shelly-cover-jog, bin/shelly-cover-watch). Use whenever a cover moves opposite to the command, up and down look swapped, position percentages look inverted, before calibrating covers, or to re-test directions after wiring work, a config change or a replaced device.
---

# Fixing cover direction

The app's ▲/▼ only send `Cover.Open` / `Cover.Close`. Wall switches, schedules, Home Assistant, Matter and voice assistants all go through the same logical open/close. So a wrong direction is fixed once, on the device, never downstream (Home Assistant's Shelly integration docs mention no invert option either; checked 2026-10-02).

## The settings

On `cover:0`, read with `Cover.GetConfig` and changed with `Cover.SetConfig` (https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover):

| Config key | UI label | What it changes |
|---|---|---|
| `invert_directions` | "Reverse directions" | Which way the motor turns for open and for close. Fixes the app, the wall switches and every automation at once. |
| `swap_inputs` | "Swap inputs" | Which of the two inputs opens and which closes (in `dual` mode). Only the wall switches; the app arrows are unaffected. |
| `in_mode` | "Control Button mode" | `single`, `dual` or `detached`. Context for `swap_inputs`. |

The labels come from the 2PM Gen3 web interface guide, i.e. the device's web UI (`http://<ip>/`). The Shelly app and control.shelly.cloud probably offer the same settings, which would let the user flip a device by hand without local access, but that isn't confirmed.

Wiring fixes do the same job: swapping the two motor direction wires on O1/O2 equals `invert_directions`, swapping the two switch wires on the inputs equals `swap_inputs`. That is mains work (breaker off, not just the Shelly; flag it). A wiring fix survives a factory reset or a replacement device, a setting doesn't.

## Which fix

| App arrows | Wall switch | Fix |
|---|---|---|
| wrong | wrong | Reverse directions (or swap O1/O2) |
| wrong | right | Reverse directions **and** Swap inputs |
| right | wrong | Swap inputs only |

"Wall switch right but app wrong" means both the motor and the switch wires are crossed, so both need flipping.

## Steps

1. Ask the user which devices are affected and whether their wall switches are wrong too. Wiring can differ per device, so never flip all of them blindly.
2. Get local access (shelly-local-access skill).
3. Read the current settings, and check that no cover is moving (a config change reboots the device, which stops it):
   ```sh
   bin/shelly-scan | bin/shelly-info | bin/shelly-cover-config > .scratch/before.jsonl
   bin/shelly-table name cover_state calibrated invert_directions swap_inputs in_mode < .scratch/before.jsonl
   ```
4. Tell the user what will change on which devices, by name, and wait for the go-ahead. With several devices, offer a pilot on one uncalibrated device first and let the user test it before doing the rest.
5. Flip the settings on the chosen devices. Flip means the opposite of the current value: use `false` for a device that already has it on. Change both keys in one call when both need flipping, so the wall switches never work the wrong way in between.
   ```sh
   jq -c 'select(.mac == "<device-id>") | {name, ip, mac}' .scratch/before.jsonl |
     bin/shelly-rpc Cover.SetConfig '{"id":0,"config":{"invert_directions":true,"swap_inputs":true}}'
   ```
6. The reply is `restart_required: true` and the device **reboots by itself** within a couple of seconds (2PM Gen3, firmware 2.0.1, observed 2026-10-02), so don't reboot it yourself. Reads during that window fail; check again with `bin/shelly-info` and expect a small uptime, `restart_required: false`, and `cloud: true` a few seconds later.
7. Test the direction with the user watching (next section).
8. Covers that were calibrated before the flip (`calibrated: true` in `bin/shelly-info`) now have a stale calibration that neither the device nor the app flags. Recalibrate them or make them forget it (shelly-cover-calibration skill). Fix direction before calibrating the others.
9. Record what you found (which devices were reversed, what fixed them) in CLAUDE.md, and correct this skill where reality differed. Refresh the backup (shelly-backup skill).

## Testing the direction

The device can't tell physical up from down (`Cover.GetStatus` says `opening` either way), so someone has to watch. Do it after any change to `invert_directions`/`swap_inputs`, wiring work, or a replaced device, and before calibrating. Run it room by room as the user walks the house, in the order they choose:

1. Local access (shelly-local-access skill) and an inventory saved to `.scratch/before.jsonl` (step 3 above). Ask the user to keep door openings ("porta" shutters) and sills clear.
2. Tell the user which shutters of the room will move, in which order (window before door), and wait until they say they're in the room.
3. Jog them one after another. `bin/shelly-cover-jog` closes for 2 s, pauses 1 s, opens for 2 s, which is exactly what the app's ▼ and ▲ send:
   ```sh
   for mac in <device-id> <device-id>; do jq -c --arg m "$mac" 'select(.mac == $m) | {name, ip, mac}' .scratch/before.jsonl; done |
     SHELLY_PARALLEL=1 bin/shelly-cover-jog
   ```
   `close_w`/`open_w` near 0 mean that leg didn't move (already at that end); a shutter at the top moves down and back up.
4. Start watching the room's devices (in the background), then ask the user (a) whether each went down, then up, and (b) to test each wall switch, down for about 2 s and back to off, then up for about 2 s and back to off (down first, since most shutters sit at the top):
   ```sh
   ... | bin/shelly-cover-watch --for 240 > .scratch/wall-<room>.jsonl
   ```
   The log shows whether the device saw the switch as close/open, how long the motor ran, and that switching off ended the movement.
5. Record the result per device; fix a wrong one (table above) and test it again before moving on. At the end, check with `bin/shelly-info` that nothing is left moving.

## History in this home

2026-10-02: on all 10 devices the app arrows were reversed and the wall switches were right, so both the motor and the switch wiring are crossed at every device. Set `invert_directions` and `swap_inputs` to `true` on all 10, pilot first on Tapparella studio, which the user confirmed for both the app and the wall switch. Every device rebooted by itself and was back on the cloud within about 30 seconds. Tapparella porta camera ospiti, the only calibrated one, then had a stale calibration. The user chose to clear it (start and interrupt a calibration) rather than recalibrate.

Later on 2026-10-02 the user tested the other 9 room by room as above (jog for the app direction, then the wall switch): all 10 right for both. Each jog leg drew 160–220 W, depending on the shutter. On all 9, switching the wall switch back to off stopped the shutter at once.

## Related, but not a fix

`obstruction_detection.direction` and `safety_switch.direction` ("Moving direction" under Safety and protections) take `open`, `close` or `both`, i.e. they are set in terms of open/close.

## Not verified on these devices yet

From the docs (2026-10-02), not yet tried on the house's 2PM Gen3 with firmware 2.0.1:

- The UI labels above come from the 2PM Gen3 web interface guide; the exact path in the Shelly app isn't confirmed.
- That a flipped, calibrated cover really needs recalibrating is reasoned from how calibration works, not observed.
