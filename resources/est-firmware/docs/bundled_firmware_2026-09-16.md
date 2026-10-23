# EST Studio 2.8.45 bundled firmware

- EST OS: M1.28H, protocol 1.31.
- Status: candidate; hardware verification is pending according to the firmware release notes dated 2026-09-16. M1.28G has prior hardware confirmation.
- Source: EST firmware repository, `firmware/minimal_upgrade_app/build/m128h_lcd_region_refresh`.
- Bundled package: `firmware/minimal_upgrade_app/build/m128h_lcd_region_refresh/est_minimal_upgrade_app.upgrade.bin`.
- Package size: 327680 bytes.
- SHA-256: `5d5a32f4422b75f35f612231778215f49e0e0df0e071a6d959588cc3e63f6d1b`.
- Change: partial LCD refresh during animations; protocol and capability bits are unchanged from M1.28G.
- Firmware source notes report 406 firmware tests, 147 HID tool tests, and ARM GCC compilation passing. These are source-reported results, not new hardware tests performed while packaging Studio.
- The existing official legacy downgrade package 03.02A and 127 bundled MP3 assets are retained.

Bundling does not flash a connected device. Firmware installation requires the user's explicit action in EST Studio.
