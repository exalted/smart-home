---
name: shelly-cloud-web-app
description: Drive the Shelly Control web app (control.shelly.cloud) with the Chrome DevTools MCP. Covers the login hand-off, navigating rooms, groups, scenes and the device list, opening a device, reading cloud-only data (app device names, rooms, IDs, IPs) from the get_all_lists response, renaming a device through "Edit device", and not trusting a stale device panel. Use whenever you need data only the Shelly cloud/app holds (app names, rooms, groups, scenes), need to change something in the Shelly app, or local network access isn't available.
---

# Shelly Control web app (control.shelly.cloud)

Use the Chrome DevTools MCP (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`), which the user prefers over Claude in Chrome. The public Cloud Control API doesn't return app names or rooms, so the web app is how to reach cloud-only data.

## Login

Open `https://control.shelly.cloud/` with `new_page`. It lands on `#/login`. Ask the user to log in in that Chrome window, and never type their credentials. Continue once they say they're in.

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
- Each device card shows the name, power, and voltage, plus **Up and Down arrow buttons that move the blind**. To open a device, click its name element (a `<p>` holding exactly the name), not the card's center or the arrows.
- The right-hand panel lists notifications, each with a **"Reboot" button that reboots that device**. Don't click it by accident. Its "Actively consuming devices" list shows covers while their motor runs, whatever moved them (the iPhone app, a wall switch, an automation). If one appears that you didn't move, don't guess why; ask the user.
- The opened device panel shows "Edit device" and the main controls (Open/Close also move the blind). Its left column of unlabeled icon buttons switches sections; seen so far: calendar = Schedule (device schedules), shield = Safety (obstacle detection, protections).
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

## Don't

- Don't call the cloud's internal endpoints directly with `fetch`. The app bundle also contains `device/factory_reset`, `device/erase_data`, and `device/delete`. Going through the UI is safer and keeps every change visible to the user.
- Don't click "Reboot", the arrows, Open/Close, or the "Hidden Devices" room unless that's the task.
- Don't save a scene that moves covers with "Execute the scene on save or edit" left on (the default): the covers move immediately.
