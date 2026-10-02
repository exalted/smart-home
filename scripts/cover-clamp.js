// cover-clamp: keeps a cover's position between "min" and "max" (100 = open,
// 0 = closed): lowers it to max if it is more open, raises it to min if it
// is more closed. Leaves it alone while it moves, since then someone is
// using it, and when its position is unknown (not calibrated).
//
// A bound is a number, or the key of a number component on this device
// ("number:200"), read at run time: then the value lives in that component
// alone, and changing it doesn't touch the schedule jobs that call this.
//
// Run it with Script.Start, then Script.Eval with main(<JSON args>). It
// returns what it did as text and stops itself.
//   main({"max": 35})                     cover 0, never more open than 35
//   main({"max": "number:200"})           ... than number:200's value
//   main({"id": 0, "min": 20, "max": 80})

function stop() {
  Shelly.call("Script.Stop", { id: Shelly.getCurrentScriptId() });
}

function bound(v) {
  if (typeof v !== "string") return v;
  let c = Shelly.getComponentStatus(v);
  return c ? c.value : null;
}

function main(args) {
  let id = args.id === undefined ? 0 : args.id;
  let cover = Shelly.getComponentStatus("cover:" + JSON.stringify(id));
  if (!cover) {
    stop();
    return "no cover " + JSON.stringify(id);
  }
  let min = bound(args.min);
  let max = bound(args.max);
  if (min === null || max === null) {
    stop();
    return "no component " + JSON.stringify(min === null ? args.min : args.max);
  }
  if (cover.state === "opening" || cover.state === "closing") {
    stop();
    return cover.state + ", left alone";
  }
  let pos = cover.current_pos;
  if (pos === null || pos === undefined) {
    stop();
    return "position unknown";
  }
  let target = null;
  if (max !== undefined && pos > max) target = max;
  if (min !== undefined && pos < min) target = min;
  if (target === null) {
    stop();
    return "at " + JSON.stringify(pos) + ", left alone";
  }
  Shelly.call("Cover.GoToPosition", { id: id, pos: target }, function (res, err, msg) {
    if (err !== 0) print("cover-clamp: Cover.GoToPosition failed: " + msg);
    stop();
  });
  return "from " + JSON.stringify(pos) + " to " + JSON.stringify(target);
}

// Started but never given main(): don't hold one of the three script slots.
Timer.set(30000, false, stop);
