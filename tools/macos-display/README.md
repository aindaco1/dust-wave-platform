# macOS display fixture 0.1.0

Test-only Python and Objective-C++ tooling extracted from OwlSwitch revision
`ea3c04805c6049de3e8a7aeabaa794540ebb8ee4`, `tests/native_display/`.
This directory is **GPL-3.0**, preserving OwlSwitch's license (see LICENSE).
It is not part of Platform's MIT runtime packages or native speech library.
Never bundle these helpers with a consumer application.

`NativeTools(build, window=False, screen_probe=None)` compiles bounded helper
processes into a temporary build directory. `display(width, height, scale, origin)`
is a context manager that creates one virtual display and verifies exact topology
restoration. Unsupported private CoreGraphics APIs and missing desktop/permission
prerequisites fail explicitly. A display expires after ten minutes even if its
driver crashes. `serial_desktop()` retains OwlSwitch's existing lock filename so
older suites cannot race a migrated consumer.

The default enumerator uses public AppKit/CoreGraphics APIs. Qt consumers inject
their own `screen_probe()` returning name/x/y/width/height/scale dictionaries.
Consumers own their app launch, settings isolation, assertions and evidence.
`WindowProbe` inspects only supplied PIDs. No screenshot is taken or saved.
Its activation/key commands are explicit test actions, never implicit in reads.

Run Python characterization tests with:

```sh
python3 -m unittest discover -s tools/macos-display -p 'test_*.py'
```

Run each consumer's real-app suite serially on an idle macOS desktop as well.
A fixture smoke is not a consumer display pass. Physical cables, HDR/EDR, firmware
and real sleep/wake remain separate hardware acceptance work.
