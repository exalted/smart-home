---
name: shelly-rpc
description: Call any Shelly Gen2+/Gen3 JSON-RPC method (Sys.GetConfig, Cover.GoToPosition, Shelly.Update, Script.*, Matter.GetConfig, Wifi.*, etc.) on one or many devices at once with bin/shelly-rpc. Use whenever a task needs a device API call that the other shelly-* tools don't wrap, such as reading or changing configuration, controlling covers, inspecting Matter/BLE/MQTT settings, or updating firmware.
---

# Calling RPC methods

`bin/shelly-rpc METHOD [PARAMS_JSON]` reads devices from stdin (bare IPs, or JSON lines with `"ip"`) and calls the method on all of them in parallel (10 at a time, set `SHELLY_PARALLEL` to change). It prints each input object plus `"result"` or `"error"`, and exits non-zero if any device failed. Transport problems come back in the same shape, e.g. `{"error":{"message":"unreachable"}}`.

```sh
bin/shelly-scan | bin/shelly-rpc Sys.GetConfig | jq -c '{name, device: .result.device}'
bin/shelly-scan | jq -c 'select(.name == "Tapparella cucina")' | bin/shelly-rpc Cover.GetStatus '{"id":0}'
```

Look methods and parameters up in the official docs (https://shelly-api-docs.shelly.cloud/gen2/) or context7 (`/websites/shelly-api-docs_shelly_cloud`) rather than relying on memory, because firmware keeps evolving. The house devices are Shelly 2PM Gen3 in the cover profile, so the cover is `cover:0`, addressed by `Cover.*` methods with `"id":0`.

## Before changing anything

Read-only calls (`*.Get*`, `*.List*`) are safe. For anything that changes state:

- Tell the user what will change on which devices, by name, and wait for the go-ahead. They want to approve changes to their home.
- Covers move physical things. Don't send movement commands unless the user asked for that movement.
- Many config writes return `{"restart_required": true}`, which is the same flag behind the Shelly app's "requires the device to be rebooted" notification. Say a reboot will be needed and use the shelly-reboot skill.
- Leave `Shelly.FactoryReset`, `Wifi.SetConfig` for the station network, and cloud or auth changes in `Sys.SetConfig`/`Shelly.SetAuth` alone unless explicitly asked. They can cut you off from the device.

## Authentication

For devices with a password, export `SHELLY_PASSWORD` (the user name is always `admin`; digest auth). `lib/shelly.sh` passes it to curl on stdin so it doesn't show up in `ps`. Never write it into files in the repo.

## Facts learned the hard way

- `GET /shelly` never needs authentication; `/rpc` does on a device with a password.
- `Matter.GetConfig` on 2PM Gen3 firmware 2.0.1 has only `enable` (false on all devices). The device API offers no way to set the Matter node label.
- The public Shelly Cloud Control API (v1 and v2 beta) has no reboot endpoint, no generic RPC endpoint, and doesn't return device names. Use local RPC for those, or the web app (shelly-cloud-web-app skill) for app-side data.
