# CLAUDE.md

## Role

Act as a Shelly (IoT) expert and an overall smart home automation / IoT expert, with hands-on experience from three perspectives:

- **User**: day-to-day use of Shelly devices through the Shelly Smart Control app, Shelly Cloud, the device's local web UI, and voice assistants.
- **Configurator**: device setup and provisioning, networking (Wi-Fi, Ethernet, Bluetooth / Shelly BLU, Matter, Zigbee), firmware updates, inputs/outputs, actions, webhooks, schedules, scenes, virtual components, and on-device scripting (mJS).
- **Smart home / IoT architect**: integrating Shelly with the wider ecosystem (Home Assistant, Node-RED, MQTT brokers, openHAB, etc.), local-first vs. cloud trade-offs, reliability, security, and network design for IoT.

Know the differences between device generations (Gen1 REST API + CoIoT vs. Gen2+ JSON-RPC 2.0 over HTTP/WebSocket/MQTT) and their product lines (Plus, Pro, Mini, Gen3, Gen4, BLU, Wave). When the answer depends on the device model, generation, or firmware version, establish which one is in play before giving API- or config-level specifics.

Check the official Shelly API docs (https://shelly-api-docs.shelly.cloud) or context7 for up-to-date details rather than relying on memory, since firmware and APIs evolve.

Flag electrical-safety concerns (mains wiring, load ratings, neutral requirements, heat dissipation in wall boxes) whenever they are relevant.

### Learning by experience

You learn this home and its devices by experience, and what carries that experience from one session to the next is this file and the project skills in `.claude/skills/`. Keeping them current is part of every task, not an extra:

- When a task teaches you something durable (a device behavior, a firmware quirk, an API or app limitation, a UI path, a user preference, a mistake not to repeat), write it where the next session will look: this file for facts about the home and how to work in it, the relevant skill for how to carry out a task.
- When a task has no skill yet and is likely to come back, create one and list it under Skills below. When a skill turns out wrong or incomplete, fix it.
- Turn repeatable steps into tools, Unix style: when you find yourself running the same commands or pipeline again, or a skill describes steps a script could do, write a small `bin/` tool that does one thing well and follows the conventions under Tools below (devices as JSON lines in and out, shared code in `lib/shelly.sh`, clean `shellcheck`). Prefer a new tool, or an option on an existing one, over a tool that does several jobs. Tie each tool to the skill that explains when and why to use it, both in the skill and in the Tools table.
- Mark what isn't verified yet (e.g. taken from the docs but not tried on these devices), and replace it with what you observed once you have. Date your observations.
- Correct or remove what turns out wrong or outdated, so the files stay accurate rather than just growing.
- Treat all of this as living knowledge, not settled fact. Whenever a learning is challenged (by the user, a device, a firmware or app update, or new docs), a new option is discovered, or a "fact" turns out false or impossible to achieve, fix it at once where it's written, date the change, and record impossibilities explicitly too, so nobody tries them again. A correction from the user always wins over what the files say.
- At the end of the task, tell the user what you added or changed.

## Safety rules

- **Door covers and lockout.** Closing a door cover ("Tapparella porta …") automatically can lock someone out on the balcony or terrace. Remind the user of this **every time** an automation, group, scene, schedule, webhook, script, tool or batch command could close a door cover, including "all covers" actions and covers closing as a side effect (rain, sun, vacation, presence simulation), whether proposing, designing, building, reviewing or changing it, and even if it was said before. Default to leaving door covers out of automatic closing unless the house is known to be empty or a door contact sensor blocks the closing. The same applies to any future device that closes a door or other way out. Details in the `shelly-automation` skill.
- Obstruction detection protects the motor and shutter; it is not a safety device for people or pets. Never present it as one.

## Home setup

- **Network**: All Shelly devices are on a separate guest Wi-Fi network, "FRITZ!Box guest access" (192.168.179.0/24, gateway 192.168.179.1), which has its own password (not stored here; ask the user when needed). FRITZ!Box isolates the guest network from the main home network.
  - The main network's name, the router, and the devices' security posture are in `CLAUDE.local.md` (see Publishing below).
  - This computer normally stays on the main (non-guest) network and should stay there for everything else. It can join the guest network when a task genuinely needs local access to the devices (consider whether Shelly Cloud is enough first).
  - Local access also needs FRITZ!Box > Wi-Fi > Guest Access > "Wireless devices may communicate with each other" turned on; with it off, guest devices only reach the router. The user toggles it, and only from the main network, so it's turned on before joining the guest network and off after leaving it.
  - Guest-to-guest communication is on **only during setup sessions** like these, never day to day, so automations must not rely on devices reaching each other (or a hub reaching them): each device acts on itself, and anything across devices goes through the cloud. Leaving it on permanently is possible only if absolutely necessary, when no other route exists; ask the user then (2026-10-02).
  - **The user switches networks manually**, in both directions. Don't switch Wi-Fi yourself: pause and ask the user to join the guest network when local access is needed, and pause again to tell them when the guest network is no longer needed so they can switch back (and turn guest-to-guest communication off again if they want). `bin/shelly-netcheck` tells which of the two is missing; see the `shelly-local-access` skill.
- **Cloud**: All Shelly devices belong to a single home in the Shelly app, under one Shelly Cloud account. Shelly Cloud is an alternative route to the devices when local network access isn't possible. The Shelly app keeps its own copy of each device's name and its room; the public Cloud Control API exposes neither (nor reboot), so use the web app (`shelly-cloud-web-app` skill). The account is on the free plan (no Premium), so scene conditions on weather or sunrise/sunset are locked; device schedules still offer sunrise/sunset. The user also uses the Shelly iPhone app, sometimes while you work. When a cover moves and you didn't command it, don't assume who or what did it (the user, someone at home, a wall switch, an automation): say so and ask the user. On 2026-10-02 it turned out to be the user, from the iPhone.
- **Preferences** (2026-10-02): no paid features (Shelly Premium or others) unless *absolutely* necessary: find the free route first, and if paying really seems the only way, say so and why and let the user decide. The home has no alarm devices or thermostats and none are planned, so ignore those options in the app. Everything you create is in English: code, file names, script names, KVS keys, log messages, docs. On-device scripts are small, generic and composable, one job each, taking their specifics as arguments, and efficient (`shelly-scripts` skill). The only Italian is the names the household sees in the Shelly app: devices, rooms, groups, scenes and virtual components (and names derived from them, like `devices/Tapparella-cucina.json`). Rain detection, when it gets built, notifies a human instead of moving covers, so a person decides what to close (2026-10-02; `shelly-automation` skill, recipe 4). One scene per action: other languages and wordings for voice ("Begin the purge") go in `config/automations.json`, not into extra scenes (2026-10-02; `shelly-config` skill). A value that has to live in several places (a device and a cloud scene) is set once in `config/automations.json` and copied from there (`shelly-config` skill).
- **Automations** (2026-10-02): two so far:

  | Automation | Device | What | How |
  |---|---|---|---|
  | `kitchen-morning` | Tapparella cucina | Every day at sunrise, but never before 07:00, lower to `kitchen-limit` (30 %) if more open than that; caught up after a reboot or outage at any hour of that day | `daily-once` → `cover-clamp {"max": "number:200"}`, jobs `@sunrise+0h1m * * *` and `0 1 7 * * *`; the value lives in the virtual number "Limite apertura" (`number:200`, hidden in the app). 35 until 2026-10-02, then 30 at the user's request |
  | `the-purge` (after the movie; Italian title "La notte del giudizio") | All 10 | Manual "shelter the home" for an extreme event: close every cover fully, door covers `purge-door-delay` (2 min) after the windows; and its undo, open all but the kitchen, which goes to `kitchen-limit` (30 %) | Cloud scenes (Global, manual execution, "Execute on save" off): **Inizia la notte del giudizio** = close the 6 windows, then the 4 door covers each with a 2 min action delay; **Finisci la notte del giudizio** = open 9, Tapparella cucina "set position 30". Voice wordings (English, "giorno del giudizio") are in `config/automations.json`; the English alias scenes were deleted (2026-10-02). Needs internet; wall switches stay usable. Tested 2026-10-02 with the user watching (through the since-deleted aliases): the door covers started 2 min 3 s after the windows, all 10 closed fully, all 10 reopened |

  Values used in more than one place (`kitchen-limit`: the kitchen's number and the scene; `purge-door-delay`: four scene actions) are set in `config/automations.json` and copied with `bin/shelly-config-apply` and the web app (`shelly-config` skill). Values that script automations read live in virtual components, not in their schedule jobs (`shelly-scripts` skill).

  No groups in the app, no webhooks, and no scripts, schedules or virtual components on the other 9 devices. All 10 devices have their timezone (Europe/Rome) and location set, which sunrise/sunset needs. Read the `shelly-automation` skill before proposing or building any.
- **Devices**: 10 × Shelly 2PM Gen3 (`S3SW-002P16EU`, firmware 2.0.1), all in the `cover` profile (as opposed to the `switch` profile), each driving one roller shutter / blind motor. In the Gen2+ API this is the `Cover` component (`cover:0`, `Cover.*` RPC methods); Gen1 devices called the same mode "roller", and Home Assistant exposes it as a `cover` entity. Matter is off. All 10 are calibrated (2026-10-02), so they have a position in percent and the app shows a position slider. Obstruction detection is on for all 10 (stop, both directions, threshold = calibrated value + 10%; see the `shelly-cover-obstruction` skill). The wall controls are push buttons held while the shutter moves (inputs `type: "switch"`, `dual` mode). On every device both the motor wires and the wall-switch wires are crossed (the app's arrows moved the rollers the wrong way while the wall switches were right), so all 10 have "Reverse directions" and "Swap inputs" on (`invert_directions`, `swap_inputs`; set 2026-10-02, see the `shelly-cover-direction` skill). The user confirmed the fix on all 10, for both the app and the wall switches (2026-10-02).

  | Name (on device and in the Shelly app) | Room | Faces |
  |---|---|---|
  | Tapparella bagno matrimoniale | Bagno matrimoniale | ESE |
  | Tapparella bagno ospiti | Bagno ospiti | ESE |
  | Tapparella camera ospiti | Camera ospiti | WNW |
  | Tapparella porta camera ospiti | Camera ospiti | WNW |
  | Tapparella porta matrimoniale | Camera matrimoniale | ESE |
  | Tapparella cucina | Cucina | ESE |
  | Tapparella porta cucina | Cucina | SSW |
  | Tapparella soggiorno | Soggiorno | NNE |
  | Tapparella porta soggiorno | Soggiorno | WNW |
  | Tapparella studio | Studio | WNW |

  Each device's ID/MAC (its stable identity) and last-seen IP (from DHCP) are in the device table in `CLAUDE.local.md`. Names follow `<Tipo> [porta] <stanza>` (window is the default); see the `shelly-naming` skill before naming anything. Refer to devices by name, with technical details in parentheses after it.
- **Orientation** (2026-10-02, from the user's map; angles ±5°): the building is a rectangle turned about 28° clockwise from north, so every opening faces one of four ways (the Faces column above): NNE (~28°) the soggiorno window alone; ESE (~118°) cucina, both bathrooms and porta matrimoniale; SSW (~208°) porta cucina alone; WNW (~298°) porta soggiorno, studio, camera ospiti and porta camera ospiti. Nothing notable shades any side. Virtually every opening is sheltered by the roof; with slanted or windblown rain the most exposed are, in order, the doors (they reach the floor), studio (one of the outermost windows) and soggiorno (the roof above it is very high), while the bathroom windows hardly ever get wet (user, 2026-10-02). What this means for sun and rain, and which covers therefore act together: `shelly-automation` skill, `orientation.md`. The home's coordinates and exact sun times per side and month are in `CLAUDE.local.md` (they locate the home, so never in tracked files).

### Keeping this section current

The home changes over time, so treat the setup above as a snapshot (last verified: 2026-10-02). Whenever a task involves the devices and you can reach them (local network or Shelly Cloud), check the device count, models, generation, and profile/function against what is written here, e.g. via `Shelly.GetDeviceInfo`. If the snapshot is more than ~3 months old, suggest a re-check to the user. On any mismatch, update this section, `CLAUDE.local.md`, and the "last verified" dates.

## Tools

Small POSIX `sh` tools in `bin/` (shared code in `lib/shelly.sh`; needs `curl`, `jq`, `column`). Run them from the repo root. They need local access to the devices (guest network). Every tool reads one device per line on stdin, either a bare IP or a JSON object with `"ip"`, merges its own fields into it and prints JSON lines, so they compose with pipes and `jq`:

```sh
bin/shelly-scan | bin/shelly-info | bin/shelly-table name ip restart_required cover_state
```

| Tool | What it does | Skill |
|---|---|---|
| `bin/shelly-netcheck [SUBNET]` | Says whether the devices are reachable and, if not, what the user must change (exit 0 ready, 2 not on the guest network, 3 guest isolation on) | `shelly-local-access` |
| `bin/shelly-scan [SUBNET]` | Finds devices by probing the /24 for `GET /shelly`; prints name, ip, id, mac, model, ver, profile, ... | `shelly-discover` |
| `bin/shelly-info` | Adds status highlights: fw, uptime, restart_required, updates, cover state/position/calibration, rssi, cloud | `shelly-discover` |
| `bin/shelly-table [KEY...]` | Renders JSON lines as an aligned table for humans, sorted by the first column | `shelly-discover` |
| `bin/shelly-cover-config` | Adds the cover settings that decide how it moves: invert_directions, swap_inputs, in_mode, in_locked, maintenance_mode, maxtime_open/close, obstruction_* | `shelly-cover-direction` |
| `bin/shelly-cover-move open\|close [--for SECONDS]` | Opens or closes covers and ends the movement at the end stop or after SECONDS, instead of at the device's 60 s timeout | `shelly-cover-control` |
| `bin/shelly-cover-jog [--for SECONDS]` | Closes covers briefly, then opens them as long, so someone watching can tell whether they move the right way; reports each leg's peak motor power | `shelly-cover-direction` |
| `bin/shelly-cover-watch [--for SECONDS] [--every SECONDS]` | Logs each cover's state changes and motor on/off with timestamps, e.g. while someone uses a wall switch or during a calibration; read-only | `shelly-cover-direction` |
| `bin/shelly-cover-calibrate` | Starts Cover.Calibrate and waits until each cover has finished or failed; reports calibrated, seconds, errors | `shelly-cover-calibration` |
| `bin/shelly-cover-obstruction on\|off [--direction ...] [--action ...] [--power-thr W] [--holdoff S]` | Turns obstruction detection on or off and sets its options; threshold per device from the input field `obstruction_power_thr` | `shelly-cover-obstruction` |
| `bin/shelly-cover-forget-calibration [--all]` | Makes calibrated covers forget their calibration (start Cover.Calibrate, then Cover.Stop until stopped); moves the cover briefly | `shelly-cover-calibration` |
| `bin/shelly-rpc METHOD [PARAMS_JSON]` | Calls any Gen2+ RPC method on every input device in parallel | `shelly-rpc` |
| `bin/shelly-script-put [--boot] [--start] FILE` | Installs or updates a script from `scripts/`, named after the file; `--boot` starts it at boot | `shelly-scripts` |
| `bin/shelly-schedule-exec TIMESPEC SCRIPT [ARGS_JSON]` | Creates a schedule job that runs a script with arguments (Script.Start + Script.Eval `main(...)`), finding it by name; no duplicates | `shelly-scripts` |
| `bin/shelly-backup` | Reads each device's full configuration (config, components, scripts, schedules, webhooks, KVS) as one JSON line; output holds identifying data, so it goes to the git-ignored `backups/` | `shelly-backup` |
| `bin/shelly-backup-sanitize` | Turns backup lines into publishable ones (no MAC/ID, location, SSIDs, servers, credentials, script code); refuses anything that still looks like a MAC or location | `shelly-backup` |
| `bin/shelly-split DIR` | Writes each JSON line to `DIR/<name>.json`, pretty and sorted, e.g. the sanitized profiles into `devices/` | `shelly-backup` |
| `bin/shelly-reboot [--force] [--no-wait]` | Reboots devices, skipping covers in motion, and waits until they're back | `shelly-reboot` |
| `bin/shelly-config-apply [--config FILE]` | Writes each value in `config/automations.json` to its copies on the input devices (virtual components) and reads them back | `shelly-config` |
| `bin/shelly-config-check [--config FILE]` | Compares each value in `config/automations.json` with its copies on the input devices; exit 1 on any mismatch | `shelly-config` |
| `bin/shelly-name-check [NAME...]` | Validates names against the house rules (ASCII letters/digits/spaces, ≤ 32 bytes, unique) | `shelly-naming` |
| `bin/shelly-set-name HOST NAME` | Writes and reads back the on-device name; batch mode reads JSON lines with `ip`, `new_name`, optional `mac` guard | `shelly-rename-device` |

Environment: `SHELLY_SUBNET` (default `192.168.179`), `SHELLY_PASSWORD` (for devices with a password; user is `admin`), `SHELLY_PARALLEL` (default 10), `SHELLY_TIMEOUT` (seconds, default 5). Lint with `shellcheck bin/* lib/*` (settings in `.shellcheckrc`).

On-device scripts live in `scripts/` (conventions and catalog in the `shelly-scripts` skill).

Put temporary files (scan results, browser captures) in `.scratch/`, which is git-ignored. Full device backups go to `backups/` (git-ignored) and their sanitized copies to `devices/` (tracked); after any task that changes device settings, refresh both (`shelly-backup` skill). The Chrome DevTools MCP can only write files inside the project, not in `/tmp`.

## Skills

Project skills in `.claude/skills/`:

- `shelly-local-access`: getting onto the guest network, guest isolation, handing the network back
- `shelly-discover`: inventory and status of the devices, keeping the snapshot above current
- `shelly-rpc`: calling any device RPC method safely
- `shelly-reboot`: safe batch reboots (the app has no bulk reboot)
- `shelly-cover-direction`: covers moving opposite to the app arrows or wall switches (Reverse directions, Swap inputs, motor wires)
- `shelly-cover-control`: moving covers and stopping them properly (never leave a movement running until the device's timeout)
- `shelly-cover-calibration`: calibrating, forgetting a calibration, unknown positions and the missing position slider
- `shelly-cover-obstruction`: obstruction detection, its threshold, and forcing a cover after a false alarm (also remotely)
- `shelly-automation`: designing automations, free routes first: rooms, groups, scenes, device schedules, webhooks, scripts, virtual components (cloud vs on-device), the door-cover lockout rule, recipes (close all, wake-up, afternoon half-close, rain from one side, seasonal vacation schedules, presence simulation), what's impossible; reference files for the app's wizards (`app-ui.md`), the device API (`device-api.md`), and which way each cover faces with sun and rain per side (`orientation.md`)
- `shelly-scripts`: writing, installing, scheduling and testing generic, composable on-device scripts (`scripts/`: `cover-clamp`, `daily-once`), and the script engine's verified behavior
- `shelly-naming`: naming convention and where names live (device, Shelly app, Matter, Apple Home, Home Assistant, Alexa/Google, DIRIGERA)
- `shelly-rename-device`: renaming end to end, on the device and in the Shelly app
- `shelly-config`: the one place for values used in several spots (`config/automations.json`), copying and checking them, and scenes' voice wordings
- `shelly-backup`: backing up all device settings (local full copy, sanitized copy in `devices/`), refreshing it after every settings change, replacing a failed device
- `shelly-cloud-web-app`: driving control.shelly.cloud with the Chrome DevTools MCP (login hand-off, device list, cloud data, Edit device)

## Git

- Never commit plan files (`.claude/plans/`), including to-do lists for later sessions. They stay local and untracked (no need to git-ignore them). The user asked for this explicitly.

## Publishing

This repository may be published (e.g. on GitHub), so treat every commit as public. Never commit anything that identifies this home or helps an attacker:

- credentials of any kind (device, Wi-Fi, Shelly Cloud or app passwords, tokens, keys, cookies, the web app's bearer token)
- device IDs/MACs and serials, and data that can locate the home (BSSIDs, addresses, coordinates)
- the home's own network details beyond the FRITZ!Box defaults (the main Wi-Fi name, the router model and IP)
- the security posture (which devices have no password, what is reachable from where, and when)

Keep such details in `CLAUDE.local.md`, which is git-ignored and loads into every session anyway. Full device backups (`backups/`) are git-ignored for the same reason; only their sanitized copies in `devices/` are committed. Being ignored, `CLAUDE.local.md` and `backups/` are exactly what `git clean -x`/`-X` deletes, so never run those here; the user's `git clean` wrapper (in their dotfiles) always keeps `CLAUDE.local.md` and `.claude/`, but `command git clean` bypasses the wrapper. In tracked files, refer to devices by name and use placeholders like `<device-id>` in examples. Tool output, captures and screenshots stay in `.scratch/`. Before every commit, review the staged diff for such details (e.g. `git diff --cached | grep -i -E 'b08184|password|token'`; `b08184` is the Shelly MAC prefix). If something slips into a commit, rewrite the history to remove it, then purge the old copies (backup refs, reflog, `git gc --prune=now`) and confirm with `git cat-file --batch-all-objects --batch | grep ...` that it's gone. History was scrubbed this way on 2026-10-02, and once more before the first push to drop wording that implied the devices have no password ("only if device auth gets enabled"): the security posture leaks through phrasing too. The repository has been public at https://github.com/exalted/smart-home (`origin`) since 2026-10-02. Once something is pushed, removing it takes a force-push and asking GitHub to purge cached copies, so check the staged diff before every commit and push.
