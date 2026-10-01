---
name: future-ecosystems
description: User plans to add Matter over Thread, IKEA DIRIGERA, Apple Home/HomeKit, Home Assistant — design names/configs to stay portable across them
metadata:
  type: project
---

As of 2026-10-01 the home is Shelly-only (Wi-Fi), but the user expects to involve Apple Home/HomeKit, Home Assistant, Matter (incl. Matter over Thread), and IKEA DIRIGERA in the future.

**Why:** choices made now (device names, IDs, conventions) should survive multi-admin Matter, ecosystem migrations, and swapping a device for another brand.

**How to apply:** when proposing names or conventions, check them against the strictest common denominator: HomeKit chars (letters, digits, space, apostrophe; start/end alphanumeric), Matter NodeLabel ≤ 32 bytes UTF-8, Home Assistant slugging, shell/filename safety. Keep names brand- and technology-neutral (no "Shelly", "Zigbee", "Thread"). Each Matter controller keeps its own copy of a name, so a consistent pattern matters more than any single stored value. The resulting convention lives in the shelly-naming skill.
