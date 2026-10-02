# Device-side automation: API reference

From the official API docs (shelly-api-docs.shelly.cloud, via context7) on 2026-10-02 unless marked as observed. Schedules, scripts, `Schedule.Eval`, `Script.Eval` and KVS have been tried on Tapparella cucina (marked observed); webhooks, virtual components and BTHome not yet. The open checks are under "Still to verify" in SKILL.md. Use `bin/shelly-rpc` to call these methods.

## What a Shelly 2PM Gen3 has

Cover (`cover:0`), two inputs, Virtual components, BTHome components, Matter (off here), MQTT, Outbound WebSocket, KNX, up to 10 scripts. Observed on all 10 (backup 2026-10-02): timezone Europe/Rome and `sys.location` lat/lon set, no webhooks; scripts and schedules only on Tapparella cucina (CLAUDE.md, Automations).

## Limits

| Thing | Limit |
|---|---|
| Schedule jobs | 20 per device, up to 5 calls each |
| Webhooks | 20 per device, up to 5 URLs each, 300 characters per URL |
| Scripts | 10 per device, at most 3 running at once; at most 5 timers per script |
| Virtual components | 10 per device, IDs 200–299 |

## Schedule

`Schedule.Create {"enable": true, "timespec": "...", "calls": [{"method": "Cover.GoToPosition", "params": {"id": 0, "pos": 50}}]}`; also `Schedule.List`, `Schedule.Update` (e.g. `enable`), `Schedule.Delete`, `Schedule.DeleteAll`. Calls can be any RPC method on the device itself (e.g. `Cover.Open`, `Cover.Close`, `Cover.Stop`, `Cover.GoToPosition`, `Schedule.Update`, `Script.Start`).

Timespec, 5, 6 or 7 fields: `[sec] min hour day-of-month month day-of-week [year]`. Ranges 0–59, 0–59, 0–23, 1–31, 1–12, 0–7 (0 and 7 = Sunday), 1970–2199. `*`, lists `,`, ranges `-`, steps `/`, `?`, `L`, `W`, `#`; names `MON`–`SUN`, `JAN`–`DEC`; `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`.

- `0 0 14 * MAY-SEP *`: 14:00 daily, May to September
- `0 0 8 * * MON-FRI`: weekdays at 08:00
- `@sunrise`, `@sunrise+30m`, `@sunset-1h30m`, `@sunrise * * MON-FRI`, `@sunset * NOV-FEB *`: sunrise/sunset, offset up to ±12 h (units h, m, s), optional day-of-month, month and day-of-week fields. Needs `sys.location` lat/lon and timezone.
- `@random:{"from":"0 0 19 * * *","to":"0 0 21 * * *","number":1}`: N random times between two cron points.
- Times are in the device's timezone. DST: a job in the skipped hour doesn't fire; one in the repeated hour fires once.
- A schedule has **no condition**: it always runs its calls. For conditional behavior use a script.
- `Schedule.Eval {"timespec", "now"}` returns the `prev` and `next` fire times without creating a job. Observed 2026-10-02 on 2.0.1: `prev` excludes `now` itself, and sunrise/sunset come at minute resolution. Scripts use it to ask "has sunrise / 07:00 happened today?" (shelly-scripts skill).

## Webhooks (the app's "Actions")

`Webhook.Create {"event": "cover.closed", "cid": 0, "enable": true, "urls": ["http://..."], "condition": "...", "repeat_period": 0, "active_between": ["08:00", "20:00"]}`. `Webhook.ListSupported` lists the events.

- Cover events: `cover.open` (fully open), `cover.closed` (fully closed), `cover.opening`, `cover.closing`, `cover.stopped` (stopped in between).
- Input events: `input.toggle_on` / `input.toggle_off` for switch-type inputs (this home's inputs are `type: "switch"`), `input.button_push` / `_longpush` / `_doublepush` / `_triplepush` for button-type inputs.
- `condition`: an expression over `config`, `status`, `info`, and `ev`/`event` attributes, e.g. `event.tC > 20`.
- `repeat_period`: minimum seconds between calls; negative = only when the condition turns from false to true; 0 = every event.
- `ssl_ca`: `null` built-in CAs, `user_ca.pem`, `*` no validation.
- Calling *another* device needs guest-to-guest traffic on (SKILL.md, network constraint).

## Scripts

`Script.Create {"name": "..."}` → `Script.PutCode` → `Script.SetConfig {"id": N, "config": {"enable": true}}` (start on boot) → `Script.Start`; `bin/shelly-script-put` does all of it. `Script.Eval {"id", "code"}` runs code in a running script and returns its value as a string; `Script.Start` then `Script.Eval "main(...)"` is how this home's scripts take arguments, also as two calls in one schedule job (observed 2026-10-02; conventions in the shelly-scripts skill). In scripts: `Shelly.call(method, params, callback)`, `Shelly.addEventHandler` / `Shelly.addStatusHandler`, `Timer.set(ms, repeat, fn)`, `KVS.*` for stored settings, `Virtual.getHandle("boolean:200")`.

HTTP from a script:

```javascript
Shelly.call("HTTP.GET", { url: "https://api.open-meteo.com/v1/forecast?..." }, function (res, err) {
  if (err === 0 && res && res.code === 200) { let data = JSON.parse(res.body); /* ... */ }
});
```

KVS values can be objects (observed 2026-10-02).

Shelly's examples repo (`ALLTERCO/shelly-script-examples`, folder `weather-env`) has `cover-control-weather.shelly.js`: Gen1/AccuWeather with an API key, only useful as a pattern. Script memory per script isn't documented in what was read; keep scripts small and avoid huge JSON responses (request only the fields needed).

## Virtual components

`Virtual.Add {"type": "boolean", "id": 200, "config": {"name": "...", "persisted": true}}`; types boolean, number, text, enum, group, button. Scripts read and set them (`handle.getValue()`, `setValue()`, `on("change", ...)`). Use case here: a "vacation" boolean that the plant/presence script checks, flipped from the app (if the app shows it) or by RPC.

## BTHome (Shelly BLU sensors)

A BLU sensor (e.g. BLU Door/Window) can be added to the 2PM Gen3 as a BTHomeDevice plus BTHomeSensor components, which scripts and webhooks on that device can use, entirely locally. Needs Bluetooth enabled (the observer is handled automatically since 1.5.0); RPC over Bluetooth (`BLE.SetConfig` `rpc.enable`) is a separate setting and isn't needed. This is the free-software, local way to block closing a door cover while the door is open (the sensor costs money). Untried.

## Cloud Control API v2 (cover)

`POST https://<server>/v2/devices/api/set/cover?auth_key=<AUTH_KEY>` with `{"id": "<device-id>", "channel": 0, "position": "open" | "close" | "stop" | 0–100, "duration": s, "relative": -100..100}`. Works from anywhere (e.g. an iPhone Shortcut). The auth key is a credential: never commit it or paste it into tracked files; device IDs belong in `CLAUDE.local.md` only.

## Open-Meteo (weather for scripts)

`https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=precipitation,rain,showers,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,shortwave_radiation,temperature_2m,is_day&timezone=auto`; also `minutely_15=` and `hourly=` with the same variable names. No API key for non-commercial use. Wind direction is where the wind comes from, in degrees. Coordinates are home-identifying: keep them out of tracked files (scripts read them from the device's own `sys.location` instead of hard-coding).
