import { spawn } from "node:child_process";

export function spawnArgumentVector(command, args, options = {}) {
  if (!Array.isArray(args) || args.some(argument => typeof argument !== "string")) {
    throw new TypeError("process arguments must be an array of strings");
  }
  return spawn(command, args, { ...options, shell: false });
}

const exited = child => child.exitCode !== null || child.signalCode !== null;

export function signalProcess(child, signal, { processGroup = false } = {}) {
  if (!child?.pid) return;
  if (processGroup && process.platform !== "win32") {
    try { process.kill(-child.pid, signal); return; }
    catch (error) { if (error?.code === "ESRCH") return; }
  }
  if (!exited(child)) child.kill(signal);
}

function groupExists(child) {
  if (!child?.pid || process.platform === "win32") return false;
  try { process.kill(-child.pid, 0); return true; }
  catch (error) { return error?.code !== "ESRCH"; }
}

async function waitForExit(child, timeoutMs) {
  if (!child?.pid || exited(child)) return;
  await new Promise(resolve => {
    const finish = () => { clearTimeout(timer); child.removeListener("exit", finish); resolve(); };
    const timer = setTimeout(finish, timeoutMs);
    child.once("exit", finish);
  });
}

export async function stopProcess(child, { processGroup = false, graceMs = 3000, killWaitMs = 1000 } = {}) {
  if (!child) return;
  signalProcess(child, "SIGTERM", { processGroup });
  const deadline = Date.now() + graceMs;
  await waitForExit(child, graceMs);
  // A leader may exit before descendants. Give that group the remaining grace,
  // then kill it even though the leader's exit event has already fired.
  if (processGroup && groupExists(child)) {
    while (groupExists(child) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
    }
  }
  signalProcess(child, "SIGKILL", { processGroup });
  await waitForExit(child, killWaitMs);
  child.stdout?.destroy();
  child.stderr?.destroy();
}

// Bounded capture and completion; no executable, environment or error-copy policy.
// Callbacks receive bytes, and may decline capture while still consuming budget.
export function runCapturedProcess(command, args, { cwd, env, processGroup = false,
  timeoutMs = 0, maximumOutputBytes = Infinity, signal, abortGraceMs = 0,
  streams = [{ name: "stdout" }, { name: "stderr" }],
  onSpawn = () => {}, onClose = () => {}, errors = {} } = {}) {
  const errorFor = (kind, detail) => errors[kind]?.(detail) ?? Object.assign(new Error(`Process ${kind}`), { kind, ...detail });
  if (signal?.aborted) return Promise.reject(errorFor("abort", { reason: signal.reason }));
  return new Promise((resolve, reject) => {
    const grouped = processGroup && process.platform !== "win32";
    const child = spawnArgumentVector(command, args, { cwd, env, detached: grouped,
      stdio: ["ignore", ...streams.map(() => "pipe")] });
    const buffers = streams.map(() => []);
    let bytes = 0, settled = false, timedOut = false, timer, abortTimer;
    const kill = () => signalProcess(child, "SIGKILL", { processGroup: grouped });
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(result);
    }
    function abort() {
      if (settled) return;
      signalProcess(child, abortGraceMs ? "SIGTERM" : "SIGKILL", { processGroup: grouped });
      if (abortGraceMs) {
        // Retain group identity even if onClose removes the leader from a registry.
        abortTimer = setTimeout(kill, abortGraceMs);
        abortTimer.unref();
      }
      finish(errorFor("abort", { reason: signal.reason }));
    }
    streams.forEach((stream, index) => child.stdio[index + 1].on("data", chunk => {
      if (settled) return;
      if (stream.budget !== false) bytes += chunk.length;
      if (bytes > maximumOutputBytes) { kill(); finish(errorFor("limit", {})); return; }
      try { stream.onData?.(chunk); }
      catch (error) { kill(); finish(error); return; }
      if (stream.capture !== false) buffers[index].push(chunk);
    }));
    child.on("error", error => { kill(); finish(errorFor("spawn", { error })); });
    child.once("close", (code, childSignal) => {
      // Do not clear an abort escalation while descendants still own the group.
      if (!grouped || !groupExists(child)) clearTimeout(abortTimer);
      onClose(child);
      if (settled) return;
      const result = { code, signal: childSignal };
      streams.forEach((stream, index) => { result[stream.name] = Buffer.concat(buffers[index]).toString("utf8"); });
      if (timedOut) finish(errorFor("timeout", result));
      else if (code !== 0) finish(errorFor("exit", result));
      else finish(null, result);
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (timeoutMs > 0) timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    timer?.unref();
    try { onSpawn(child); } catch (error) { kill(); finish(error); }
    if (signal?.aborted) abort();
  });
}

export function spawnManagedProcess(command, args, options = {}) {
  return spawnArgumentVector(command, args, { ...options, detached: process.platform !== "win32" });
}

export async function runManagedCommand(command, args, { input, timeoutMs = 10 * 60_000, ...options } = {}) {
  const child = spawnManagedProcess(command, args, {
    ...options, stdio: [input === undefined ? "ignore" : "pipe", "inherit", "inherit"]
  });
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.removeListener("error", onError);
        child.removeListener("exit", onExit);
        process.removeListener("SIGINT", onInterrupt);
        process.removeListener("SIGTERM", onTerminate);
        if (error) reject(error); else resolve();
      };
      const onError = error => finish(error);
      const onExit = (code, signal) => finish(code === 0 ? null : new Error(`${command} exited with ${signal ?? code}`));
      const onInterrupt = () => finish(new Error(`${command} interrupted by SIGINT`));
      const onTerminate = () => finish(new Error(`${command} interrupted by SIGTERM`));
      const timer = setTimeout(() => finish(new Error(`${command} timed out after ${timeoutMs}ms`)), timeoutMs);
      child.once("error", onError);
      child.once("exit", onExit);
      process.once("SIGINT", onInterrupt);
      process.once("SIGTERM", onTerminate);
      if (input !== undefined) { child.stdin.on("error", onError); child.stdin.end(input); }
    });
  } finally { await stopProcess(child, { processGroup: true }); }
}
