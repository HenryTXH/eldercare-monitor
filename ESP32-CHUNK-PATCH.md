# ESP32 patch: safe notification chunks for ElderCare JSON

The current sketch calls `setValue(jsonString.c_str())` and then `notify()` once. The JSON is larger than a default BLE notification payload. Replace that one-notification send with the chunk framing below. The app reassembles all chunks using the message ID and sequence/count fields before parsing JSON.

## 1. Add the standard include

```cpp
#include <string>
```

## 2. Add this helper after the global `pCharacteristic` declaration

```cpp
// A BLE notification has 20 bytes of characteristic data at the default MTU 23.
// Header is 10 ASCII bytes: '@' + 4 hex message-id + 2 hex sequence +
// 2 hex total-chunks + ':'. The remaining 10 bytes carry JSON UTF-8 bytes.
void notifyJsonChunked(const String& json) {
  static uint16_t nextMessageId = 0;
  const size_t chunkDataSize = 10;
  const size_t jsonLength = json.length(); // Arduino String length is in bytes
  const size_t total = (jsonLength + chunkDataSize - 1) / chunkDataSize;
  if (total == 0 || total > 255) return;

  const uint16_t messageId = ++nextMessageId;
  const uint8_t* source = reinterpret_cast<const uint8_t*>(json.c_str());

  for (size_t seq = 0; seq < total && deviceConnected; ++seq) {
    char header[11];
    snprintf(header, sizeof(header), "@%04X%02X%02X:",
             messageId, static_cast<unsigned>(seq), static_cast<unsigned>(total));
    const size_t offset = seq * chunkDataSize;
    const size_t count = min(chunkDataSize, jsonLength - offset);
    std::string packet(header, 10);
    packet.append(reinterpret_cast<const char*>(source + offset), count);
    pCharacteristic->setValue(
        reinterpret_cast<uint8_t*>(const_cast<char*>(packet.data())), packet.size());
    pCharacteristic->notify();
    delay(10); // allow the BLE stack to queue each notification
  }
}
```

## 3. Replace the old send lines

Replace:

```cpp
pCharacteristic->setValue(jsonString.c_str());
pCharacteristic->notify();
```

with:

```cpp
notifyJsonChunked(jsonString);
```

Keep the surrounding `if (deviceConnected)` check. The app is expecting 10 bytes of ASCII framing followed by up to 10 bytes of JSON data in each notification. Do not change the header format or chunk size without changing the app decoder too.

After uploading the modified sketch, check that the app status says “Live data received” and that every field updates. If notifications stop mid-message, check the ESP32 serial output and test at close range. The app discards incomplete frames after five seconds and does not parse them as patient data.
