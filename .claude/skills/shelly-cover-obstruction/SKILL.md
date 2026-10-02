---
name: shelly-cover-obstruction
description: Obstruction detection ("Obstacle detection") on Shelly covers (roller shutters, blinds). Covers turning it on or off and setting direction, action (stop/reverse), power threshold and hold-off with bin/shelly-cover-obstruction, what a detection looks like (the "obstruction" error, the app notification), how to recover or force a cover to move after a false alarm (also remotely through the Shelly app), what calibration does to the threshold, and the limits of power-based detection. Use whenever a cover stops by itself mid-way, shows "Obstruction detected", when changing safety settings, after recalibrating, or when someone wants covers to stop on obstacles.
---

# Obstruction detection

The device watches the motor power while the cover moves. Above `power_thr` watts, after `hold-off` seconds from the start of the movement, it stops (or reverses) and reports an `obstruction` error. Config lives in `Cover.SetConfig` → `obstruction_detection` (https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover); the Shelly app calls it "Obstacle detection" under the device's Safety (shield) tab.

| Key | App label | Values (default) |
|---|---|---|
| `enable` | Enable | `false` |
| `direction` | Moving direction: While opening / While closing / While moving | `open`, `close`, `both` (`both`) |
| `action` | Action: Stop / Reverse | `stop`, `reverse` (`stop`) |
| `power_thr` | Max power threshold | watts (1000) |
| `holdoff` | Hold off time | seconds (1) |

## What it can and can't do

- It reacts to the motor working **harder**: a jammed or frozen shutter, or something holding it, mostly while opening.
- **It is not a safety device for people or pets.** Closing onto an obstacle often makes the motor work less, since the obstacle carries the shutter's weight. Say so whenever doors ("porta" shutters) or automations come up.
- Starting is no problem: the motor ramps to full power in about 0.2 s with no inrush spike (20 Hz log, 2026-10-02), well inside the 1 s hold-off.
- During a calibration the device ignores it (Shelly docs).

## The threshold

Calibration sets `power_thr` by itself: from 1000 W to 191–247 W here, about 13% above the highest power each shutter drew while calibrating (2026-10-02, firmware 2.0.1). Mains voltage and temperature move motor power by several percent, so this house uses **the calibrated value + 10%** (about 25% above normal running power). After a recalibration, the device has a fresh calibrated value again: read it, then apply the 10% once. Never apply it to a value that already has it.

```sh
bin/shelly-scan | bin/shelly-cover-config |
  jq -c '.obstruction_power_thr = (.obstruction_power_thr * 1.1 | round)' |
  bin/shelly-cover-obstruction on --direction both --action stop --holdoff 1
```

`bin/shelly-cover-obstruction on|off` sets only what it's given (the threshold per device from the input field `obstruction_power_thr`, or `--power-thr` for all), reads the settings back and prints them. `bin/shelly-cover-config` shows the current ones. The change needs no reboot (`restart_required: false`, 2026-10-02). It refuses covers in motion. Refresh the backup afterwards (shelly-backup skill).

## When it trips

Observed on Tapparella porta soggiorno with a test threshold of 100 W, 2026-10-02:

- The motor runs about 1.2 s (the 1 s hold-off plus reaction), the cover stops, state `stopped`, `errors: ["obstruction"]`, and the position stays known.
- The app shows a notification "Obstruction detected" with "Go to Safety Tab"; the main controls just show "Stopped 87%". Whether the phone gets a push notification isn't checked.
- **Commands still work.** The next open, close or go-to-position clears the error and moves the cover, from the API, the app or the wall button (all three seen). If the cause is still there, it trips again after about 1.2 s each time.

## Forcing a cover after a false alarm (e.g. while away)

1. Retry from the app. If it moves normally, it was a one-off.
2. If it keeps stopping after about a second, turn detection off on that device in the Shelly app: device → Safety (shield) → Obstacle detection → untick Enable → Save. This works through the cloud and took effect at once without a reboot (done from control.shelly.cloud, 2026-10-02). Then move it normally.
3. Back home, look for the cause and turn detection on again with the tool (or raise that device's threshold).

The app's form shows the values the cloud has, which can be stale: after the calibration it showed 1000 W for a device that had 194 W, until a later `Cover.SetConfig` updated it. Saving writes the whole form, so check the threshold there before saving, or fix it with the tool afterwards.

## Rehearsing a false alarm

To check the recovery path without a real obstacle: on one shutter, with the user there and the opening clear, set `--power-thr 100` (below its running power), send `Cover.Close` twice (each runs about 1 s), have the user press the wall button, turn it off from the app, then open the cover and set the real threshold again.

## Settings in this home

Since 2026-10-02 on all 10: enabled, `both`, `stop`, hold-off 1 s, threshold = calibrated + 10%:

| Shutter | Calibrated | Set |
|---|---|---|
| Tapparella bagno matrimoniale | 191 | 210 |
| Tapparella bagno ospiti | 194 | 213 |
| Tapparella camera ospiti | 195 | 215 |
| Tapparella cucina | 197 | 217 |
| Tapparella porta camera ospiti | 200 | 220 |
| Tapparella porta cucina | 194 | 213 |
| Tapparella porta matrimoniale | 196 | 216 |
| Tapparella porta soggiorno | 205 | 226 |
| Tapparella soggiorno | 247 | 272 |
| Tapparella studio | 241 | 265 |

Running power is 160–178 W for most, about 210 W for Tapparella soggiorno and Tapparella studio.

## Not verified yet

- That a real obstacle trips it at these thresholds (only a simulated one was tested).
- False alarms over the seasons (cold, ice, an aging motor). If one shows up, raise that device's threshold rather than turning detection off everywhere.
- That a calibration always resets the threshold (seen once).
