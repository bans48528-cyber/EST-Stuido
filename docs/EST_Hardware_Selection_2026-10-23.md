# Hardware selection in EST Studio 2.8.48

## Product support

| Target ID | Product | Current support |
| --- | --- | --- |
| `est` | Existing EST hub | Existing Python blocks, USB HID, firmware maintenance and camera input |
| `spark-ai` | Spark AI | Selectable project target; hardware integration pending |
| `new-ai` | New AI | Selectable project target; hardware integration pending |

Spark AI and New AI are separate new products, not aliases for EST. Their port
counts, screen specifications, execution languages and wire protocols have not
been supplied. They therefore expose only shared native operators, variables
and procedures. They do not generate EST Python or send EST commands. Their
product cards use a neutral device symbol until product artwork is supplied.

## Project behavior

The toolbar selector changes the project's hardware target. A switch saves the
old project as an SB3 draft in the application's `hardware-drafts` directory,
then restores the selected target's last draft or creates a fresh project.
Drafts include the project title and assets. Each target retains one latest
draft. Ordinary project files are not overwritten by switching hardware.

Saved project JSON contains:

```json
{
  "meta": {
    "estStudio": {
      "version": 1,
      "hardwareId": "spark-ai"
    }
  }
}
```

Opening a saved file restores its target before loading its workspace. Old EST
files without this metadata default to EST. Unknown hardware IDs, foreign board
declarations, newer metadata versions and incompatible extensions are rejected
before the workspace is cleared. Existing EST block IDs remain unchanged.

Switching targets creates or restores a separate project; it does not convert
EST motor, display or sensor blocks into another product's instructions.

## Connection lifecycle

`HardwareSession` guards the existing EST adapter. Downloads and firmware updates
block target changes. Running programs require confirmation followed by a
successful STOP before switching. Failed STOP leaves the selected target
unchanged. Background discovery/status work is drained before disconnection;
new requests are refused while switching.

A completed switch closes camera recognition, stops the simulator, clears the
old vision source and disconnects EST. Pending products cannot scan, connect,
download, execute, update vision or flash firmware using EST's protocol. The
current application still owns one active hardware session.

## Main implementation points

- `src/common/hardware-profiles.js`: shared product registry and project schema.
- `src/renderer/hardware/HardwareMenu.jsx`: product selection and localized status.
- `src/renderer/hardware/project.js`: project loading and draft switching.
- `src/main/hardware/session.js`: active target and connection lifecycle.
- `src/main/hardware/drafts.js`: bounded draft storage and replacement by rename.
- Existing build-time loaders connect these components without editing installed
  OpenBlock dependencies. The normal native extension activation flow is retained.

To integrate Spark AI or New AI, supply the supported functions/blocks, port
definitions, code or instruction execution model, identification/handshake,
message formats, timeouts, status reporting and firmware upgrade procedure.
Each product then receives its own compiler and communication adapter.

## Validation

The automated suite covers legacy migration, separate drafts and titles, file
round trips, unknown-target rejection, busy operations, STOP confirmation/failure,
late background requests and existing EST functionality. The compiled Electron
UI test covers all three choices, shared-only palettes, saved-file restoration,
old EST project restoration and window widths of 1280, 1000 and 800 pixels.

New-product physical communication cannot be validated until their specifications
and adapters are available. This change does not produce an installer or publish
Git changes.
