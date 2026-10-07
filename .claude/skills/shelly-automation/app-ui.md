# Shelly app: groups, scenes, device schedules

Explored in the web app (control.shelly.cloud, version 3.77.24) on 2026-10-02, on the free plan, without saving anything. The iPhone app is assumed to match but wasn't checked. How to drive the web app is in the shelly-cloud-web-app skill. Alarm and Thermostat options are listed for completeness only: this home has neither (see SKILL.md).

## Rooms

- "My home" → All Rooms. A room page (`#/home/room/<room_id>/devices`) has tabs Devices, Groups, Scenes, Thermostats.
- Groups and scenes are assigned to one room or to **Global** (for anything spanning rooms).
- There is no room-level command anywhere, and no "room" action in scenes.
- Adding a room (All Rooms → "+" Add, 2026-10-06): one dialog, "Room name" and a picture (uploaded, default, colors and gradients), Cancel/Save. Save sends `interface/room/save` with `{name, image, backgroundColor, main_sensor, overview_style, position: 0}` and returns the new `room_id`; the new room comes first in All Rooms (`position` 0). A room needs no devices: "Helpers" (id 9) holds only helper scenes.

## Dashboard (bottom bar → Dashboard; 2026-10-06)

Tabs "Activity Log" and "My Dashboard" (the only dashboard, empty until 2026-10-06). "Add widget" (or "+") → **Select type**: Devices, Rooms, Groups, Scenes, Alarms, Thermostats, Weather Widget (Premium) → **Select items** (checkboxes, "Selected: N", search) → Save, which sends `interface/dash/update`. The free plan allows 5 dashboards with 40 widgets each. Dashboards are stored in the cloud (`get_all_lists` → `data.dashboards`, e.g. `"scenes": {"<scene_id>": {"position": 0}}`), so the iPhone app presumably shows the same (not checked). A scene widget shows the name and room, with a play button ("Run Scene") and a power toggle ("Disable scene", which turns the scene off: not the one to tap). A Devices widget for a cover presumably has the card's up/down arrows (not added yet). Adding more: the item list starts at "Selected: 0" with nothing ticked, even for scenes already on the dashboard, and Save adds the ticked ones to what is there ("Widgets created: 2/40"): adding "Abbassa o apri studio" kept "Privacy o apri matrimoniale" and went after it (position 1; 2026-10-06).

## Groups ("My home" → All Groups → Add)

Steps: **Group type → Devices → Group room → Details**.

1. Group type: Light, Relay, **Roller**, Thermostat. "You can only group together devices with similar functionality."
2. Devices: listed by room, expand a room to tick devices; "Selected: N".
3. Group room: Global or a room.
4. Details: name, picture (uploaded, default pictures, colors).

Not explored: the group's own card and controls after saving (position slider?).

## Scenes ("My home" → All Scenes → Add)

Steps: **When → Do → Active time → More options → Select room → Details**. Everything stays in the page until the final Save; closing asks "Exit without saving?". Adding a condition sent no request (checked in the network log).

### When: conditions

"Add condition" → Create condition or Import condition. Types:

| Type | Free | Details |
|---|---|---|
| Device based | yes | Pick a device, then a property, then "Watch property as" |
| Time based | yes | Timer (every N minutes), Daily / Weekly Schedule (weekdays + HH:MM), Once (date + HH:MM). Daily / Weekly (2026-10-06): weekday checkboxes M–S (none ticked at first) and an hour and a minute spinner (`aria-label` "Increase button"/"Decrease button", hour first); no Condition/Trigger choice, it fires at that time. Stored as `{"and": [{"eq": [{"rr": "dt:t"}, "15:00"]}, {"wday": "now", "isin": "1 2 3 4 5"}], "_gui_type": "d_cond"}` (1 = Monday), in the account's timezone (`user/get_settings` → `settings.timezone`, "Europe/Rome" here) |
| Scene based | yes | Reacts to another scene (not explored further) |
| Alarm based | yes | Not relevant here |
| Manual execution | yes | Run from the app/dashboard |
| Weather forecast based | **Premium** | Greyed out. Per the KB: forecast for the next 1–6 h, checked hourly; clouds, precipitation, wind direction (N/E/S/W) and force, temperature, humidity |
| Sunrise/Sunset based | **Premium** | Greyed out |

Cover properties for "Device based": **Opening State** (Open, Opening, Closed, Closing, Stopped), **Device Position** (less/more than N %), **Power Consumption** (less/more than N W). Nothing else, not even after virtual components were added to the device and the page reloaded (3.77.25, 2026-10-02): a scene can't react to a virtual component of these covers.

