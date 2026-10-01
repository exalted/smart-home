---
name: shelly-naming
description: The house naming convention for smart home devices, and where device names live (on the device, Shelly app/cloud, Matter, Apple Home/HomeKit, Home Assistant, Alexa/Google, IKEA DIRIGERA) and how to keep them aligned. Use whenever naming or renaming a device, room or group, adding a new device or a new ecosystem (Matter, Thread, HomeKit, Home Assistant, DIRIGERA, Alexa), validating names (bin/shelly-name-check), or when a device shows different names in different apps.
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

## Hard rules, checked by `bin/shelly-name-check`

| Rule | Why |
|---|---|
| Only ASCII letters, digits, and single spaces | HomeKit allows letters, digits, spaces, and apostrophes. Home Assistant transliterates accents in entity IDs. macOS (NFD) and other systems (NFC) store accented letters differently. Apostrophes and other symbols break shell quoting and Windows filenames. |
| Starts and ends with a letter or digit | HomeKit rule |
| At most 32 bytes | Matter `NodeLabel` limit, which also applies to bridged devices (DIRIGERA's Matter bridge, future Thread devices) |
| Unique, ignoring case | Voice assistants, Home Assistant entity IDs, case-insensitive filesystems |

Run `bin/shelly-name-check "Tapparella cucina" ...`, or pipe names in one per line. It exits 1 and lists each problem.

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

## Smaller notes

- For files, scripts, and anything hostname-like, derive a slug: lowercase with hyphens, e.g. `tapparella-porta-cucina`. The device name doesn't affect networking; the hostname stays `shelly2pmg3-<mac>`.
- Siri: "chiudi la tapparella cucina" targets the named device, while "chiudi la tapparella **in** cucina" means every blind in that room. The user said to ignore this for now.
