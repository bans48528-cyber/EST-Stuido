# Hardware status auto-refresh (2.8.46-2.8.47)

## Cause

The HID transport wrapped synchronous `readTimeout` in `Promise.resolve`.
The wait still blocked Electron's main event loop. Repeated status checks also
enumerated USB devices even when an established connection was available.
The hardware panel only scheduled refreshes while a program was running, and
that path normally returned cached port values.

## Implementation

- Use node-hid's asynchronous callback read. Maintain at most one native read,
  including across logical timeouts. Retain one late report for the next read;
  reject the pending waiter on close and ignore subsequent callbacks.
- Refresh while the hardware panel is open and the document is visible.
  Schedule the next request 250 ms after completion (reduced from 750 ms in
  2.8.47), not on a fixed interval.
  Back off to 3 seconds after errors. Manual refresh remains available.
- Share an in-flight hardware status request. Skip polling when command work,
  transfers or firmware maintenance are busy. Do not queue missed refreshes.
- Reuse the active connection; hardware monitoring does not enumerate devices.
  Existing disconnected-device discovery remains in the connection manager.
- Protocol 1.31 devices can supply live port snapshots during program execution.
  Older firmware retains its existing cached-port running behavior and notice.
  Monitor requests use bounded timeouts; an already active request still has
  to finish before the next serialized command can execute.
- Compare visible status values before updating React state. Changes only to
  uptime or program timing do not redraw the panel. Reject replies belonging
  to a closed panel or an earlier connection generation.

## Verification

- `npm run test:est`: passed, including transport and panel regression tests.
- `npm run compile`: passed.
- `node scripts/check-est-locale-electron.js`: passed with an isolated profile
  and fake hardware. The compiled panel polled repeatedly, allowed workspace
  block movement, never overlapped requests, and stopped polling after close.
- Transport simulation: event-loop ticks continued throughout 120 ms of HID
  waiting. Tests cover timeout reuse, late replies, close, deduplicated panel
  updates, hidden state and firmware maintenance suspension.

These are automated simulated-device checks, not measured real-device FPS or
latency. Verify idle and running sensor changes on an actual EST, editor drag
responsiveness, disconnect/reconnect, and download/stop coexistence before
release. Native write/open/enumeration calls were not converted to async calls.
No firmware was changed or flashed; no installer was produced for this change.