"Watch the property as":
- **Condition**: "Check if it is the desired device state, but does not activate scene by itself"
- **Trigger**: "Check if it is the desired device state and activate the scene"
- "Trigger custom settings" → Condition type: **On any change** (fires on every new qualifying value), **Repeatedly** (checks every minute and fires while it holds), **Once** (fires when the condition becomes true; it must become false again to re-fire), plus "Condition is valid N minutes" (hold time).

Several conditions combine with and/or.

### Do: actions

"Add action" → Create action or Import action. Types: Device action, Group action, Scene action, Notify action, Alarm action.

Device action steps: Action → Device → Change state → Delay action. For a cover: "open Shelly roller", "stop Shelly roller", "close Shelly roller", "set position Shelly roller" (slider 0–100 %). Delay: "Execute the action after N" seconds or minutes, 0–1440. **One device per action** (the device list is radio buttons grouped by room), so "all covers" is 10 actions. A delayed action shows "Delay 2 min" on its card in the Do list (2026-10-02).

Scene action steps (2026-10-02): Action → Scene (scenes grouped by room, e.g. Global) → "Fulfill scene as" → Delay action. "Fulfill scene as" offers "Start scene, evaluate conditions and then do actions if needed", "Start scene and directly execute action part" ("Execute 'Do' actions without evaluating 'When' conditions"), "Enable scene", "Disable scene", "Toggle scene". The card then reads "<scene name> / Play scene". It can make one scene an alias of another. "Directly execute" runs the target's delayed actions too: running the alias "Begin the purge" started the door covers of "Inizia la notte del giudizio" 2 min 3 s later (observed 2026-10-02). The aliases were deleted the same day: other wordings belong in the voice layer (shelly-config skill). "Disable scene" on a scene that is still waiting cancels its delayed actions, the same as its card's toggle; running a scene doesn't cancel another's (SKILL.md, "Several automations together"; 2026-10-04).

How a saved scene is stored (`POST scene/add`, form field `scene_script`, JSON; 2026-10-02, conditions and "evaluate conditions" added 2026-10-06): `_enabled` (Enable scene), `_run_on_ingest` ("Execute the scene on save or edit"), `_meta` (`name`, `room` = -1 for Global, shown as "General", `position`, `adi` = the device IDs used), `if.or[].and[]` (a manual execution is `{"_gui_type": "manual_execution"}`), and `do[]`: a cover action is `{"r": "dev:<device id as decimal>:rl", "set": "close"}` (or `open`), a delayed one is wrapped as `{"wait": 2, "units": "minutes", "do": {"blk": [<action>]}}` (with a `wid` timestamp since 2026-10-04, and `"units": "sec"` for seconds). A Scene action that enables or disables a scene is `{"_gui_type": "enable_disable_scene", "r": "blprop:<scene_id>:enabled", "set": "false"}` (or `"true"`), and a "set position" action is `{"r": "dev:<id>:rlp", "set": 80}` (2026-10-04). A Device Position condition is `{"r": "dev:<id>:rlp", "cmpop": "gt", "cmpval": 17}` ("More than", strict; "Less than" is `lt`); watched as Condition it carries nothing else, and several in one `and[]` must all hold. A Scene action "Start scene, evaluate conditions and then do actions if needed" is `{"_gui_type": "activate_scene", "trigger": "<scene_id>"}`, and a scene with conditions and no trigger is listed with `cdi` (condition device IDs) next to `adi` in `_meta` (2026-10-06).

The Do list is shown in the app's own order, not the stored one: device actions by device ID, then scene actions, then the delayed one (2026-10-04; shelly-cloud-web-app skill).

