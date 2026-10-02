---
name: shelly-automation
description: Designing automations for the covers (roller shutters) with rooms, groups, scenes, on-device schedules, webhooks, scripts and virtual components, free routes first (no Premium). Covers the door-cover lockout rule, where each block runs (Shelly cloud vs on the device), what is possible for free, this home's network constraint, recipes (close all, wake-up, afternoon half-close, rain from one side, seasonal vacation schedules for plants, presence simulation), how automations interact, and what is known to be impossible. Use whenever the user wants something to happen automatically, at a time, at sunrise/sunset, on weather, on another device's event, or for several covers at once, or asks about rooms, groups, scenes, schedules, automations, wake-up, vacation or presence simulation.
---

# Automating the covers

Reference files in this folder: [app-ui.md](app-ui.md) (what the Shelly app's group, scene and schedule wizards offer, as explored) and [device-api.md](device-api.md) (Schedule timespec, webhooks, scripts, virtual components, BTHome, Cloud API, weather API, limits). Read them instead of exploring the app or the docs again.

## Safety first: door covers

**Closing a door cover ("Tapparella porta …") automatically can lock someone out on the balcony or terrace.** Remind the user of this every time an automation, group, scene, schedule, script or command could close a door cover, including "all covers" groups and anything that closes covers as a side effect (rain, sun, vacation, presence simulation). Do this when proposing, designing, building, reviewing or changing it, even if it was said before. Default design: leave door covers out of automatic closing, unless the house is known to be empty (e.g. a vacation set enabled only for the trip) or a door contact sensor blocks the closing. Also say that obstruction detection is power-based protection for the motor and shutter, not a safety device for people or pets (shelly-cover-obstruction skill).

## Ground rules for this home

- **Every schedule timespec must be one the Shelly app can parse**, or that device's Schedule page in the app never loads: `0 0 14 * 5-9 *`, `0 0 8 * * MON,TUE,WED,THU,FRI`, `@sunrise+0h30m * * *`, `@sunset-1h30m * 11,12,1,2 *`; not `MAY-SEP`, `MON-FRI`, `@sunrise+30m` or `@random` (shelly-scripts skill, "The Shelly app and script jobs"; observed 2026-10-02).

- **Free routes only**, unless Premium is *absolutely* necessary (the user's choice, 2026-10-02). When a cloud feature is Premium, look for the free route first (device schedules, scripts, Home Assistant later). If Premium really seems the only way, say so explicitly and why, and let the user decide. So far nothing needs it.
- **No alarm devices or thermostats, and none planned.** Ignore the app's Alarm-based conditions, Alarm actions, the Alarms tab, and the Thermostat group type and tab.
- **Current automations** are listed in CLAUDE.md (Home setup, Automations); the first, `kitchen-morning`, went in on 2026-10-02. Check there and in the device backups before adding one, so they don't fight (see "Several automations together").
- **Scripts are generic and composable**, one job each, specifics passed as arguments: reuse or compose what's in `scripts/` before writing a new one (shelly-scripts skill).
- **A script automation's values are hidden from the household** (2026-10-02). The arguments (positions, times) live only in the device's schedule jobs. The Shelly app shows such a job as just "Script.start / Script.eval" with an on/off toggle. Only the device's own web UI shows the values, read-only, and changing them takes a local session over RPC (shelly-scripts skill, "Where an automation's arguments live"). Say so when proposing a script-based automation. If someone at home should be able to tune a value, weigh a plain cover schedule instead; the app presumably shows and edits its position, but that's unverified for an existing job.
- The user also moves covers from the Shelly iPhone app. When a cover moves and you didn't command it, don't assume who or what did it; ask the user (CLAUDE.md, Cloud).

## The building blocks

| Block | What it is | Runs where | Without internet | Notes |
|---|---|---|---|---|
| Room | A label: every device sits in exactly one room. The room page has Devices, Groups, Scenes, Thermostats tabs. | App | n/a | No room-wide command; scenes have no room action. Use a group. |
| Group | Same-type devices controlled as one (Roller for covers). Own up/down card, usable in scenes and by voice. Room or Global. | Shelly cloud | Doesn't work; each device still does | Free |
| Scene | When (conditions) → Do (actions, optionally delayed), within an active time. | Shelly cloud | Doesn't fire | Free, except weather and sunrise/sunset conditions (Premium) |
| Device schedule | Cron-like job on the device: up to 5 RPC calls, 20 jobs per device, sunrise/sunset, months, random times, enable flag. **No conditions.** | Device | Runs (clock permitting) | Free |
| Webhook ("action") | On a device event (cover opened/closed/stopped/opening/closing, input changes), call up to 5 URLs; optional condition on config/status/event and an active_between time window. 20 per device. | Device | Runs on the LAN | Free |
| Script (mJS) | JavaScript on the device: timers, events, HTTP calls (e.g. a weather API), any logic. Up to 10 per device, 3 running at once. | Device | Runs; internet data doesn't | Free |
| Virtual component | Device-side variable: boolean, number, text, enum, button, group; 10 per device. E.g. a "vacation" switch that scripts read. | Device | Yes | Free; whether the app shows it as a control is unverified |
| BTHome (BLU) sensor | A Shelly BLU sensor (e.g. BLU Door/Window) paired directly to the 2PM Gen3 over Bluetooth, readable by scripts and webhooks on that device. | Device | Yes | Free; needs a sensor bought and Bluetooth on (RPC over Bluetooth not needed) |
| Cloud Control API | HTTPS API to move a cover through the cloud with an auth key (e.g. from an iPhone Shortcut). | Shelly cloud | No | Free; the auth key is a credential, never commit it |
| Alexa routines / Apple Home automations | External engines: time, sunrise/sunset, phone alarm stopped, etc., controlling the covers. | Their cloud/hub | Mostly no | Free; Alexa needs the Shelly skill, Apple Home needs Matter (off) or HA; neither is set up |
| Home Assistant (planned) | Local hub: sun azimuth/elevation, weather, sensors, presence, blueprints such as Cover Control Automation. | Local server | Yes | Free; can't reach the devices on today's network |

Rule of thumb: **anything that must keep working while nobody is home goes on the device** (schedule, webhook, script). Groups and scenes are for convenience and for things that may be missed during an outage.

### Free vs Premium

| Need | Free route | Premium only |
|---|---|---|
| Sunrise/sunset | Device schedule (`@sunrise+0h30m * * *`); Alexa/Apple routines | Scene condition |
| Weather (rain, wind, clouds) | Script polling Open-Meteo; Home Assistant; a rain sensor | Scene condition (1–6 h forecast, checked hourly) |
| Seasons (months) | Device schedule month field; script | Nothing: scenes can't restrict by month at all |
| Random times | Script (a device schedule's `@random` works on the device but breaks the app's Schedule page) | n/a |
| Several covers at once | Cloud group / scene (free) | n/a |
| React to another device | Cloud scene, device-based condition (free); local webhook/script needs the network change below | n/a |

None of the use cases so far needs Premium.

### This home's network constraint

The devices sit on the FRITZ!Box guest Wi-Fi, with guest-to-guest traffic off day to day: the user turns it on only during setup sessions, so never design an automation around what works while it happens to be on (user, 2026-10-02). So locally a device can only act on **its own** cover: a webhook, schedule or script that commands *other* devices needs guest-to-guest communication on permanently, plus stable IPs (DHCP reservations; IPs come from DHCP today). A future Home Assistant on the main network can't reach the devices either. Until the network changes, the local pattern is "one schedule/webhook/script per device, acting on itself", and commands for several covers go through the cloud. Leaving guest-to-guest on permanently is acceptable only if absolutely necessary, when there is no other way; propose it to the user, never assume it. Devices do reach the internet, so scripts can call a weather API.

## Choosing the block

1. Fixed time or sunrise/sunset, optionally by weekday/month → **device schedule** on each cover concerned.
2. Needs a condition (weather, a vacation switch, "not before 07:00", "only if the door is closed") → **script** on each cover concerned (schedules can't check anything), composed from the generic scripts in `scripts/` where possible (shelly-scripts skill).
3. One button or one voice command for many covers → **group** (cloud), plus a "Manual execution" scene if it needs a sequence.
4. Reacting to another cover or device → cloud **scene** with a device-based Trigger, or local webhook/script once the network allows it.
5. Something only a hub does well (sun on a facade, presence, real sensors) → note it for **Home Assistant**.

## Recipes

Positions: 100 = open, 0 = closed. "Half" is 50 % of the calibrated travel *time*, not exactly half the height: pick numbers by watching. All moves follow the shelly-cover-control rule.

1. **Close all covers fully.** A Roller group with all 10 (Global) gives one app button and works in scenes and with voice; cloud only. Locally today: `bin/shelly-scan | bin/shelly-cover-move close` from the guest network. **Door-cover reminder: "all covers" includes the three door covers; offer a "windows only" group as well.**
2. **Open some covers at wake-up.** Fixed times: device schedule on each bedroom cover, separate weekday/weekend jobs; local, outage-proof. Sunrise-relative: `@sunrise+0h30m * * *`. "Sunrise, but never before 07:00" is not one cron (two jobs give the *earlier* time): use `daily-once` with `"after": ["@sunrise", "0 0 7 * * *"]` and jobs at `@sunrise+0h1m * * *` and `0 1 7 * * *`, as `kitchen-morning` does (built 2026-10-02; it also catches up after an outage). "Only if it's more open than X" is `cover-clamp {"max": X}`. Gentle wake-up: 30 %, then 100 % a few minutes later. On the actual phone alarm: an iPhone personal automation "when alarm is stopped" calling the Cloud Control API or Apple Home (untried; Apple Home needs Matter). Opening is not a lockout risk.
3. **Half-close some covers after 14:00.** Device schedule `0 0 14 * * *` → `Cover.GoToPosition` 50 on each, with months (`0 0 14 * 5-9 *`) if it's for summer sun, and a second job to open again. Free approximation of "only when the sun is on that facade": per-month schedule sets matching when the sun reaches that side; skip on cloudy days with a script (Open-Meteo cloud cover or radiation). Exact sun position needs Home Assistant. **Door-cover reminder if any door cover is included**, even half-closed.
4. **Close covers on the side the rain comes from.** Needs each window's facing direction (unknown yet), "raining now", and wind direction (meteorological: where the wind comes *from*; rain mostly hits facades facing within about ±60° of it, and only with some wind). Free: a script on each window cover polling Open-Meteo every 10–15 min (`current=precipitation,rain,showers,wind_direction_10m,wind_speed_10m`), closing when it rains from its side; model data on a ~2 km grid, not hyperlocal. Most reliable: a real rain sensor plus wind direction, with Home Assistant. Roller shutters themselves don't mind rain; this protects open windows, doors and sills. In strong wind, half-lowered shutters can rattle: ask what the shutter maker recommends. **Door-cover reminder: rain arrives exactly when someone may have stepped out to fetch laundry or plants; keep door covers out or require a door contact.**
5. **Vacation: light for the plants, winter vs summer.** Device schedules (they survive internet and cloud outages while nobody is home), months for the seasons, created disabled and enabled for the trip (or a script reading a "vacation" virtual boolean). For example winter (months `11,12,1,2`): open fully at `@sunrise+0h30m * 11,12,1,2 *`, close at `@sunset * 11,12,1,2 *`. Summer (`5-9`): open at sunrise, lower sun-facing covers to 30–50 % from late morning to mid-afternoon, open again, close at sunset. Shoulder months in between. Frozen shutters in winter: obstruction detection stops the motor; a script could skip opening below 0 °C. Door covers may be included here, since the house is empty, but **say the lockout reminder anyway and switch the set off on return**.
6. **Presence simulation** (with 5): random evening times for closing, so the house doesn't look automated. A schedule's `@random` would break the app's Schedule page, so use a script that waits a random delay before acting, started by a normal job. Same door-cover reminder.

## Several automations together

- Last command wins: a cover just does what it was told most recently. Design priorities explicitly (e.g. rain-close beats a scheduled open), which means a script, since schedules can't check conditions.
- Wall switches and the app always override until the next automated command. Device schedules fire once at their time and don't fight a manual change afterwards.
- Obstruction detection stops a blocked move with an error; the next command clears it (shelly-cover-obstruction).
- Cloud pieces (groups, scenes) silently do nothing during an internet or cloud outage; device pieces keep going.
- DST: a job in the skipped spring hour doesn't fire; one in the repeated autumn hour fires once.
- Every automation that closes covers: **door-cover reminder**.

## Known to be impossible or unavailable (as of 2026-10-02)

- A command for a whole room (no such action; use a group).
- Date ranges or months in scenes (active time is weekdays + hours only); free sunrise/sunset or weather in scenes.
- "max(sunrise + x, fixed time)" in a single schedule; conditions in schedules. (Two schedule jobs plus `daily-once` do it.)
- Local device-to-device commands, and Home Assistant reaching the devices, on today's network.
- Groups or scenes during an internet outage.

If one of these turns out possible after all (new firmware, app update, another route), fix this list.

## Before building, ask the user

- Which covers belong to each use case; the direction each window/door faces (for sun and rain)
- Wake-up times (weekday/weekend); the "half" position that looks right; which room the plants are in
- Whether Home Assistant is coming soon (changes the answer for 3 and 4); whether Alexa is used
- Group and scene names: no convention yet; extend the shelly-naming skill with the first one (e.g. "Tapparelle tutte", "Tapparelle finestre", "Tapparelle camere", "Tapparelle lato sud")

## Still to verify (and how)

- Firmware 2.0.1 accepts the full timespec (months, `@sunrise` with fields, `@random`, year): `Schedule.Create` a disabled job on the pilot device (Tapparella studio), read it back with `Schedule.List`, delete it. `@sunrise`, `@sunrise+1m`, `@sunrise+0h1m * * *` and plain 6-field crons work on the device (observed 2026-10-02), though only app-parseable forms may be used (ground rules); `Schedule.Eval` checks a timespec without creating a job.
- Schedules after a power cut, before the clock syncs (the devices are believed to have no battery-backed clock): reboot the pilot and read `Sys.GetStatus` time while watching a test job.
- A webhook calling the device's own RPC (`http://127.0.0.1/rpc/...`) for same-device actions with isolation on.
- Whether the app shows virtual components as controls (a vacation switch the user can tap).
- What a roller group offers in the app (position slider?), and whether a scene's Group action can set a position.
- The app's device "link" icon (presumably Actions/webhooks), and whether the iPhone app's wizards match the web app's.

## Testing an automation

Test the trigger or condition, not just the actions: a manual run hides a wrong trigger. For a schedule, add a one-off job a few minutes ahead on the pilot device with the user watching, then delete or disable it. For script-based automations follow the test steps in the shelly-scripts skill (early run, scheduled run, already done, reboot catch-up). In scenes, turn off "Execute the scene on save or edit" before saving anything that moves covers. After any change to device settings (schedules, webhooks, scripts and virtual components are in the backup), refresh the backup (shelly-backup skill).

## Keeping this skill true

This is living knowledge. Whenever something here is challenged, a new option turns up (firmware, app update, new device), or a "fact" turns out false or impossible, fix it here and in the reference files right away: correct or remove the claim, move items between "still to verify", "impossible" and the main text, date the observation, and tell the user what changed. Never leave a disproven claim in place.
