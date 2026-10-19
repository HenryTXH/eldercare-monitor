# Install ElderCare on Android

This folder is an installable Progressive Web App (PWA), not an APK. It uses Android Chrome's Web Bluetooth API to connect to the ESP32's BLE GATT service and subscribe to notifications. Web Bluetooth requires a secure context (HTTPS, or localhost); opening `index.html` directly from Files will not permit Bluetooth access.

## Before using it with the ESP32

The sketch currently sends the full JSON string as one notification. At the default BLE MTU, a notification normally carries only about 20 bytes of characteristic data, so the JSON can be truncated. This app supports a small framed notification protocol. Apply the patch in `ESP32-CHUNK-PATCH.md` to the sketch and upload it to the ESP32. Each BLE notification then stays within 20 bytes and the app reassembles all pieces before JSON parsing.

The app also accepts complete raw-JSON notifications as a fallback, but reliable operation with the supplied long JSON requires the firmware patch.

## Serve over HTTPS and install

1. Upload the contents of this folder to a static HTTPS host you control (for example, a GitHub Pages site). Keep all files together in the published root.
2. On an Android phone, open the HTTPS page in Chrome, turn on Bluetooth, and tap **Scan & connect**. Select `ElderCare_ESP32` and allow the connection.
3. In Chrome's menu, choose **Install app** or **Add to Home screen**. Launch ElderCare from its new home-screen icon.
4. The app reconnects only when you tap Scan & connect; the browser requires a user gesture to show its BLE device chooser.

## Run locally for development

A desktop Chromium browser may run the app from `http://localhost` (secure-context exception) for UI work. For BLE testing on the phone, use HTTPS hosting. A local server on the developer computer accessed via its LAN IP is not considered a secure origin by mobile Chrome.

## What the app does

- Requests only a device named `ElderCare_ESP32`, then connects to the Nordic UART service and TX characteristic UUIDs from your sketch.
- Subscribes to GATT notifications and decodes JSON after reassembly.
- Displays patient name, age, address, phone, heart rate, SpO₂, coordinates, and YES/NO fall/emergency state.
- Marks YES red with a cross and NO green with a tick.
- Keeps the last ten heart-rate readings in a live line chart and caches the app shell for offline opening.

## Limits

- Web Bluetooth is supported in Android Chrome but is not available in every browser/platform; use current Chrome on Android.
- This is a local monitoring interface. It does not place emergency calls, run continuously in the background, or replace a validated clinical alert system.
- Your sketch still u`ses fixed HR/SpO₂ placeholder values and fallback coordinates unless the sensor-reading logic is completed.

Checking Pages deployment.

