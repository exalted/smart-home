---
name: shelly-cover-calibration
description: Calibrate Shelly covers (roller shutters, blinds), make them forget a calibration, and deal with unknown positions. Covers Cover.Calibrate, when a calibration goes stale (e.g. after reversing direction), the missing position slider, getting the position back, and bin/shelly-cover-forget-calibration (there is no reset method). Use whenever calibrating, recalibrating, clearing/forgetting/resetting a calibration, when the app shows no position slider or wrong percentages, or when Cover.GoToPosition fails with "Current position unknown".
---

# Cover calibration

A calibrated cover has `pos_control: true` in `Cover.GetStatus` (`calibrated` in `bin/shelly-info`). That gives a position in percent (0 closed, 100 open), `Cover.GoToPosition`, and the position slider in the Shelly app. Uncalibrated covers only do open, close and stop. Docs: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover.

## Calibrating

`Cover.Calibrate` learns the open and close travel times. It moves the cover all the way, several times, so get the go-ahead; the user may prefer to start it from the Shelly app themselves. Fix the direction first (shelly-cover-direction skill, "Testing the direction"): a calibration made with reversed wiring is wrong once the direction is fixed.

```sh
bin/shelly-scan | bin/shelly-cover-calibrate | bin/shelly-table name calibrated seconds state pos errors
```

`bin/shelly-cover-calibrate` starts it on every input device in parallel, waits, and reports `calibrated`, `seconds`, `pos` and `errors`. To see the phases, run `bin/shelly-cover-watch --for 300 --every 0.5` on the same devices in the background.

Before starting, tell the user:

- **Obstruction detection is ignored during a calibration** (Shelly docs), and it's off on these devices anyway. Nothing stops a shutter if something is in the way, so keep door openings ("porta" shutters) and sills clear, and people and pets away.
- **Don't touch the wall switches or the app until it's done.** Any command aborts it (`cal_abort:ext_command`).

The sequence, per the docs: fully open, fully closed in one run, fully open in one run, closed in steps, open in steps. The covers end fully open at 100%.

All 10 at once, 2026-10-02, firmware 2.0.1: all succeeded, no errors. Windows took 83–95 s and doors 117–121 s. Afterwards:

- `pos_control: true`, state `open`, position 100. One device read `current_pos: null` right at the end and 100 a second later; the tool re-reads once for that.
- The Shelly app (control.shelly.cloud) showed the position slider at "Opened 100%" for all 10 straight away.
- `maxtime_open`/`maxtime_close` stayed at 60 s.
- `obstruction_detection.power_thr` changed from 1000 W to 191–247 W, a little above each shutter's running power (160–220 W), so calibration seems to set it from the measured power. `obstruction_detection.enable` stayed `false`. **After every calibration, re-apply this home's threshold (calibrated + 10%) as described in the shelly-cover-obstruction skill.**
- Calibrated covers stop by themselves at the end and at a target position (shelly-cover-control skill).

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

- Whether the tool could avoid the `open`-state delay (e.g. whether anything changes the state from `open` to `stopped` without moving).
