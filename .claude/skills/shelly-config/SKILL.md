---
name: shelly-config
description: The single place for values that automations use in more than one spot (config/automations.json) and for the voice wordings of scenes, how to change a value and copy it everywhere (bin/shelly-config-apply for device copies, the web app for cloud scene copies), and how to check that every copy matches (bin/shelly-config-check on devices, bin/shelly-scene-check on cloud scenes captured from the web app). Use whenever an automation's value (a position, a limit, a delay) should change, when adding an automation whose value must live in more than one place, when a scene needs another name or language for voice, or to check that devices and scenes still match the file.
---

# One place for values: config/automations.json

Some values have to exist in more than one place, because the pieces that use them can't reach each other: a cloud scene can only send fixed numbers to a device, and can neither read nor set the device's virtual components (checked 2026-10-02, shelly-automation skill). The user accepted the duplication but wants **one place to set each value** (2026-10-02): `config/automations.json` (tracked). Change the value there, then copy it to every place listed under its `copies`.

```json
{"values": {"studio-limit": {"value": 40, "unit": "%", "about": "...",
   "copies": [{"scene": "[helper] Studio: abbassa", "device": "Tapparella studio", "action": "set position"},
              {"scene": "[helper] Studio: abbassa", "device": "Tapparella studio", "action": "condition", "cmpop": "gt", "offset": 2},
              {"scene": "[helper] Studio: apri", "device": "Tapparella studio", "action": "condition", "cmpop": "gt", "offset": -3},
              {"scene": "[helper] Studio: apri", "device": "Tapparella studio", "action": "condition", "cmpop": "lt", "offset": 3}]}},
 "voice": {"Inizia la notte del giudizio": ["Inizia la notte del giudizio", "Inizia il giorno del giudizio", "Begin the purge"]}}
```

