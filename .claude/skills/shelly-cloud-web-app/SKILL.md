---
name: shelly-cloud-web-app
description: Drive the Shelly Control web app (control.shelly.cloud) with the Chrome DevTools MCP. Covers the login hand-off, navigating rooms, groups, scenes and the device list, opening a device, reading cloud-only data (app device names, rooms, IDs, IPs) from the get_all_lists response, renaming a device through "Edit device", building scenes with a script (and its pitfalls), and not trusting a stale device panel. Use whenever you need data only the Shelly cloud/app holds (app names, rooms, groups, scenes), need to change something in the Shelly app, or local network access isn't available.
---

# Shelly Control web app (control.shelly.cloud)

Use the Chrome DevTools MCP (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`), which the user prefers over Claude in Chrome. The public Cloud Control API doesn't return app names or rooms, so the web app is how to reach cloud-only data.

## Login

Open `https://control.shelly.cloud/` with `new_page`. It lands on `#/login`. Ask the user to log in in that Chrome window, and never type their credentials. Continue once they say they're in. The MCP's Chrome profile keeps the login, so a later session often lands straight on the dashboard.

If every MCP call fails with "The browser is already running for …/chrome-devtools-mcp/chrome-profile", another Claude Code session's MCP still holds that Chrome (one profile, one browser). Find it with `command ps -axo pid,lstart,command | command grep chrome-profile`, tell the user which session owns it, and let them choose. On 2026-10-02 they chose to quit that Chrome; `kill -TERM <pid>` closed it cleanly in 2 s and the login survived.

## Reading cloud data (better than scraping the UI)

After login, the app calls `POST https://shelly-<n>-eu.shelly.cloud/interface/device/get_all_lists`. Its response has:

- `data.devices`, keyed by ID, each with `name` (the app name), `room_id`, `id` (the lowercase MAC), `ip`, `type`, `gen`, `mode`, `channel`, `ssid`, `cloud_online`, and more
- `data.rooms` (ID → `{name}`), plus `groups` and `dashboards`

To read it:

1. `list_network_requests` with `resourceTypes: ["xhr","fetch"]` and find `get_all_lists`.
2. `get_network_request` with `responseFilePath` under the project's `.scratch/`. The MCP can only write inside the workspace roots, not `/tmp` or the session scratchpad.
3. Parse with jq:
   ```sh
   jq -r '.data.rooms as $r | .data.devices[] | [.name, $r[(.room_id|tostring)].name, .id, .ip] | @tsv' .scratch/get_all_lists.network-response
   ```
4. For a fresh copy after changes, run `navigate_page` with `type: "reload"` and read the new request.

**Token hygiene:** `get_network_request` prints the request headers, including `authorization: Bearer <JWT>`, which is valid for about 24 hours. Don't copy it into files or messages. Tell the user it appeared in the session output and that they can log out of that window when done.

## Navigating

- The bottom bar has Dashboard, My home, Energy, Settings, Assistant, and Add device.
- "My home" has these tabs: All Rooms (`#/home/rooms/-1`), All Groups, All Scenes, All Devices (`#/home/devices/-1`), All Thermostats, Alarms. After some actions the app jumps to a room page (`#/home/room/<room_id>/devices`) where the tabs are missing. Use `location.hash = '#/home/devices/-1'` to get back.
- Each device card shows the name, power, and voltage, plus **Up and Down arrow buttons that move the blind** (`[aria-label="Direction Up or Pause"]`, `[aria-label="Direction Down or Pause"]`; a click from `evaluate_script` moves it, a second one pauses). To open a device, click its name element (a `<p>` holding exactly the name), not the card's center or the arrows.
- Watching a cover from the cloud: on All Devices each card's text (e.g. "Tapparella soggiorno 100 % 0 W 235.5 V") updates live, within about a second, and the watts jump while the motor runs. The percentage stays at the starting position until the move ends (2026-10-06). Polling it once a second from `evaluate_script` timed a scene's delayed action to the second (2026-10-04). The page has to stay on All Devices while polling.
- The live card can go stale: after the computer's connection dropped on 2026-10-07 it kept showing 100 % while the cover had moved to 40 %; a reload showed the truth. A polling loop in `evaluate_script` also ran about twice as slow as its timers said (a 58 s loop took ~2 min), probably timer throttling, so use short loops and compare with `command date`.
- Who moved a cover, and when: Dashboard → **Activity Log** (`#/dash/event_log`) lists each device's events with timestamps, a start and an end per move (the end with an "open" icon when it ended open), 5 per device on the free plan, newest first; it doesn't say what commanded the move. It timed a scene's start to the second (09:44:00, end 09:44:10; 2026-10-07).
- Moving a cover to a position from the web app: open the device; the panel's `input[type=range]` with `aria-label="Set position"` takes the native setter plus `input` and `change` events and sends the move at once (40 → 30 in 3 s, 2026-10-07). It moves the cover: only when that's the task.
- A tab left open overnight sent four `interface/device/save` requests by itself at 00:51 (2026-10-07), for the two Soggiorno covers while they flickered offline/online; names and room were unchanged (only `position`, the order in the room, and `modified`). Harmless, but close the tab after a session and don't mistake such requests for your own.
- Running a scene: each card on All Scenes has a "Run Scene" button (and a "Disable scene" toggle next to it; don't hit that). The MCP `click` on its uid times out because the list is marked as a disabled drag-and-drop list; click `.list-menu-card [aria-label="Run Scene"]` of the card whose `<p>` holds the scene name from `evaluate_script` instead. It sends `scene/manual_run` (2026-10-02).
- The right-hand panel lists notifications, each with a **"Reboot" button that reboots that device**. Don't click it by accident. Its "Actively consuming devices" list shows covers while their motor runs, whatever moved them (the iPhone app, a wall switch, an automation). If one appears that you didn't move, don't guess why; ask the user. It lists only about 5 devices at a time, so it can't prove that all 10 moved; ask the user to confirm (2026-10-02).
- The opened device panel shows "Edit device" and the main controls (Open/Close also move the blind). Its left column of unlabeled icon buttons switches sections; seen so far: calendar = Schedule (device schedules), shield = Safety (obstacle detection, protections).
- When a page spins forever, look for `Uncaught (in promise)` with `list_console_messages` (with stack traces), then read the app bundle around that line with `evaluate_script` (fetch the `index-*.js` script and slice it). That is how an unparseable schedule timespec was found to break the Schedule page (2026-10-02; shelly-scripts skill).
- **An open device panel doesn't refresh its settings forms.** On 2026-10-02 a panel left open since before obstruction detection was turned on still showed it off with a 100 W threshold, while the device had it on at 226 W; reopening the device showed the real values. Reopen the device (or reload) before reading a form, and never press a form's Save on a panel that may be stale, since it would write the old values back.
- Other pages: All Groups `#/home/groups/-1`, All Scenes `#/home/scenes/-1`, a room `#/home/room/<room_id>/devices` (tabs Devices, Groups, Scenes, Thermostats). What the group, scene and schedule wizards offer is in the shelly-automation skill. The wizards keep everything in the page until their final Save (adding a scene condition sent no request); the X asks "Exit without saving?".
- Clicking: the tab buttons and most wizard controls respond to `click` on a snapshot uid. Wizard choices are often an `<input type=checkbox>` inside a label, so from `evaluate_script` click the input whose label text matches; some labels aren't plain leaf elements.

## Renaming a device in the app

Device → "Edit device" opens a dialog. Step 1 shows the room list (current room preselected) and a "Device name" textbox. Set the name, click "Next" to reach step 2 (picture and colors), then click "Save". The app sends `POST interface/device/save` with `{id, data: {..., name, room_id}}` and jumps to the device's room page.

This `evaluate_script` function renamed 7 devices reliably on 2026-10-01. Edit `renames` and run it. It works one device at a time and reports per device:

```js
async () => {
  const renames = [['Old name', 'New name']];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(150); } return null; };
  const btn = label => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label);
  const leafP = text => [...document.querySelectorAll('p')].find(p => p.children.length === 0 && p.textContent.trim() === text);
  const log = [];
  for (const [oldName, newName] of renames) {
    location.hash = '#/home/devices/-1';
    await sleep(800);
    const p = await waitFor(() => leafP(oldName));
    if (!p) { log.push(`${oldName}: not found in list`); continue; }
    p.click();
    const edit = await waitFor(() => btn('Edit device'));
    if (!edit) { log.push(`${oldName}: no Edit device`); continue; }
    edit.click();
    const input = await waitFor(() => [...document.querySelectorAll('input')].find(i => i.value === oldName));
    if (!input) { log.push(`${oldName}: no name input`); continue; }
    // The app's framework only notices programmatic edits through the native setter plus an input event.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, newName);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const next = await waitFor(() => btn('Next'));
    if (!next) { log.push(`${oldName}: no Next`); continue; }
    next.click();
    const save = await waitFor(() => btn('Save'));
    if (!save) { log.push(`${oldName}: no Save`); continue; }
    save.click();
    const ok = await waitFor(() => leafP(newName));
    log.push(`${oldName} -> ${newName}: ${ok ? 'OK' : 'not confirmed'}`);
    await sleep(500);
  }
  return log;
}
```

Do the first device alone and verify it before running a batch. Afterwards, check a fresh `get_all_lists`: the name changed and `room_id` didn't.

## Building a scene from a script

All Scenes → the "+" button (aria-label "Add") opens the wizard; what each step offers is in the shelly-automation skill (`app-ui.md`). Scripting it with `evaluate_script` worked on 2026-10-02 (the-purge scenes), with these pitfalls:

- **Scope every query to the topmost dialog**: `[...document.querySelectorAll('.modal-container')].filter(m => m.offsetParent).at(-1)`. The action wizard opens a second `.modal-container` over the scene wizard, and a device side panel left open shows that device's name too: an unscoped search for "Tapparella cucina" clicked the side panel instead of the dialog's device.
- Options (condition and action types, devices, states, rooms, scenes) are leaf `<p>` elements; clicking the `<p>` selects them. Rooms in the device step are buttons named after the room; click one to expand it (only if its device isn't visible yet).
- **The "Execute the scene on save or edit" switch ignores a programmatic `input.click()`**: it stayed on. Turn it off with the MCP `click` on its uid from `take_snapshot` (the second `checkbox` in More options), then read the inputs' `checked` back and abort before Save unless it is `false`; otherwise saving moves the covers.
- **Background: black, always** (user, 2026-10-04): in the Details step click the first swatch under "COLORS AND GRADIENTS", `button.color-swatch.bg-color-0`. Otherwise the wizard keeps a default picture (`_meta.image: "images/room_def/bedroom_img_def_m.jpg"`). Check that the saved `_meta` has `"backgroundColor": "color-0"` and `"image": ""`. The same goes for rooms, groups and devices (`backgroundColor` and `image` in `get_all_lists`); only throwaway test items may keep the default.
- The Details step's name field is the input with `placeholder === 'Name'`; the room step's Search box is a text input too, so don't pick "the first text input". The native-setter-plus-`input`-event trick (see the rename function above) works on it; check that Save is enabled before clicking it.
- The minutes of an action delay: click the "Minutes" toggle, then the button with `aria-label="Increase value"` once per minute, and check the step's text reads "Execute the action after N minutes".
- "set position" shows a range input (0–100) and the label "Set position N%": set it with the native setter plus `input` and `change` events, then check the label (2026-10-02).
- **After a `scene/edit`, All Scenes lists only the edited scene** (the filter button gets a badge) until the page is reloaded (`navigate_page` `reload`); a script looking for another card then finds nothing (2026-10-06).
- A Device based condition (2026-10-06): the property chips (Opening State, Device Position, Power Consumption) and "Less than"/"More than" are checkboxes inside labels: click the `input` whose `closest('label')` text matches; the label text differs in case from what's shown ("Device position", "More than 42 %"), so match case-insensitively or by prefix; the value is an `input[type=number]` (native setter plus `input` and `change`). Their `checked` stays false whatever is selected, so check with a screenshot. In "Watch the property as", click the "Condition" text with the MCP `click` on its snapshot uid. The condition's Save returns to the scene wizard; its first "Add condition" adds to the same `and`, the one after "or" starts an `or` group.
- A Scene action: Action "Scene action" → the scene (leaf `<p>`, under its room's button) → "Fulfill scene as" (leaf text, e.g. "Start scene, evaluate conditions and then do actions if needed") → delay → Save. The card then reads "<scene> / Play scene".
- A Time based Daily / Weekly condition (2026-10-06): "Time based" → Next → the "Daily / Weekly Schedule" chip (label text "Daily / weekly schedule") → the weekday checkboxes (labels "M", "T", "W", "T", "F", "S", "S", in that order) → the hour spinner's first `button[aria-label="Increase button"]` clicked once per hour from 00 (the minute's is the second) → Save. Read the time back from the dialog's text.
- Moving a scene to another room: Edit scene, Next ×4 to Select room, click the room's leaf, Next, Save; the name and swatch stay as saved (2026-10-06).
- Renaming a scene: open its card (click its `<p>`), "Edit scene", Next ×5 to Details, check that "Execute the scene on save or edit" is still off, set the `Name` input (native setter plus events), Save (`scene/edit`, same id, so scenes that start it keep working). Renamed both bedroom helpers this way on 2026-10-06.
- After a new scene's Save, All Scenes may show only the saved scene's room (filter badge "1") until a reload; a search for another card then finds nothing.
- Editing a saved scene: open its card, "Edit scene", Next to Do, the action card's "Edit" (pencil), walk its steps with Next, Save, then the wizard's Next to Details and Save (`scene/edit`). Check "Execute the scene on save or edit" is still off before that last Save. **The order of a scene's actions can't be chosen in the app.** There is no drag-to-reorder, and the side panel and the editor always list them in the app's own order. As seen on Finisci: device actions by ascending device ID, then scene actions, then the delayed one. Editing cards in place (an action's "Edit" can change even its type, Device → Scene action) changes the *stored* order: Finisci was saved with "Disable scene" first and the cloud kept it (`scene/list`). But after a reload both views showed the sorted order again (2026-10-04). Saving from the editor probably writes that sorted order back (not tried). So never rely on, or promise, a visible action order. Known limitation: a Shelly Forum thread (June–October 2025, no answer from Shelly) confirms there is no reordering. Its workaround, deleting the later actions and adding them again, assumes the list shows the order of adding, which the web app (3.77.25) doesn't. Nothing online mentions the sorting itself (searched 2026-10-04). Inside the scene wizard the Edit buttons are, in order: the condition(s), then each action, then the active time. Deleting: the "Edit" toggle at the top of All Scenes, then the card's "Delete scene" and the modal's "Delete scene" (`app-ui.md`).
- Virtual components (device panel → cube icon → Components tab): "Create virtual component" opens a modal; the type is a combobox (MCP `click` on its uid, then click the `[role=listbox]` entry's leaf), and so are View and Persisted; the text fields fill with the MCP `fill`. An existing component's pencil is `[aria-label="Show component settings"]`, its trash `[aria-label="Remove component"]` (asks "Delete Component?", button "Delete component").
- Have the script stop just before the final Save and return the Do list (the dialog's `innerText`), the switches and the name; check them, then save. Confirm with the `scene/add` request (format in `app-ui.md`).

## Don't

- Don't call the cloud's internal endpoints directly with `fetch`. The app bundle also contains `device/factory_reset`, `device/erase_data`, and `device/delete`. Going through the UI is safer and keeps every change visible to the user.
- Don't click "Reboot", the arrows, Open/Close, or the "Hidden Devices" room unless that's the task.
- Don't save a scene that moves covers with "Execute the scene on save or edit" left on (the default): the covers move immediately.
