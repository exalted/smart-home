// daily-once: runs a list of calls once a day, as soon as every timespec in
// "after" has fired today (since local midnight, by the device's own
// timezone, DST and sunrise/sunset). Each key's last run, with what each
// call returned, is kept in KVS as "daily-once.<key>", so it survives
// reboots and shows what happened.
//
// Run it with Script.Start, then Script.Eval with main(<strict JSON args>);
// it stops itself once idle. Schedule those two calls a minute after each
// "after" time: Schedule.Eval's "prev" excludes the current second, so on
// the second itself that time doesn't count as fired yet.
//   main({"key": "kitchen-morning", "after": ["@sunrise", "0 0 7 * * *"],
//         "then": [{"script": "cover-clamp", "args": {"max": 35}}]})
// "then" items are RPC calls ({"method", "params"}) or runs of another
// script written this way ({"script", "args"}).
//
// Catch-up: started at boot, it runs main() of each of its enabled schedule
// jobs once the clock is set, so a run missed while the device was off
// happens when it comes back. That's harmless because each key runs once a
// day, and it's why the args must be strict JSON: they're parsed back from
// the jobs.

let queue = [];
let busy = false;
let catchingUp = false;

function stopIfIdle() {
  if (!busy && !catchingUp && queue.length === 0) {
    Shelly.call("Script.Stop", { id: Shelly.getCurrentScriptId() });
  }
}

function prevFire(timespec, now, cb) {
  Shelly.call("Schedule.Eval", { timespec: timespec, now: now }, function (res, err) {
    cb(err === 0 && res && res.prev ? res.prev : null);
  });
}

function runScript(name, args, cb) {
  Shelly.call("Script.List", {}, function (res) {
    let id = null;
    for (let i = 0; i < res.scripts.length; i++) {
      if (res.scripts[i].name === name) id = res.scripts[i].id;
    }
    if (id === null) {
      cb("no script " + name);
      return;
    }
    Shelly.call("Script.Start", { id: id }, function () {
      let code = "main(" + JSON.stringify(args === undefined ? {} : args) + ")";
      Shelly.call("Script.Eval", { id: id, code: code }, function (r, err, msg) {
        cb(err === 0 ? name + ": " + r.result : name + ": " + msg);
      });
    });
  });
}

function callAll(calls, i, results, done) {
  if (i >= calls.length) {
    done();
    return;
  }
  let collect = function (result) {
    results.push(result);
    callAll(calls, i + 1, results, done);
  };
  let c = calls[i];
  if (c.script !== undefined) {
    runScript(c.script, c.args, collect);
    return;
  }
  Shelly.call(c.method, c.params === undefined ? {} : c.params, function (res, err, msg) {
    collect(c.method + ": " + (err === 0 ? "ok" : msg));
  });
}

function runIfDue(args, i, now, today, done) {
  if (i < args.after.length) {
    prevFire(args.after[i], now, function (prev) {
      if (prev === null || prev < today) {
        done(args.after[i] + " has not fired yet today");
        return;
      }
      runIfDue(args, i + 1, now, today, done);
    });
    return;
  }
  let kvsKey = "daily-once." + args.key;
  Shelly.call("KVS.Get", { key: kvsKey }, function (res) {
    if (res && res.value && res.value.day === today) {
      done("already done today");
      return;
    }
    let results = [];
    callAll(args.then, 0, results, function () {
      let record = { day: today, at: now, results: results };
      Shelly.call("KVS.Set", { key: kvsKey, value: record }, function (r, err, msg) {
        done(err === 0 ? JSON.stringify(results) : JSON.stringify(results) + ", not recorded: " + msg);
      });
    });
  });
}

function next() {
  if (busy) return;
  if (queue.length === 0) {
    stopIfIdle();
    return;
  }
  busy = true;
  let args = queue[0];
  queue = queue.slice(1);
  let done = function (msg) {
    print("daily-once " + args.key + ": " + msg);
    busy = false;
    next();
  };
  let now = Shelly.getComponentStatus("sys").unixtime;
  if (!now) {
    done("clock not set");
    return;
  }
  // The last local midnight is also the day's identity in the KVS record.
  prevFire("0 0 0 * * *", now, function (today) {
    if (today === null) {
      done("Schedule.Eval failed");
      return;
    }
    runIfDue(args, 0, now, today, done);
  });
}

function main(args) {
  queue.push(args);
  next();
}

function catchUp() {
  if (!Shelly.getComponentStatus("sys").unixtime) {
    Timer.set(10000, false, catchUp);
    return;
  }
  Shelly.call("Schedule.List", {}, function (res, err) {
    let self = Shelly.getCurrentScriptId();
    let seen = {};
    let jobs = err === 0 ? res.jobs : [];
    for (let j = 0; j < jobs.length; j++) {
      for (let k = 0; k < jobs[j].calls.length; k++) {
        let c = jobs[j].calls[k];
        if (jobs[j].enable && c.method === "Script.Eval" && c.params.id === self && !seen[c.params.code]) {
          seen[c.params.code] = true;
          queue.push(JSON.parse(c.params.code.slice(5, c.params.code.length - 1)));
        }
      }
    }
    catchingUp = false;
    next();
  });
}

if (Shelly.getComponentStatus("sys").uptime < 120) {
  catchingUp = true;
  catchUp();
}
// Started but never given main(): don't hold one of the three script slots.
Timer.set(30000, false, stopIfIdle);