Each card on All Scenes has two buttons: a power toggle (aria-label "Disable scene" while the scene is on, "Enable scene" while it's off; sends `scene/enable`) and a play button ("Run Scene", sends `scene/manual_run`). A scene that is off doesn't run until it is turned on again, and turning it off also cancels its delayed actions that are still waiting (2026-10-04). The response returns the new `scene_id`. Saving a new scene also sends `scene/bulk_update` with `reorder=1` for the existing scenes: only their `position` changes.

A Device action for a cover offers only those four states, also when the device has virtual components (3.77.25, 2026-10-02): a scene can't press a virtual button or set a virtual number.

A saved scene opens in a side panel: name, a copy (duplicate) button, the pencil ("Edit scene"), a play button (runs it), an info button (scene ID), the When and Do lists. There is no delete there.

- **Editing** ("Edit scene"): the same steps as Add, prefilled, with "Execute the scene on save or edit" as saved. Each action card in Do has a pencil ("Edit": the four action steps again) and a trash button. The final Save sends `POST scene/edit` with `id` and the full `scene_script`. A "set position" action is stored as `{"r": "dev:<id>:rlp", "set": 30}`; plain open/close use `rl` (a 2026-10-02 note said `rl` here too, but re-saving Finisci on 2026-10-04 sent `rlp` for its kitchen action).
- **Deleting**: on All Scenes, the "Edit" button at the top (pencil) turns on edit mode; each card then has "Edit scene" and "Delete scene", which asks "Delete scene? ... will permanently remove it from your account." "Exit edit mode" leaves it (2026-10-02).

### Active time

Intervals of weekdays + start/end time ("Specific interval"); default every day 00:00–23:59. "Add interval" stays disabled while the default whole-day interval exists. **No dates, no months.**

### More options

- "Enable scene" (on by default): "If you disable the scene it will not execute until you enable it manually."
- **"Execute the scene on save or edit" (on by default)**: "...it will trigger the scene whenever you edit it or when certain system changes occur, such as an account timezone change or a Shelly server reset." Turn it off for any scene that moves covers, or they move on save and on every edit.

### Select room, Details

Global or a room; name and picture: uploaded pictures, default pictures (one is preselected), or colors and gradients. This home uses the first color, black (`color-0`), for everything (CLAUDE.md, Preferences).

## Device schedules (device panel → calendar icon "Schedule" → Add schedule)

These are stored on the device itself (the Schedule component; see device-api.md).

Steps: **Week days → Time → Action → Preview**, each in "Simple" or "Advanced" mode ("Switch to Advanced mode for more complex schedules").

- Week days: Mon–Sun checkboxes (all ticked by default).
- Time, Simple: "Choose time interval" → **Time** (HH:MM) or **Sunrise / Sunset** with an offset (hours, minutes, Before/After). Free on this account.
- Time, Advanced: toggles for Hours, Minutes, Seconds (repeating jobs).
- Action: "You can add up to 5 actions." → Add local action: **Open Cover, Close Cover, Stop Cover, Move Cover to specific position**.
- Preview: "Execute schedule on Mon-Sun; at 00:00:00 / Sunrise; Action ...".

Not seen in the wizard: a month field, `@random`, or an enable/disable toggle (they exist in the API; the app may show them on an existing schedule). Not saved yet, so the exact `Schedule.Create` the app sends is unknown; its code writes sun jobs as `@sunrise+<h>h<mm>m <day> <month> <weekdays>`. The schedule list shows a toggle per job, and only parses timespecs in its own format: one job it can't parse makes the whole page spin forever (2026-10-02; details in the shelly-scripts skill).

An existing job's pencil opens "Edit schedule" with the same four steps, prefilled (2026-10-02, a script job on Tapparella cucina): Week days ticked, Time "Sunrise / Sunset" 00h 01min After Sunrise, and under Action, "Local action:" rows named "<Method> ID: <id>" (e.g. "Script.Eval ID: 2"). The pencil on those rows is disabled, so a script call's arguments can't be seen or edited there. Its X asks "Exit Without Saving?"; "Exit without saving" sends nothing.

## Other device panel sections

Icons down the left of the device panel; known so far: calendar = Schedule, shield = Safety (obstacle detection and protections), cube = Virtual components.

### Virtual components (device panel → cube; observed 2026-10-02, web app 3.77.25)

Tabs Groups and Components. "Create virtual component": type (button, number, boolean, text, enum; id assigned, e.g. `button:200`, `number:200`), then settings: Name, View, and per type more (number: Min, Max, Step, Unit, Default Value, Persisted "Keep current value after reboot" / "Use default value after reboot", Web Icon, statistics, Event Log). Number views: Label, Field, Slider, Progressbar, Hidden ("Hidden" is stored as `meta.ui.view: ""`). It's created on the device through the cloud: no guest network needed. The Components tab then lists each with its key: a button as a press control, a number per its view (Field: a value box with Save; Hidden: marked "hidden" with its value as text, e.g. "40 %", no control; same whether created in the app or with `Virtual.Add` over RPC, 2026-10-02), a pencil ("Show component settings") and a trash ("Remove component", which asks "Delete Component?"). Unexplored: the link icon (presumably Actions/webhooks), the `{}` icon (presumably Scripts), the cube (presumably virtual components).

## Premium (kb.shelly.cloud, 2026-10)

€3.99/month or €35.99/year, 3-month free trial. Adds weather and sunrise/sunset scene conditions; activity log 100 events per device instead of 5 (the free log is short, which matters when debugging automations); 1-minute statistics instead of 1-hour; up to 20 dashboards with 80 widgets each instead of 5 and 40; up to 100 Alexa virtual actions instead of 3. Not needed so far (SKILL.md, ground rules).
