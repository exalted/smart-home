---
name: shelly-scripts
description: Write, install, schedule and test on-device scripts (mJS) for the Shelly devices the house way, as small, generic, composable "one job" scripts in scripts/ that take JSON arguments from their caller (Script.Start + Script.Eval "main(...)") and stop themselves. Covers the conventions, the script catalog (cover-clamp, daily-once), bin/shelly-script-put, bin/shelly-schedule-exec, testing with a near-future schedule and a reboot, and verified engine facts (Schedule.Eval, Script.Eval, KVS, language limits), and what the Shelly app and the device's own web UI show of script jobs (only the web UI shows their arguments). Use whenever an automation needs a condition, a script is written or changed, or a schedule should run a script.
---

# On-device scripts

Scripts live in `scripts/` (one file each, English names and code) and run on the devices. The user's rules (2026-10-02):

- **Generic, not device-specific**: no positions, times, cover ids or script ids in the code. Everything specific comes in as arguments, so the same script serves any device, group or future workflow.
- **One job each, composable** (Unix philosophy): a script either decides *when* (a trigger like `daily-once`) or *what* (an action like `cover-clamp`); bigger workflows are compositions, not bigger scripts.
- **Efficient and fast**: no polling, no idle timers, stopped when not working.

## The exec convention

Every script defines `main(args)` and does nothing else at top level except an idle guard. Callers run it with two RPC calls, which together act like `exec script args`:

```json
[{"method": "Script.Start", "params": {"id": 2}},
 {"method": "Script.Eval",  "params": {"id": 2, "code": "main({\"max\":35})"}}]
```

