// Stops admission and scheduling without terminating accepted work or the process.
export function installServerDrain({ server, stopScheduling = () => {}, signalSource = process,
  signals = ["SIGTERM", "SIGINT"] }) {
  let draining = false;
  function dispose() {
    for (const signal of signals) signalSource.removeListener(signal, shutdown);
  }
  function shutdown() {
    if (draining) return;
    draining = true;
    stopScheduling();
    server.close();
  }
  for (const signal of signals) signalSource.once(signal, shutdown);
  server.once("close", dispose);
  return Object.freeze({ shutdown, dispose });
}
