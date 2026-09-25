# Qt support and updates

Small, separately scoped CMake adapters. The consumer pins the Platform gitlink
and `qt/VERSION`; application UI, report schema, storage and deployment stay local.

`DustWaveQtSupport` sends only caller-supplied, already-reviewed bytes on an
explicit `send`. The caller owns freezing, persistence and retry. HTTPS delivery
uses no redirects, cookies, cache or ambient authentication reuse. Request size,
response size, inactivity and total duration are bounded. Only HTTP 200 with an
exact report ID, positive safe integer issue number and created/updated/duplicate
receipt is acknowledged; other results are rejected, unavailable or unconfirmed.
No automatic retry or background upload is performed. Retrying requires the same
reviewed bytes and ID. Concurrent sends are ignored while busy.

`DustWaveQtUpdates` is an Objective-C++ bridge to checksum-pinned Sparkle 2.10.0.
It owns no version comparison, download, installer or signature implementation.
Call `check(true)` for an information-only check or `check(false)` for Sparkle's
user-driven update window. `UpdateDriver` permits consumer policy tests without
network or installation. Only macOS builds may enable this target.

Add this directory with `add_subdirectory`, link the required target and call
`dustwave_embed_sparkle(appTarget)` for the app. Consumers supply the feed, public
key, consent defaults and bundle identity in Info.plist, and sign nested Sparkle
services inside-out before signing the app. Keep Sparkle's license in the bundle.
For transport-only use set `DUSTWAVE_QT_SPARKLE=OFF`.

```sh
cmake -S qt -B qt/build -DCMAKE_PREFIX_PATH=/opt/homebrew/opt/qt
cmake --build qt/build
ctest --test-dir qt/build --output-on-failure
```

The adapter is newly authored MIT code. OwlSwitch product code remains GPLv3 in
its own repository. Sparkle and Qt retain their respective upstream licenses.
