# Node Core

Node-only mechanisms for developer tools and embedded runtimes. No entry imports
product code, selects executables, reads credentials or terminates the host process.

- `process`: argument arrays always use `shell: false`. Captured streams share an
  injected byte budget even when capture is disabled. Consumers select counted
  streams, callbacks, capture, time limits, process groups and error mapping.
  Callback errors and overflow kill the selected child/group; timeout waits for
  close. Abort rejects promptly and may allow an explicit TERM grace before KILL.
  Close observers always run. POSIX process groups cover descendants after the
  leader exits; Windows teardown is child-only. This is not a Windows Job Object.
- `spawnManagedProcess`, `runManagedCommand`, `stopProcess` support inherited
  output, bounded completion, parent signals and group cleanup. Consumers own
  output destinations, input, deadlines and invocation policy.
- `server-drain`: `installServerDrain` stops scheduling and closes admission once
  on TERM/INT. Accepted requests finish naturally; no force exit or drain deadline
  is imposed. Consumers may dispose signal listeners without shutting down.
- `bin/node-runtime.sh` is sourced before Node exists. Version floors, search
  directories/order and failure copy are injected by the consumer. Only stable
  version triples within explicitly listed major families are accepted.

Pool/Store own local publisher and runtime policies; Podcast Visualizer, Auto
Subtitle and Film own process adapters and packaging. Every migration pins the
full Platform commit and exact package version independently.