- A copy is either on a **device** (a virtual component, by key) or in a **cloud scene** (scene name, device, and which part of its action: `set position` or `delay`, or a `condition` on that device's position). A `condition` copy names the comparison (`cmpop`: `gt` "More than" or `lt` "Less than", both strict) and its `offset` from the value: the scene holds value + offset. So `studio-limit` 40 with `gt` +2 is "more than 42". A range ("more than 37 and less than 43") is two copies. Until 2026-10-14 this was prose in a `derived` field, which no tool could check.
- Devices are named, never identified by ID or MAC (the file is public; IDs stay in `CLAUDE.local.md`).
- `about` says what the value means and who uses it, so nobody has to reverse-engineer it.

## Helper scenes don't replace this

Helper scenes (`[helper] ...`, shelly-automation skill, recipe 7) make up for the branching scenes lack; they don't remove copies. Their numbers are copies like any other and are listed here (`bedroom-privacy`). A helper could hold a value once for several cloud scenes, as a subroutine started by a Scene action, which takes its own delay (app-ui.md). For example, one helper with the four door closes, started 2 min after the windows, would turn `purge-door-delay`'s four copies into one. It can't reach a device copy, though, so this file stays the one place. Done for `kitchen-limit` (2026-10-14): Finisci starts "[helper] Cucina: limite" with "directly execute" instead of holding its own "set position 30", so the morning scene and Finisci share one action. Not tried: whether disabling a scene also cancels its delayed Scene actions, which Finisci's abort would rely on (2026-10-06).

## Changing a value

1. Edit `value` in the file.
2. Device copies (guest network, shelly-local-access skill): `bin/shelly-scan | bin/shelly-config-apply`. It writes each copy with `<Type>.Set` (e.g. `Number.Set`), reads it back, and exits 1 on any failure.
3. Scene copies: list them, then change each in the web app (shelly-cloud-web-app skill: edit scene, the action's pencil, set the slider or the delay; keep "Execute the scene on save or edit" off):
   ```sh
   jq -c '.values | to_entries[] | .key as $k | .value as $v | $v.copies[] | select(.scene) | {value: $k, want: $v.value} + .' config/automations.json
   ```
   Confirm each save from the `scene/edit` request (`app-ui.md` in the shelly-automation skill).
4. Check every copy: `bin/shelly-scan | bin/shelly-config-check` for the devices, and `bin/shelly-scene-check` on a fresh capture for the scenes (below). Refresh the backup (shelly-backup skill) and the Automations table in CLAUDE.md.
5. The door-cover rule applies whenever the value could close a door cover (shelly-automation skill).

`bin/shelly-config-check` reports, per device, `config: [{value, component, want, have, ok}]` and exits 1 on any mismatch, so it also catches someone changing a component by other means. It can't see scene copies; `bin/shelly-scene-check` does.

## Checking the scene copies

The public Cloud Control API has no scenes (checked 2026-10-09), so `bin/shelly-scene-check` reads what the web app downloads. It makes no network access itself. To capture (Chrome DevTools MCP, shelly-cloud-web-app skill):

1. Reload any page of the web app (`navigate_page` with `type: "reload"`). It loads `scene/list` and `interface/device/get_all_lists`.
2. `list_network_requests` with `resourceTypes: ["xhr","fetch"]`, then `get_network_request` on each, with `responseFilePath` `.scratch/scene-list.network-response` and `.scratch/get_all_lists.network-response`. The MCP adds `.network-response` to a name that lacks it. The tool output shows the bearer token; never copy it anywhere.
3. Run:
   ```sh
   bin/shelly-scene-check .scratch/scene-list.network-response .scratch/get_all_lists.network-response | jq -c 'select(.ok | not)'
   ```
   One line per scene copy, `{value, scene, device, action, want, have, ok}`, plus `error` if the scene, device or action isn't there. Exit 1 on any mismatch. `get_all_lists` maps device names to the IDs that scenes use.

It finds a `set position` also inside a delayed action. A `delay` is the minutes of a delayed action that moves that device. A `condition` is the `cmpval` of each position check with that `cmpop`, in any `or` group. It doesn't look at a scene's time, weekdays or enabled flag. First run 2026-10-14: all 14 copies matched; a deliberately wrong config made it exit 1 and name each copy.

## Device copies live in virtual components

Scripts read them at run time instead of carrying the value in their schedule jobs: `cover-clamp` accepts `{"max": "number:200"}` (shelly-scripts skill). Then a change is one `Number.Set`, with no job rewrites.

No device holds a copy since 2026-10-14, so `bin/shelly-config-apply` and `bin/shelly-config-check` have nothing to do until a script automation comes back.

- `number:200` "Limite apertura" on Tapparella cucina held `kitchen-limit` from 2026-10-02 until 2026-10-14, when it was deleted with `kitchen-morning`'s scripts and jobs: the value now lives only in "[helper] Cucina: limite". It was created from the web app (min 0, max 100, step 1, unit %, "Keep current value after reboot").
- `number:200` "Limite apertura" on Tapparella studio held `studio-limit` from 2026-10-02 until 2026-10-07, when it was deleted with the job that read it: `studio-limit` now lives only in the two studio helper scenes (`studio-glare`). It was created over RPC with the same settings: `Virtual.Add {"type": "number", "id": 200, "config": {"name": "Limite apertura", "min": 0, "max": 100, "default_value": 40, "persisted": true, "meta": {"ui": {"view": "", "unit": "%", "step": 1, "icon": ""}}}}`; the device stores it like the web app's, minus an empty `meta.cloud`, and the web app's Components tab shows it exactly like the kitchen's, as "hidden"; checked 2026-10-02).
- The user doesn't want these shown or editable in the app (2026-10-02): View "Hidden" (stored as `meta.ui.view: ""`). The file is the only place to change them.
- `bin/shelly-config-apply` sets the current value, not `default_value` (only the fallback for a component that doesn't persist its value).

## Voice wordings

Each action has **one scene** in the Shelly app, named in Italian. Other languages and wordings ("Begin the purge", "Inizia il giorno del giudizio") are listed under `voice` and belong in the voice layer when it's set up (Alexa routines, Siri Shortcuts, Home Assistant aliases), not as extra Shelly scenes (user's decision, 2026-10-02):

- Siri and Alexa match names fairly literally in their configured language; they don't translate ("Begin the purge" won't match on an Italian Siri) or paraphrase ("giorno" won't match "notte"), so each wording is its own entry.
- The Shelly Alexa skill exposes only 3 "virtual actions" on the free plan, so alias scenes wouldn't all reach Alexa anyway.
- Not verified yet: whether one Alexa routine accepts several phrases, and how a Siri Shortcut starts a Shelly scene.
