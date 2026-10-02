---
name: shelly-cover-control
description: Move Shelly covers (roller shutters, blinds) and stop them, from tools, scripts, the API, the Shelly app or the wall switches. Covers bin/shelly-cover-move (open/close that stops at the end or after a duration), Cover.Stop, the app's "press the arrow again to pause", maxtime_open/maxtime_close, and why an uncalibrated cover otherwise keeps its output on until the timeout. Use whenever a task, tool, script or skill commands a cover to open, close or move, needs to stop one, or a cover seems stuck "opening"/"closing".
---

# Moving covers and stopping them

**Rule:** a movement ends when it has done its job (end reached, duration over, position reached) or with an explicit stop. Never leave a cover "opening"/"closing" until the device's timeout ends it. Every tool, script or skill that moves a cover must follow this, ideally by using `bin/shelly-cover-move`.

Only move covers when the user asked for that movement. Name the devices first, and have the user watch when direction or travel matters.

## Why it matters

An uncalibrated cover doesn't notice the motor's own end stop. After `Cover.Open`/`Cover.Close`, the shutter stops at the end, `apower` drops to 0 W, but the output stays on and the state stays `opening`/`closing` until `maxtime_open`/`maxtime_close` (60 s by default) runs out. Only then does it become `open`/`closed` (Tapparella studio, 2026-10-02, timed with the device clock). The motor idle settings (`motor.idle_power_thr` 2 W, `idle_confirm_period` 0.25 s, same on all 10) didn't end it.

A calibrated cover stops by itself. Tapparella porta soggiorno, 2026-10-02: `Cover.GoToPosition` 80 ran 4.7 s and stopped at 80; `Cover.Open` from there ran the motor 5.0 s, and the state became `open` 0.4 s after the end stop cut the motor. On calibrated covers `bin/shelly-cover-move` mostly reports `stopped_by: device`; its own Stop is harmless when it comes first. All 10 are calibrated since 2026-10-02, so the lingering output only comes back if a calibration is lost.

## Ways to end a movement

| From | How |
|---|---|
| Tools and scripts | `bin/shelly-cover-move open\|close [--for SECONDS]`: watches the motor power, sends `Cover.Stop` once the end stop has cut it (or after 3 s if the motor never ran because it was already there); `--for` makes the device stop by itself after that many seconds. Reports `stopped_by` and `peak_w`. `bin/shelly-cover-jog` builds on it (down, then up). |
| The API | `Cover.Stop` (`bin/shelly-rpc Cover.Stop '{"id":0}'`). Verified: it ended a 60 s run at 19 s. `Cover.GetStatus` can still say `opening` for a fraction of a second afterwards, so re-read, and resend if needed. `Cover.Open`/`Cover.Close` also take `duration` (0.1 s up to maxtime). |
| The Shelly app | Press the same arrow again: the web app labels them "Direction Up or Pause" / "Direction Down or Pause" (the user's tip; Claude hasn't tried it, since it doesn't click the move buttons) |
| The wall switches | Push buttons that the user holds while the shutter moves. All 20 inputs are `type: "switch"` in `dual` mode, i.e. the device follows the input: releasing ends the movement at once (seen on 9 devices, 2026-10-02). A button held past the end stop keeps the output on, like `Cover.Open` on an uncalibrated cover. |
| After an obstruction | The cover stopped itself with an `obstruction` error; the next command clears it (shelly-cover-obstruction skill) |
| During a calibration | Stop can be ignored for ~2.7 s if the cover reported `open` when the calibration started; see the shelly-cover-calibration skill |

A device-side bound for every source (app, wall switch, automations) would be lowering `maxtime_open`/`maxtime_close` to the real travel time plus a margin. Calibration left them at 60 s. Measured full travel (2026-10-02): windows about 16–18 s down and 17–19 s up, doors about 23–25 s down and 25–27 s up. Not changed; it matters little now that the covers are calibrated, and a value set too low aborts calibrations (`cal_abort:timeout_*`).

## Examples

```sh
# Close one shutter for 3 s
bin/shelly-scan | jq -c 'select(.name == "Tapparella studio")' | bin/shelly-cover-move close --for 3
# Open all shutters fully, each stopped as soon as it's up
bin/shelly-scan | bin/shelly-cover-move open | bin/shelly-table name stopped_by seconds state
```

## Observed with bin/shelly-cover-move

First live runs on Tapparella studio, 2026-10-02, with the user watching and a 20 Hz status log:

- Open from 5 s below the top: the motor ran at about 210 W for 5.4 s, the end stop cut it from 210 W to 0 W within about 0.2 s, and the tool's Stop turned the output off **1.0 s later** (`stopped_by: end`). The user heard the relay click about 1 s after the motor went quiet. No threshold tuning needed.
- Open with the shutter already at the top: the motor drew 2.4 W at most, and the tool stopped it after 3 s (`stopped_by: already_at_end`). The user noticed a tiny twitch around the relay click, which didn't happen when the end stop had cut a real run. Harmless.
- `--for 5` down: the device stopped itself after 5.25 s (`stopped_by: device`).
- Motor power while running: 160–220 W depending on the shutter. Up and down took about the same time over 5 s.
- `Cover.GetStatus` occasionally times out for about 1 s on the guest Wi-Fi; the tools' 5 s timeout covers it.

## Not verified yet

- The app's "press again".
