---
name: shelly-cover-control
description: Move Shelly covers (roller shutters, blinds) and stop them, from tools, scripts, the API, the Shelly app or the wall switches. Covers bin/shelly-cover-move (open/close that stops at the end or after a duration), Cover.Stop, the app's "press the arrow again to pause", maxtime_open/maxtime_close, and why an uncalibrated cover otherwise keeps its output on until the timeout. Use whenever a task, tool, script or skill commands a cover to open, close or move, needs to stop one, or a cover seems stuck "opening"/"closing".
---

# Moving covers and stopping them

**Rule:** a movement ends when it has done its job (end reached, duration over, position reached) or with an explicit stop. Never leave a cover "opening"/"closing" until the device's timeout ends it. Every tool, script or skill that moves a cover must follow this, ideally by using `bin/shelly-cover-move`.

Only move covers when the user asked for that movement. Name the devices first, and have the user watch when direction or travel matters.

## Why it matters

An uncalibrated cover doesn't notice the motor's own end stop. After `Cover.Open`/`Cover.Close`, the shutter stops at the end, `apower` drops to 0 W, but the output stays on and the state stays `opening`/`closing` until `maxtime_open`/`maxtime_close` (60 s by default) runs out. Only then does it become `open`/`closed` (Tapparella studio, 2026-10-02, timed with the device clock). The motor idle settings (`motor.idle_power_thr` 2 W, `idle_confirm_period` 0.25 s, same on all 10) didn't end it.

A calibrated cover knows its travel times and should stop at the end or target position by itself (not observed yet; check after calibrating).

## Ways to end a movement

| From | How |
|---|---|
| Tools and scripts | `bin/shelly-cover-move open\|close [--for SECONDS]`: watches the motor power, sends `Cover.Stop` once the end stop has cut it (or after 3 s if the motor never ran because it was already there); `--for` makes the device stop by itself after that many seconds |
| The API | `Cover.Stop` (`bin/shelly-rpc Cover.Stop '{"id":0}'`). Verified: it ended a 60 s run at 19 s. `Cover.GetStatus` can still say `opening` for a fraction of a second afterwards, so re-read, and resend if needed. `Cover.Open`/`Cover.Close` also take `duration` (0.1 s up to maxtime). |
| The Shelly app | Press the same arrow again: the web app labels them "Direction Up or Pause" / "Direction Down or Pause" (the user's tip; Claude hasn't tried it, since it doesn't click the move buttons) |
| The wall switches | All 20 inputs are `type: "switch"` in `dual` mode (2026-10-02), i.e. the device follows the switch position, so presumably switching off ends the movement. Not checked. |
| During a calibration | Stop can be ignored for ~2.7 s if the cover reported `open` when the calibration started; see the shelly-cover-calibration skill |

A device-side bound for every source (app, wall switch, automations) would be lowering `maxtime_open`/`maxtime_close` to the real travel time plus a margin. Not done; revisit after calibrating, since calibration measures those times.

## Examples

```sh
# Close one shutter for 3 s
bin/shelly-scan | jq -c 'select(.name == "Tapparella studio")' | bin/shelly-cover-move close --for 3
# Open all shutters fully, each stopped as soon as it's up
bin/shelly-scan | bin/shelly-cover-move open | bin/shelly-table name stopped_by seconds state
```

## Not verified yet

- `bin/shelly-cover-move` has not been run against a device yet (written 2026-10-02); the first live run is planned for 2026-10-03, while calibrating. Check `stopped_by` and `seconds` against what the user sees, and tune the thresholds (running above 20 W, idle below 5 W for 3 polls) if needed.
- Whether calibrated covers stop at the end by themselves, and whether calibration changes `maxtime_open`/`maxtime_close`.
- The app's "press again" and the wall switch behavior.
