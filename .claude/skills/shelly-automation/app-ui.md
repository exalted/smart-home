# Shelly app: groups, scenes, device schedules

Explored in the web app (control.shelly.cloud, version 3.77.24) on 2026-10-02, on the free plan, without saving anything. The iPhone app is assumed to match but wasn't checked. How to drive the web app is in the shelly-cloud-web-app skill. Alarm and Thermostat options are listed for completeness only: this home has neither (see SKILL.md).

## Rooms

- "My home" → All Rooms. A room page (`#/home/room/<room_id>/devices`) has tabs Devices, Groups, Scenes, Thermostats.
- Groups and scenes are assigned to one room or to **Global** (for anything spanning rooms).
- There is no room-level command anywhere, and no "room" action in scenes.

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
| Time based | yes | Timer (every N minutes), Daily / Weekly Schedule (weekdays + HH:MM), Once (date + HH:MM) |
| Scene based | yes | Reacts to another scene (not explored further) |
| Alarm based | yes | Not relevant here |
| Manual execution | yes | Run from the app/dashboard |
| Weather forecast based | **Premium** | Greyed out. Per the KB: forecast for the next 1–6 h, checked hourly; clouds, precipitation, wind direction (N/E/S/W) and force, temperature, humidity |
| Sunrise/Sunset based | **Premium** | Greyed out |

Cover properties for "Device based": **Opening State** (Open, Opening, Closed, Closing, Stopped), **Device Position** (less/more than N %), **Power Consumption** (less/more than N W).

"Watch the property as":
- **Condition**: "Check if it is the desired device state, but does not activate scene by itself"
- **Trigger**: "Check if it is the desired device state and activate the scene"
- "Trigger custom settings" → Condition type: **On any change** (fires on every new qualifying value), **Repeatedly** (checks every minute and fires while it holds), **Once** (fires when the condition becomes true; it must become false again to re-fire), plus "Condition is valid N minutes" (hold time).

Several conditions combine with and/or.

### Do: actions

"Add action" → Create action or Import action. Types: Device action, Group action, Scene action, Notify action, Alarm action.

Device action steps: Action → Device → Change state → Delay action. For a cover: "open Shelly roller", "stop Shelly roller", "close Shelly roller", "set position Shelly roller" (slider 0–100 %). Delay: "Execute the action after N" seconds or minutes, 0–1440.

### Active time

Intervals of weekdays + start/end time ("Specific interval"); default every day 00:00–23:59. "Add interval" stays disabled while the default whole-day interval exists. **No dates, no months.**

### More options

- "Enable scene" (on by default): "If you disable the scene it will not execute until you enable it manually."
- **"Execute the scene on save or edit" (on by default)**: "...it will trigger the scene whenever you edit it or when certain system changes occur, such as an account timezone change or a Shelly server reset." Turn it off for any scene that moves covers, or they move on save and on every edit.

### Select room, Details

Global or a room; name and picture.

## Device schedules (device panel → calendar icon "Schedule" → Add schedule)

These are stored on the device itself (the Schedule component; see device-api.md).

Steps: **Week days → Time → Action → Preview**, each in "Simple" or "Advanced" mode ("Switch to Advanced mode for more complex schedules").

- Week days: Mon–Sun checkboxes (all ticked by default).
- Time, Simple: "Choose time interval" → **Time** (HH:MM) or **Sunrise / Sunset** with an offset (hours, minutes, Before/After). Free on this account.
- Time, Advanced: toggles for Hours, Minutes, Seconds (repeating jobs).
- Action: "You can add up to 5 actions." → Add local action: **Open Cover, Close Cover, Stop Cover, Move Cover to specific position**.
- Preview: "Execute schedule on Mon-Sun; at 00:00:00 / Sunrise; Action ...".

Not seen in the wizard: a month field, `@random`, or an enable/disable toggle (they exist in the API; the app may show them on an existing schedule). Not saved yet, so the exact `Schedule.Create` the app sends is unknown.

## Other device panel sections

Icons down the left of the device panel; known so far: calendar = Schedule, shield = Safety (obstacle detection and protections). Unexplored: the link icon (presumably Actions/webhooks), the `{}` icon (presumably Scripts), the cube (presumably virtual components).

## Premium (kb.shelly.cloud, 2026-10)

€3.99/month or €35.99/year, 3-month free trial. Adds weather and sunrise/sunset scene conditions; activity log 100 events per device instead of 5 (the free log is short, which matters when debugging automations); 1-minute statistics instead of 1-hour; up to 20 dashboards with 80 widgets each instead of 5 and 40; up to 100 Alexa virtual actions instead of 3. Not needed so far (SKILL.md, ground rules).
