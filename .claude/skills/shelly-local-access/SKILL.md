---
name: shelly-local-access
description: Get and verify local network access to the home's Shelly devices (FRITZ!Box guest Wi-Fi, guest isolation) before any local API call, and hand the network back afterwards. Use whenever a task needs to talk to a Shelly device directly (scan, RPC, reboot, rename, status, firmware, config), when devices seem unreachable, scans find nothing or requests time out, or the user mentions the guest network or "FRITZ!Box guest access".
---

# Local access to the Shelly devices

The Shelly devices live on the FRITZ!Box guest Wi-Fi "FRITZ!Box guest access" (192.168.179.0/24, gateway 192.168.179.1). This Mac normally sits on the main network (name in `CLAUDE.local.md`), which FRITZ!Box isolates from the guest network. Local access needs two things only the user can do:

1. Join this Mac to the guest Wi-Fi.
2. Allow guest-to-guest traffic: FRITZ!Box > Wi-Fi > Guest Access > "Wireless devices may communicate with each other" ON. With it off, guest devices reach only the router, so nothing answers even though the Mac is on the right network.

## First, is the cloud enough?

The Shelly app and control.shelly.cloud can rename devices, reboot a single device, and move covers (see the shelly-cloud-web-app skill). Go local for bulk operations, RPC methods the cloud doesn't expose (the public Cloud Control API has no reboot and no generic RPC), or to verify device state.

## Check

Run `bin/shelly-netcheck` from the repo root. It prints one line and exits with:

- `0` ready: go ahead.
- `2` not on the guest network: ask the user to join "FRITZ!Box guest access" and to say when they're on it.
- `3` on the guest network, but no device answers: ask the user to turn on "Wireless devices may communicate with each other" in FRITZ!Box > Wi-Fi > Guest Access.

Run it again after the user confirms.

## Don't switch Wi-Fi yourself

The user switches networks manually, in both directions, and asked to be told when to do it. Automating it doesn't work anyway: `networksetup -setairportnetwork en0 "FRITZ!Box guest access"` fails with error -3900 because it can't use the password macOS has saved, and macOS hides the current SSID from CLI tools (`networksetup -getairportnetwork`, `ipconfig getsummary`, and `system_profiler` all show `<redacted>`), so a script can't reliably tell which network to go back to.

## When the local work is done

Say so right away rather than waiting to be asked, because it's easy to forget:

- The user can switch back to the main network.
- They may want to turn "Wireless devices may communicate with each other" off again. While it's on, anyone on the guest Wi-Fi can reach the devices.

## Diagnostics when netcheck's verdict looks wrong

- `command ipconfig getifaddr en0` shows 192.168.179.x on the guest network and another address on the main network.
- `command arp -an -i en0` lists only the gateway and this Mac when guest isolation is on.
- From the main network, `command curl -s http://<router-ip>/jason_boxinfo.xml` (router IP in `CLAUDE.local.md`) identifies the router model and FRITZ!OS version.
