---
name: shelly-config
description: The single place for values that automations use in more than one spot (config/automations.json) and for the voice wordings of scenes, how to change a value and copy it everywhere (bin/shelly-config-apply for device copies, the web app for cloud scene copies), and how to check that every copy matches (bin/shelly-config-check). Use whenever an automation's value (a position, a limit, a delay) should change, when adding an automation whose value must live in more than one place, when a scene needs another name or language for voice, or to check that devices and scenes still match the file.
---

# One place for values: config/automations.json

Some values have to exist in more than one place, because the pieces that use them can't reach each other: a cloud scene can only send fixed numbers to a device, and can neither read nor set the device's virtual components (checked 2026-10-02, shelly-automation skill). The user accepted the duplication but wants **one place to set each value** (2026-10-02): `config/automations.json` (tracked). Change the value there, then copy it to every place listed under its `copies`.

```json
{"values": {"kitchen-limit": {"value": 30, "unit": "%", "about": "...",
   "copies": [{"device": "Tapparella cucina", "component": "number:200"},
              {"scene": "Finisci la notte del giudizio", "device": "Tapparella cucina", "action": "set position"}]}},
 "voice": {"Inizia la notte del giudizio": ["Inizia la notte del giudizio", "Inizia il giorno del giudizio", "Begin the purge"]}}
```

- A copy is either on a **device** (a virtual component, by key) or in a **cloud scene** (scene name, device, and which part of its action: `set position` or `delay`, or a `condition` on that device's position). A copy whose number isn't the value itself but follows from it says how in `derived` (e.g. `bedroom-privacy`'s helper conditions, "more than value + 2"); change those together with the value.
- Devices are named, never identified by ID or MAC (the file is public; IDs stay in `CLAUDE.local.md`).
- `about` says what the value means and who uses it, so nobody has to reverse-engineer it.

## Changing a value

1. Edit `value` in the file.
2. Device copies (guest network, shelly-local-access skill): `bin/shelly-scan | bin/shelly-config-apply`. It writes each copy with `<Type>.Set` (e.g. `Number.Set`), reads it back, and exits 1 on any failure.
3. Scene copies: list them, then change each in the web app (shelly-cloud-web-app skill: edit scene, the action's pencil, set the slider or the delay; keep "Execute the scene on save or edit" off):
   ```sh
   jq -c '.values | to_entries[] | .key as $k | .value as $v | $v.copies[] | select(.scene) | {value: $k, want: $v.value} + .' config/automations.json
   ```
   Confirm each save from the `scene/edit` request (`app-ui.md` in the shelly-automation skill).
4. `bin/shelly-scan | bin/shelly-config-check` to see every device copy match; refresh the backup (shelly-backup skill) and the Automations table in CLAUDE.md.
5. The door-cover rule applies whenever the value could close a door cover (shelly-automation skill).

`bin/shelly-config-check` reports, per device, `config: [{value, component, want, have, ok}]` and exits 1 on any mismatch, so it also catches someone changing a component by other means. It can't see scene copies (no public API for scenes).

## Device copies live in virtual components

Scripts read them at run time instead of carrying the value in their schedule jobs: `cover-clamp` accepts `{"max": "number:200"}` (shelly-scripts skill). Then a change is one `Number.Set`, with no job rewrites.

- `number:200` "Limite apertura" on Tapparella cucina holds `kitchen-limit` (created 2026-10-02 from the web app; min 0, max 100, step 1, unit %, "Keep current value after reboot").
- `number:200` "Limite apertura" on Tapparella studio holds `studio-limit` (created 2026-10-02 over RPC with the same settings: `Virtual.Add {"type": "number", "id": 200, "config": {"name": "Limite apertura", "min": 0, "max": 100, "default_value": 40, "persisted": true, "meta": {"ui": {"view": "", "unit": "%", "step": 1, "icon": ""}}}}`; the device stores it like the web app's, minus an empty `meta.cloud`, and the web app's Components tab shows it exactly like the kitchen's, as "hidden"; checked 2026-10-02).
- The user doesn't want these shown or editable in the app (2026-10-02): View "Hidden" (stored as `meta.ui.view: ""`). The file is the only place to change them.
- `bin/shelly-config-apply` sets the current value, not `default_value` (only the fallback for a component that doesn't persist its value).

## Voice wordings

Each action has **one scene** in the Shelly app, named in Italian. Other languages and wordings ("Begin the purge", "Inizia il giorno del giudizio") are listed under `voice` and belong in the voice layer when it's set up (Alexa routines, Siri Shortcuts, Home Assistant aliases), not as extra Shelly scenes (user's decision, 2026-10-02):

- Siri and Alexa match names fairly literally in their configured language; they don't translate ("Begin the purge" won't match on an Italian Siri) or paraphrase ("giorno" won't match "notte"), so each wording is its own entry.
- The Shelly Alexa skill exposes only 3 "virtual actions" on the free plan, so alias scenes wouldn't all reach Alexa anyway.
- Not verified yet: whether one Alexa routine accepts several phrases, and how a Siri Shortcut starts a Shelly scene.