- **Args are strict JSON** (quoted keys), so tools and `daily-once`'s catch-up can parse them back.
- **The script stops itself** when done (`Script.Stop` on `Shelly.getCurrentScriptId()`), and has `Timer.set(30000, false, stop)` at top level so a start without `main()` doesn't hold one of the device's **3 running-script slots**.
- **It returns what it did as short text**: `Script.Eval`'s `result` is `main`'s return value as a string (`"undefined"` if none), so a caller can collect it like stdout.
- **Boot start only when needed** (`daily-once` needs it for catch-up; actions don't).
- **Name = file name without `.js`**: callers find scripts by name, because ids differ per device.
- **Acts on its own device only.** Guest-to-guest traffic is on only during setup sessions, so a script must never call another device (shelly-automation skill, network constraint).

Why not resident scripts with events (`Shelly.emitEvent`): each would take one of the 3 running slots and RAM all the time, which doesn't scale to many small scripts. Why not arguments in KVS: they can't vary per call without flash writes and races.

## Catalog

| Script | Job | Args | Boot |
|---|---|---|---|
| `cover-clamp` | Keep a cover within `[min, max]`: lower to max if more open, raise to min if more closed; leave it alone while it moves (someone is using it) or when the position is unknown | `{"id": 0, "min": n, "max": n}` (id defaults to 0, each bound optional) | no |
| `daily-once` | Run `then` once a day as soon as every timespec in `after` has fired today; record the day and each call's result in KVS `daily-once.<key>`; at boot, re-run its own schedule jobs (catch-up, safe because each key runs once a day) | `{"key": "...", "after": ["@sunrise", "0 0 7 * * *"], "then": [{"script": "cover-clamp", "args": {...}} or {"method": "...", "params": {...}}]}` | yes |

`daily-once` must be started a minute **after** each `after` time (e.g. jobs `@sunrise+0h1m * * *` and `0 1 7 * * *`), because `Schedule.Eval`'s `prev` excludes the current second. The `after` timespecs themselves are only evaluated, never stored as jobs, so any form the device accepts works there.

## Tools

```sh
# install or update (name from the file); --boot only for scripts that need it
bin/shelly-scan | jq -c 'select(.name == "Tapparella cucina")' > .scratch/dev.jsonl
bin/shelly-script-put scripts/cover-clamp.js < .scratch/dev.jsonl
bin/shelly-script-put --boot scripts/daily-once.js < .scratch/dev.jsonl
# schedule a run with arguments (no duplicate if the same job exists)
bin/shelly-schedule-exec '@sunrise+0h1m * * *' daily-once '{"key":"kitchen-morning","after":["@sunrise","0 0 7 * * *"],"then":[{"script":"cover-clamp","args":{"max":35}}]}' < .scratch/dev.jsonl
# what happened on the last run
bin/shelly-rpc KVS.Get '{"key":"daily-once.kitchen-morning"}' < .scratch/dev.jsonl
# every job's arguments
bin/shelly-rpc Schedule.List < .scratch/dev.jsonl |
  jq -c '.result.jobs[] | {id, enable, timespec, code: [.calls[] | select(.method == "Script.Eval") | .params.code]}'
```

Updating a script's code keeps its id, so existing schedule jobs keep working. Deleting and recreating a script changes its id: recreate its jobs too. Run `node --check FILE` before installing to catch syntax errors (it doesn't know Shelly's limits, below).

## Where an automation's arguments live, and seeing or changing them

Established 2026-10-02 on `kitchen-morning` (its `{"max": 35}`):

- **Only in the schedule jobs.** The scripts hold no values. Each job's `Script.Eval` code carries the whole argument (`main({"key":…,"after":[…],"then":[{"script":"cover-clamp","args":{"max":35}}]})`); `daily-once` hands each `then` item's `args` on unchanged, by its own `Script.Start` + `Script.Eval "main(<args>)"`; and its boot catch-up parses the arguments back out of the same jobs. So the jobs are the single source of truth, and every job of one automation holds an identical copy (`kitchen-morning` has two: sunrise and 07:00).
- **Who can see them:**

  | Where | Arguments visible? |
  |---|---|
  | Shelly app schedule list (web app 3.77.24) | No: "script:&lt;id&gt;", "Script.start", "Script.eval", days, time |
  | Shelly app, job's pencil → "Edit schedule" | No: "Script.Eval ID: 2", its pencil disabled |
  | Device web UI, Schedules → click the job's time | **Yes**, read-only JSON per call (guest network only) |
  | `Schedule.List` over RPC (command above), the backup in `devices/<name>.json` | Yes |

  The iPhone app wasn't checked for this; it has matched the web app so far. Details of each UI in the two sections below.
- **So the household can see that an automation exists and pause it** (each job's toggle, in the app or the web UI), **but can't see or change its values.** Changing one takes a session with local access: the public Cloud Control API has no generic RPC, and neither UI can edit a script call.
- **Changing a value means changing every job that holds the copy**, on every device concerned:
  - `bin/shelly-schedule-exec` doesn't do it. It only creates jobs, and a job with new arguments isn't a duplicate, so it would add one next to the old. Both would then run `daily-once` with the same key, and whichever fires first that day would win.
  - Either send `Schedule.Update {"id", "calls"}` to each job with the new code (that method is in the API docs but untested here), or `Schedule.Delete` each one and recreate it with `bin/shelly-schedule-exec`.
  - Then refresh the backup (shelly-backup skill) and the Automations table in CLAUDE.md.
  - The door-cover rule applies whenever the new value could close a door cover (shelly-automation skill).

## Testing a new script or workflow

Test the trigger and every branch, not just the action (this is how kitchen-morning was tested, 2026-10-02):

1. Run the action alone with Start + Eval and read the returned text.
2. Copy the trigger's args with an `after` time 2–3 minutes ahead and a test key, schedule it a minute after that with `bin/shelly-schedule-exec`, and run it once by hand first: it should do nothing ("not fired yet": no KVS record, no move).
3. Let the job fire with the cover moved past the bound; check the move and the KVS record. Run it again by hand: "already done today", no move.
4. Delete the test key's KVS record and reboot the device (`bin/shelly-reboot`): the catch-up should act within seconds of boot.
5. Delete the test job and the test KVS key, create the real jobs, and if today's run time has passed, write today's record by hand so a reboot later today doesn't act. Then refresh the backup (shelly-backup skill).

Warn the user before each test that moves a cover, and the door-cover rule applies (shelly-automation skill).

## The Shelly app and script jobs

Observed 2026-10-02 in the web app 3.77.24 (the iPhone app showed the same symptom):

- **The device's Schedule page never loads (endless spinner) if any job's timespec doesn't match the app's own parser**: it crashes on that job instead of skipping it. The parser wants six fields (`sec min hour day month weekday`) or `@sunrise`/`@sunset` with an optional `+<h>h<m>m` offset **and** the three trailing fields; months as numbers (`5-9`, not `MAY-SEP`), weekdays as comma lists (`MON,TUE,WED,THU,FRI`, not `MON-FRI`), no `@random`. So `@sunrise+0h1m * * *`, never `@sunrise+1m`. `bin/shelly-schedule-exec` refuses other forms (check: `shelly_app_timespec_ok` in `lib/shelly.sh`, ported from the app's code).
- Script jobs aren't tied to the cover, so the page says "No schedules registered" until "Show schedules for all device channels" is turned on. The app ties a job to the cover (channel 0) when one of its calls has `params.id` 0; script calls carry the script's id, so it files them under "script:<id>". With the toggle on, each shows as "script:<id>", its days, "Script.start", "Script.eval" and the time (e.g. "Sunrise +00:01"). The toggle resets to off every time the page opens. Adding a dummy `Cover.GetStatus {"id": 0}` call would probably list them by default, but the user chose to leave it as it is (2026-10-02): don't add one.
- Each job's toggle only sends `Schedule.Update` with `enable`, so it is a safe way for the user to pause an automation. Don't save from the job's pencil: the app rebuilds the timespec in its own format when saving, and what it does with the script calls is untested.
- **The app never shows a script job's arguments** (checked 2026-10-02): the list shows only "Script.start"/"Script.eval", and the pencil's "Edit schedule" dialog lists the actions as "Script.Start ID: 2" and "Script.Eval ID: 2" with their own pencils disabled. Opening the dialog and leaving with its X → "Exit without saving" sends no request.

## The device's own web UI and script jobs

Observed 2026-10-02 on Tapparella cucina (firmware 2.0.1), from the guest network:

- **This is where a person can read an automation's arguments without tools.** Schedules (`http://<ip>/#/schedules-all`) lists each job by time ("00:01 after sunrise", "07:01:00"); clicking the time opens `#/schedule/<id>`, which shows every call as read-only JSON, including the full `Script.Eval` code (`main({... "args":{"max":35} ...})`).
- Each script call carries a "Call may not work as expected" badge. It's cosmetic: the UI checks calls against its own short list of methods (`switch.set`, `cover.*`, `boolean/text/number.set`, …; read in its code), and `Script.*` isn't on it. The jobs run fine.
- It can't change the arguments: the JSON boxes are read-only, and "+ Add action to execute" offers only Open/Close/Stop/Move Cover to position on Cover (0). To change them, see "Where an automation's arguments live" above.
- Don't press Save on that page. For `* * *` it shows no weekday ticked and asks for one ("At least one of the week days needs to be selected."), so saving would at least rewrite the timespec (its code sends `Schedule.Update` with timespec, calls and enable). Leaving the page without Save sends nothing. Each job's toggle sends only `Schedule.Update {id, enable}` (from its code), like the app's.

## Engine facts (firmware 2.0.1, observed 2026-10-02 on Tapparella cucina)

- `Schedule.Eval {"timespec", "now"}` returns `prev`/`next` Unix times using the device's timezone, DST and location. `prev` **excludes** `now` itself: at exactly 07:00:00 the prev of `0 0 7 * * *` is yesterday's. Sunrise/sunset come at minute resolution (e.g. 07:10:00). The device accepts both `@sunrise+1m` and `@sunrise+0h1m * * *` (same times), but only the second keeps the Shelly app working ("The Shelly app and script jobs", above).
- `Script.Start` on a stopped script returns `{"was_running": false}` after running its top level, so a `Script.Eval` right after it (from RPC or as the next call in one schedule job) finds `main` defined.
- `KVS.Set` accepts objects as values (`{"day": ..., "at": ..., "results": [...]}`), and keys with dots and dashes (`daily-once.kitchen-morning`). A missing key gives error -105.
- A small script has about 25 KB free memory (`Script.GetStatus` `mem_free`).
- Language (official docs): no hoisting (define functions before the code that runs them), no classes, Promises or async; `let`/`var`, exceptions, `JSON`, `Object.keys`, arrays with `push`/`pop`/`slice`/`indexOf`. Strings are byte arrays (`\xHH`, no `\u`). Concatenate numbers through `JSON.stringify(n)` (as the scripts here do; plain `"a" + n` untested).
- Logs: `print()` goes to the device's debug log, which isn't enabled here; prefer return values and KVS records for what a run did.
