# Telemetry

You can help improve [WebXR](https://immersive-web.github.io/webxr/) by sending usage statistics, performance metrics, and errors to the [Mozilla Mixed Reality](https://vr.mozilla.org/) team.

## Collected data

Because WebXR is an experimental API, we want to ensure that all users receive the most stable and secure experience possible. As such, all information collected by including the WebXR Agent on a WebXR site is by collected with opt-out mechanisms, in compliance with [Mozilla's Data Collection policies](https://www.mozilla.org/en-US/privacy/principles/) and the [European Union's General Data Protection Regulation (EGDPR) directives](https://www.eugdpr.org/).

As a user, you will be prompted whether you consent to telemetry being sent to the Mozilla Mixed Reality team. You can change your mind at a later date from the **Help** settings from the WebXR Agent included on participating WebXR sites. You can also enable ["Do-Not-Track"](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT) in your browser, which will automatically exclude you from all data collection for telemetry purposes.

We do not collect any [Personally Identifiable Information](https://en.wikipedia.org/wiki/Personally_identifiable_information), such as your IP address, nor do we use [HTTP Cookies](https://en.wikipedia.org/wiki/HTTP_cookie) to track you.

When you grant us permission, of course, these are the metrics we collect to better improve WebXR:

- Unique UUID-v4 random identifier (generated according to [IETF RFC4122](http://www.ietf.org/rfc/rfc4122.txt)), persisted in the browser's [`LocalStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage)
- JavaScript error (exception) messages (without file paths)
- Console messages (i.e., error, warning, log, info)
- [Do-Not-Track](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT) HTTP header (i.e., `DNT: 1`)
- Dimensions (width and height) of the browser's `screen` and `window`
- Release version of the [Unity WebVR Assets](https://github.com/mozilla/unity-webvr-export) package being used (e.g., [`v1.0.1`](https://github.com/mozilla/unity-webvr-export/releases/tag/v1.0.1))
- JavaScript Heap memory used (measured in megabytes)
- [WebXR API](https://immersive-web.github.io/webxr/spec/latest/) support (i.e., `navigator.xr`)
- [WebVR v1.1 API](https://immersive-web.github.io/webvr/spec/1.1/) support (i.e., `navigator.getVRDisplays`)
- [WebVR v1.1 events](https://immersive-web.github.io/webvr/spec/1.1/#interface-window) emitted by the browser (i.e., user-initiated actions and headset events) during a unique page load:
    - Number of times and time until VR mode is entered (e.g., user keypress, user click, automatically presented)
    - Number of times and time until VR mode is exiting (e.g., user keypress, user click, automatically exited, browser's Back button, browser's navigation to another page, etc.)
    - Number of times and time until a VR device is worn/mounted
    - Number of times and time until a VR device is taken off/unmounted
    - Number of times and time until a VR device has been connected (or detected on page load)
    - Number of times and time until a VR device has been disconnected/unplugged
    - Number of times and time until a mouse cursor is temporarily disabled for input while "pointerlocked" in VR mode (e.g., for Windows Mixed Reality's desktop flat-pane views)
    - Number of times and time until a mouse cursor is temporarily disabled for input while "pointerlocked" in VR mode (e.g., for Windows Mixed Reality's desktop flat-pane views)
- Amount of time the active page was open for
- Amount of time the active page took to load:
    - Loading screen
    - Splash screen
    - Unity game
- Browser's `User-Agent` string (i.e., `navigator.userAgent`):
    - Engine name
    - Engine version
    - Browser name
    - Browser version
    - Device model
    - Device vendor
    - Operating System name
    - Operating System version
- WebGL support
    - [WebGL 1.0 API](https://www.khronos.org/registry/webgl/specs/latest/1.0/) support
    - [WebGL 2.0 API](https://www.khronos.org/registry/webgl/specs/latest/2.0/) support
    - Shader version (i.e, `gl.SHADING_LANGUAGE_VERSION`)
    - Renderer (i.e, `gl.RENDERER`)
    - Renderer unmasked (i.e, `WEBGL_debug_renderer_info.UNMASKED_RENDERER_WEBGL`)
    - Vendor (i.e, `gl.VENDOR`)
    - Vendor unmasked (i.e, `WEBGL_debug_renderer_info.UNMASKED_VENDOR_WEBGL`)
    - Version (i.e, `gl.VERSION`)
- [Gamepad API](https://w3c.github.io/gamepad/)
    - Support of API (i.e., `navigator.getGamepads`)
    - Names of connected gamepads (i.e., `Gamepad#id`)
- [Web Audio API](Web Audio) support (i.e., `AudioContext`)
- [WebAssembly (WASM) API](http://webassembly.org) support (i.e., `WebAssembly`)
- [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) support (i.e., `Worker`)
