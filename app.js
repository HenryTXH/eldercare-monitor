// BLE UUIDs
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice;
let bleCharacteristic;

// Initialize Leaflet Map centered on USM / default location
let map = L.map('map').setView([5.1521, 100.4950], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker = L.marker([5.1521, 100.4950]).addTo(map)
    .bindPopup('Patient Live Location')
    .openPopup();

document.getElementById('connect-btn').addEventListener('click', async () => {
    try {
        const statusEl = document.getElementById('conn-status');
        statusEl.textContent = "Connecting...";
        
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }]
        });

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        await bleCharacteristic.startNotifications();
        bleCharacteristic.addEventListener('characteristicvaluechanged', handleData);

        statusEl.textContent = "● BLE Connected";
        statusEl.className = "badge connected";
        document.getElementById('connect-btn').textContent = "Connected";
    } catch (error) {
        console.error("BLE Error:", error);
        document.getElementById('conn-status').textContent = "● Disconnected";
        document.getElementById('conn-status').className = "badge disconnected";
    }
});

function handleData(event) {
    const value = new TextDecoder().decode(event.target.value);
    try {
        const data = JSON.parse(value);

        // Update Heart Rate
        if (data.hr !== undefined) {
            document.getElementById('hr-value').textContent = data.hr;
        }

        // Update SpO2
        if (data.spo2 !== undefined) {
            document.getElementById('spo2-value').textContent = data.spo2;
            document.getElementById('spo2-fill').style.width = data.spo2 + '%';
        }

        // Update Accelerometer
        if (data.accel !== undefined) {
            document.getElementById('accel-value').textContent = data.accel.toFixed(2);
        }

        // Update GPS & Map
        if (data.lat !== undefined && data.lng !== undefined) {
            document.getElementById('gps-coords').textContent = `${data.lat.toFixed(4)}°, ${data.lng.toFixed(4)}°`;
            
            // Move map marker & center map
            marker.setLatLng([data.lat, data.lng]);
            map.setView([data.lat, data.lng], map.getZoom());
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    } catch (e) {
        console.error("Failed to parse incoming BLE JSON:", value);
    }
}
