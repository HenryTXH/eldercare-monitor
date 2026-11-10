const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice;
let bleCharacteristic;
let deferredPrompt;

// PWA Install Prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-btn').classList.remove('hidden');
});

const triggerInstall = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-btn').classList.add('hidden');
        }
        deferredPrompt = null;
    } else {
        alert("To install, tap Chrome's top-right three dots and select 'Add to Home screen' or 'Install app'.");
    }
};

document.getElementById('install-btn').addEventListener('click', triggerInstall);
document.getElementById('install-menu-btn').addEventListener('click', (e) => {
    e.preventDefault();
    dropdownMenu.classList.add('hidden');
    triggerInstall();
});

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error', err));
    });
}

// Menu Toggle
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('hidden');
});

window.addEventListener('click', () => {
    if (!dropdownMenu.classList.contains('hidden')) {
        dropdownMenu.classList.add('hidden');
    }
});

document.getElementById('menu-settings').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Settings: Configure alert thresholds and BLE parameters.');
});

document.getElementById('menu-history').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Telemetry History: Live logging view active.');
});

document.getElementById('menu-about').addEventListener('click', (e) => {
    e.preventDefault();
    alert('ElderCare BLE Monitor v1.2 - Connected to ESP32 Gateway');
});

// Map Initialization
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
        
        const patientCardHeader = document.querySelector('.status-card h2');
        if (patientCardHeader) patientCardHeader.textContent = "Active Patient Monitoring";

    } catch (error) {
        console.error("BLE Error:", error);
        const statusEl = document.getElementById('conn-status');
        statusEl.textContent = "● Disconnected";
        statusEl.className = "badge disconnected";
    }
});

function handleData(event) {
    const value = new TextDecoder().decode(event.target.value);
    console.log("Raw BLE Data:", value);
    try {
        const data = JSON.parse(value);

        // Heart Rate (Supports hr, heartRate, bpm, heart_rate, pulse)
        const heartRate = data.hr !== undefined ? data.hr : 
                          (data.heartRate !== undefined ? data.heartRate : 
                          (data.bpm !== undefined ? data.bpm : 
                          (data.heart_rate !== undefined ? data.heart_rate : data.pulse)));
        
        if (heartRate !== undefined) {
            document.getElementById('hr-value').textContent = heartRate;
            document.getElementById('hr-status').textContent = "Live reading";
        }

        // SpO2 Level
        const oxygen = data.spo2 !== undefined ? data.spo2 : (data.oxygen !== undefined ? data.oxygen : data.spO2);
        if (oxygen !== undefined) {
            document.getElementById('spo2-value').textContent = oxygen;
            document.getElementById('spo2-fill').style.width = oxygen + '%';
        }

        // Accelerometer
        const accelVal = data.accel !== undefined ? data.accel : (data.acceleration !== undefined ? data.acceleration : data.acc);
        if (accelVal !== undefined) {
            const numericAccel = typeof accelVal === 'object' ? Math.sqrt((accelVal.x||0)**2 + (accelVal.y||0)**2 + (accelVal.z||0)**2) : accelVal;
            document.getElementById('accel-value').textContent = Number(numericAccel).toFixed(2);
        }

        // Fall Detection
        const fallState = data.fall !== undefined ? data.fall : (data.fallDetected !== undefined ? data.fallDetected : data.fall_detected);
        if (fallState !== undefined) {
            const fallBadge = document.getElementById('fall-badge');
            const fallText = document.getElementById('fall-text');
            if (fallState) {
                fallBadge.textContent = "● FALL DETECTED";
                fallBadge.className = "badge disconnected";
                fallText.textContent = "Emergency alert triggered!";
            } else {
                fallBadge.textContent = "● NO (✓)";
                fallBadge.className = "badge connected";
                fallText.textContent = "No emergency reported";
            }
        }

        // GPS Coordinates
        const latitude = data.lat !== undefined ? data.lat : (data.latitude !== undefined ? data.latitude : data.GPS_lat);
        const longitude = data.lng !== undefined ? data.lng : (data.lon !== undefined ? data.lon : (data.longitude !== undefined ? data.longitude : data.GPS_lng));
        
        if (latitude !== undefined && longitude !== undefined) {
            document.getElementById('gps-coords').textContent = `${Number(latitude).toFixed(4)}°, ${Number(longitude).toFixed(4)}°`;
            document.getElementById('gps-address').textContent = data.address || "GPS Lock Acquired";
            
            marker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude], map.getZoom());
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    } catch (e) {
        console.error("Failed to parse incoming BLE JSON:", value);
    }
                                                              }
