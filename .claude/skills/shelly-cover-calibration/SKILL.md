---
name: shelly-cover-calibration
description: Calibrate Shelly covers (roller shutters, blinds), make them forget a calibration, and deal with unknown positions. Covers Cover.Calibrate, when a calibration goes stale (e.g. after reversing direction), the missing position slider, getting the position back, and bin/shelly-cover-forget-calibration (there is no reset method). Use whenever calibrating, recalibrating, clearing/forgetting/resetting a calibration, when the app shows no position slider or wrong percentages, or when Cover.GoToPosition fails with "Current position unknown".
---

# Cover calibration

A calibrated cover has `pos_control: true` in `Cover.GetStatus` (`calibrated` in `bin/shelly-info`). That gives a position in percent (0 closed, 100 open), `Cover.GoToPosition`, and the position slider in the Shelly app. Uncalibrated covers only do open, close and stop. Docs: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover.

## Calibrating

`Cover.Calibrate` starts by going fully open, then travels end to end to learn the open and close travel times. It moves the cover all the way, so get the go-ahead and have the user watch; the user may prefer to start it from the Shelly app themselves. Fix the direction first (shelly-cover-direction skill): a calibration made with reversed wiring is wrong once the direction is fixed.

## Uncalibrated covers keep the output on

Without a calibration, `Cover.Open`/`Cover.Close` keep the output on until `maxtime_open`/`maxtime_close` (60 s by default), even after the shutter has reached its end. To move covers and stop them properly, use the shelly-cover-control skill (`bin/shelly-cover-move`).

## Unknown position and stale calibrations

- After the `invert_directions` change (which reboots the device), Tapparella porta camera ospiti still reported `pos_control: true` but `current_pos: null`, and the app hid the slider (2026-10-02, one device). A plain reboot is believed to keep the position (shelly-reboot skill), so the loss is probably due to the direction change. Not tested separately.
- With the position unknown, `Cover.GoToPosition` fails with `-109 Precondition failed: Current position unknown!`. Running the cover fully open or closed restores the position and the slider. Pick the nearer end to keep the movement small.
- After a direction flip the calibration is stale: open and close times are learned separately, and going up is slower than going down. Neither the device nor the app flags it. Recalibrate, or forget it (below).

## Forgetting a calibration

There's no reset method. Starting `Cover.Calibrate` throws the old calibration away, and an interrupted calibration saves nothing, so start one and stop it right away:

```sh
bin/shelly-scan | bin/shelly-cover-forget-calibration | bin/shelly-table name calibrated forgot stops_sent
```

It only touches covers with `pos_control: true` (`--all` includes uncalibrated ones, e.g. to test it) and refuses covers in motion. It moves the cover, so get the go-ahead and have the user watch.

Why it keeps sending Stop: what matters is the cover's **state** when the calibration starts, not where the shutter physically is. Timing runs on Tapparella studio, 2026-10-02, firmware 2.0.1:

| Shutter | State before | What happened |
|---|---|---|
| middle | `stopped` | First Stops obeyed within ~0.3–0.4 s; a twitch up (seen by the user) |
| top | `stopped` | Stopped within ~0.4 s (3 Stops); the motor never drew power, no travel |
| top | `open` | Stops **ignored** for ~2.7 s (19 Stops) while the output sat at the end stop at 0 W; then the closing phase started and a Stop worked within ~0.3 s |
| top | `open`, one Stop then retries every 1 s | ~2.5 s ignored, then ~1 s of travel down |

The original manual attempt (Tapparella porta camera ospiti, `open` at 100%, a single Stop, a second one seconds later) ran the shutter down for about 6–7 s, a little less than halfway. With the tool's rapid Stops, the worst case is the `open` case: about 3 s of waiting and a twitch down.

Afterwards the status shows `errors: ["cal_abort:ext_command"]`. It doesn't block `Cover.Open`, and a normal open or a reboot clears it (each seen twice). "Not calibrated" survives a reboot (seen once).

The iPhone app once showed a "not calibrated" warning for Tapparella studio while the device and the web app showed it exactly like the untouched devices; probably a stale screen (2026-10-02).

## Not verified yet

- The full step sequence of a calibration after the first phase. Observed: it goes open first, then starts closing.
- Whether the tool could avoid the `open`-state delay (e.g. whether anything changes the state from `open` to `stopped` without moving).
