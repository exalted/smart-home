---
name: shelly-naming
description: The house naming convention for smart home devices, and where device names live (on the device, Shelly app/cloud, Matter, Apple Home/HomeKit, Home Assistant, Alexa/Google, IKEA DIRIGERA) and how to keep them aligned. Use whenever naming or renaming a device, room, group, scene or virtual component, adding a new device or a new ecosystem (Matter, Thread, HomeKit, Home Assistant, DIRIGERA, Alexa), validating names (bin/shelly-name-check), or when a device shows different names in different apps.
---

# Naming devices

## The convention

`<Tipo> [porta] <stanza>`, in Italian, with real words. Examples: "Tapparella cucina" (kitchen window blind), "Tapparella porta cucina" (kitchen door blind).

- **Tipo first**: what the device is, using a specific word such as Tapparella, Contatto, Temperatura, Movimento, Luce, or Presa. Avoid the generic "Sensore". Leading with the type keeps different devices in the same room apart, e.g. a blind and a window contact.
- **Window is the default.** Add "porta" only for doors. Every room has at most one window and one door, so no other qualifier is ever needed.
- **Stanza** is the room as the household says it: cucina, soggiorno, studio, bagno ospiti, camera ospiti, bagno matrimoniale. The master bedroom is just "matrimoniale" (no "camera"), which keeps "Tapparella porta matrimoniale" within 32 bytes.
- **Real words, no abbreviations** ("Tapp", "matr"). Siri and Alexa match spoken words against names, so an abbreviation has to be spoken as written.
- **Brand- and technology-neutral** (no Shelly, Zigbee, Thread). Names should outlive the hardware and the ecosystem.

The user chose this over keeping "finestra" in every name (too long), dropping the type (it would collide with future window sensors), and abbreviating "Tapparella" (bad for voice).

## Hard rules for voice names, checked by `bin/shelly-name-check`

| Rule | Why |
|---|---|
| Only ASCII letters, digits, and single spaces | HomeKit allows only letters, digits, spaces, and apostrophes, so no hyphen ("must use only alphanumeric, space, and apostrophe characters", Home Assistant's HomeKit Bridge docs, checked 2026-10-06). Home Assistant transliterates accents in entity IDs. macOS (NFD) and other systems (NFC) store accented letters differently. Apostrophes and other symbols break shell quoting and Windows filenames. |
| Starts and ends with a letter or digit | HomeKit rule |
| At most 32 bytes | Matter `NodeLabel` limit, which also applies to bridged devices (DIRIGERA's Matter bridge, future Thread devices) |
| Unique, ignoring case | Voice assistants, Home Assistant entity IDs, case-insensitive filesystems |

Run `bin/shelly-name-check "Tapparella cucina" ...`, or pipe names in one per line. It exits 1 and lists each problem.

## Voice names and non-voice names (2026-10-06)

The hard rules above exist because a name may reach a voice assistant or an ecosystem that copies it (HomeKit, Matter, Siri, Alexa, Google, Home Assistant). A name that can never get there only has to work in the Shelly app, in this repo's files and tools, and for the household's eyes, so it may be looser (the user's request, 2026-10-06). Check those with `bin/shelly-name-check --no-voice`:

| Rule for non-voice names | Why |
|---|---|
| ASCII letters, digits, single spaces and `- _ . , : ( ) [ ] + %` | Enough for "[helper] …" or "Limite (15%)". No quotes, backticks, backslashes or slashes, which break shell quoting, jq filters and file names in our tools. Brackets and parentheses are fine as data, but in a pattern (`grep`, `sed`, jq `test()`, an unquoted shell word) `[helper]` is a character class or a glob: search for such a name with `grep -F` or escape it. ASCII only, so names compare equal in every tool (no NFC/NFD surprises) |
| No leading or trailing space | Invisible, and trimmed differently by different tools |
| At most 50 bytes | The strictest Shelly app limit found: script names (`maxlength` 50). The web app (3.77.25) sets no limit and no character check on scene, room, group or device names, and 255 on virtual component text fields (its code, read 2026-10-06); the cloud took "[helper] Privacy matrimoniale". Long names also get cut on cards |
| Unique, ignoring case | Names are how docs, `config/automations.json` and the tools refer to things |

Which names are which:

| Thing | Voice? | Why |
|---|---|---|
| Devices (on the device and in the app) | **Voice** | Alexa and Google discover them, Matter and Home Assistant copy them, HomeKit through Matter or HA |
| Groups | **Voice** | Meant to be called as one ("Alexa, close the blinds"); Shelly's guide says groups work by voice |
| Scenes people use (the button, the purge) | **Voice** | A scene reaches Alexa as a virtual device named after it once it gets an "Alexa Notify" action ([Shelly support](https://support.shelly.cloud/en/support/solutions/articles/103000294080-alexa-notify-in-shelly-smart-control-app-scenes-)), and Siri via a Shortcut; their other wordings live in `config/automations.json` (shelly-config skill) |
| Rooms that are real rooms | **Voice** | Siri's "in cucina" uses HomeKit's rooms, which should mirror these by hand |
| Helpers (scenes, groups or other things in the Helpers room) and that room | Non-voice | Only other scenes start them; never give them an Alexa Notify action or a Shortcut |
| Hidden virtual components ("Limite apertura") | Non-voice | Not shown in the app; Home Assistant would presumably make them entities, which reach an assistant only if exposed there on purpose |
| Script names, KVS keys, schedule jobs | Neither: technical | Their own convention, English kebab-case (shelly-scripts skill) |

If a non-voice thing ever has to be called by voice, rename it to pass the voice rules first. Not verified: whether Google Home gets Shelly groups or scenes, and how long a name the Shelly cloud stores (nothing over 30 bytes tried).

## Where names live, and why they drift

| Place | Notes |
|---|---|
| Device `sys.device.name` | The canonical copy. Set it with `bin/shelly-set-name`. It shows up in `/shelly`, the device web UI, and Home Assistant. |
| Device `cover:0` name | Leave it null, otherwise Home Assistant shows the device name twice. |
| Shelly app / cloud | Its own copy, **not synced with the device** in either direction. Edit it in the app or the web app (shelly-cloud-web-app skill). |
| Matter `NodeLabel` | Max 32 bytes. Matter is off on all devices, and the firmware has no setting for the label. It's unknown whether Shelly copies the device name into it. |
| Each Matter controller (Apple Home, Home Assistant, Google, DIRIGERA) | Each keeps its own copy, usually asked for at pairing. The device's name is only a starting suggestion. |
| Apple Home / HomeKit | Its own copy per home. It hides a room name at the start of a name. Via the Home Assistant HomeKit Bridge, it takes the HA entity name. |
| Home Assistant | Takes the device name. The entity ID slug (`cover.tapparella_cucina`) is frozen at first discovery, so later renames don't change it. |
| Alexa / Google | Copy the Shelly app name when they discover devices. Rename there, or run discovery again. |
| IKEA DIRIGERA | Matter controller and Thread border router since firmware 2.805.6, but only for device types IKEA sells itself, so it can't take the Shelly covers today. |

So a rename always covers the device **and** the Shelly app (shelly-rename-device skill). Afterwards, tell the user which other linked ecosystems still have the old name.

## Current names (2026-10-01)

IDs/MACs are in the device table in `CLAUDE.local.md`.

| Name | Room (Shelly app) |
|---|---|
| Tapparella bagno matrimoniale | Bagno matrimoniale |
| Tapparella bagno ospiti | Bagno ospiti |
| Tapparella camera ospiti | Camera ospiti |
| Tapparella porta camera ospiti | Camera ospiti |
| Tapparella porta matrimoniale | Camera matrimoniale |
| Tapparella cucina | Cucina |
| Tapparella porta cucina | Cucina |
| Tapparella soggiorno | Soggiorno |
| Tapparella porta soggiorno | Soggiorno |
| Tapparella studio | Studio |

## Scenes, groups and virtual components (2026-10-02)

The device convention doesn't fit these: a scene is named for what it does, as a phrase someone would say; a virtual component for the value it holds. Both are in Italian (household-visible), except helpers; each follows the voice or non-voice rules, whichever applies ("Voice names and non-voice names" above).

| Name | Kind | What |
|---|---|---|
| Inizia la notte del giudizio | Scene | the-purge: close all |
| Finisci la notte del giudizio | Scene | the-purge: open all (kitchen to its limit) |
| Limite apertura | Virtual number on Tapparella cucina (`number:200`, hidden in the app); on Tapparella studio too until 2026-10-07 | `kitchen-limit` |
| Privacy o apri matrimoniale | Scene (room Camera matrimoniale, Dashboard widget) | `bedroom-privacy`: the button |
| [helper] Matrimoniale: privacy | Scene (room Helpers) | `bedroom-privacy`: more open than 17 % → 15 % |
| [helper] Matrimoniale: apri | Scene (room Helpers) | `bedroom-privacy`: at 13–17 % → open |
| Abbassa o apri studio | Scene (room Studio, Dashboard widget) | `studio-glare`: the button |
| Studio pomeriggio feriale | Scene (room Studio) | `studio-glare`: Mon–Fri 15:00, starts [helper] Studio: abbassa |
| [helper] Studio: abbassa | Scene (room Helpers) | `studio-glare`: more open than 42 % → 40 % |
| [helper] Studio: apri | Scene (room Helpers) | `studio-glare`: at 38–42 % → open |
| Helpers | Room | Holds the helpers |

**Helpers: the way there, not the goal** (user, 2026-10-06). A scene that exists only as a step toward another one, because of Shelly's limits (e.g. the gated scenes behind a toggle button), goes in the room **Helpers** and its name reads `[helper] <Stanza>: <azione>`: "[helper] Matrimoniale: apri". So nobody mistakes it for something to tap, and since the one Helpers room holds helpers for every room and device, the room (or device) comes first and the list sorts by it; the action follows the colon. `<Stanza>` is the room word as in device names ("Matrimoniale", "Studio", "Bagno ospiti"); use the device ("Porta matrimoniale") only if a room's window and door ever both get helpers. The same holds for any later helper that isn't a scene (a group, a virtual device). The prefix was `helper - ` for a few hours, then became `[helper] `, which reads as a tag on the name rather than part of it; the room-first form came the same evening, and the two bedroom helpers were renamed to it (user's choices, 2026-10-06). `bin/shelly-name-check --no-voice` rejects a `[helper]` name not in this form. Helpers are non-voice names (above), checked with `bin/shelly-name-check --no-voice`: the brackets are fine there, and the room's name is English and technical, like "Global", because it may hold more than scenes (the user's choices). The goal (the button) keeps a normal Italian name in its real room.

**One scene per action.** Other languages and wordings for voice ("Begin the purge", "Inizia il giorno del giudizio") go in `config/automations.json` under `voice` and into the voice assistant when it's set up, not into extra scenes (user's decision, 2026-10-02; shelly-config skill). The English alias scenes that existed briefly were deleted. No group names yet.

## Smaller notes

- For files, scripts, and anything hostname-like, derive a slug: lowercase with hyphens, e.g. `tapparella-porta-cucina`. The device name doesn't affect networking; the hostname stays `shelly2pmg3-<mac>`.
- Siri: "chiudi la tapparella cucina" targets the named device, while "chiudi la tapparella **in** cucina" means every blind in that room. The user said to ignore this for now.
