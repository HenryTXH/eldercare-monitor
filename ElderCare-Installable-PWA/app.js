(() => {
  'use strict';
  const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
  const els = Object.fromEntries(['connect','disconnect','connection','message','name','ageAddress','phone','hr','hrNote','spo2','spo2Bar','fall','fallNote','lat','lon','gpsAddress','updated','history'].map(id => [id, document.getElementById(id)]));
  let device = null, characteristic = null, history = [], lastFrame = null, chunks = new Map(), frameTimer = null;
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  function status(text, connected=false) { els.connection.textContent = connected ? '● BLE Connected' : '● Disconnected'; els.connection.className = `badge ${connected?'connected':'disconnected'}`; els.message.textContent=text; els.connect.disabled=connected; els.disconnect.disabled=!connected; }
  function joinBytes(parts) { const size=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(size); let offset=0; for(const p of parts){out.set(p,offset);offset+=p.length;} return out; }
  function onNotification(event) {
    const bytes = new Uint8Array(event.target.value.buffer,event.target.value.byteOffset,event.target.value.byteLength);
    const packet = bytes.slice();
    const head = decoder.decode(packet.slice(0,10));
    const match = /^@([0-9A-Fa-f]{4})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2}):$/.exec(head);
    if (match && packet.length >= 10) {
      const id=match[1].toUpperCase(), seq=parseInt(match[2],16), total=parseInt(match[3],16);
      if (!total || seq>=total) return;
      if (!chunks.has(id)) chunks.set(id,{total,parts:new Array(total),received:0});
      const frame=chunks.get(id); if(frame.total!==total){chunks.delete(id);return;}
      if(!frame.parts[seq]){frame.parts[seq]=packet.slice(10);frame.received++;}
      clearTimeout(frameTimer); frameTimer=setTimeout(()=>chunks.delete(id),5000);
      if(frame.received===frame.total){chunks.delete(id);clearTimeout(frameTimer);handleJson(decoder.decode(joinBytes(frame.parts)));}
      return;
    }
    // Compatibility fallback for legacy raw JSON. Prefer the framed firmware protocol below.
    const raw=decoder.decode(packet).replace(/\0+$/,'').trim();
    lastFrame=(lastFrame||'')+raw;
    try { JSON.parse(lastFrame); const complete=lastFrame;lastFrame=null;handleJson(complete); }
    catch { if(lastFrame.length>4096||(!lastFrame.includes('{')&&raw.length>0)) lastFrame=null; }
  }
  function value(data,key) { if(!(key in data)) throw new Error(`Missing JSON key: ${key}`); return data[key]; }
  function handleJson(raw) {
    let d; try { d=JSON.parse(raw); } catch(e) { els.message.textContent='Received incomplete/invalid JSON. Apply the ESP32 chunk patch.'; return; }
    try {
      const name=String(value(d,'name')), age=value(d,'age'), adr=String(value(d,'adr')), phone=String(value(d,'phoe'));
      const hr=Number(value(d,'hr')), spo2=Number(value(d,'spo2')), lat=Number(value(d,'lat')), lon=Number(value(d,'lon')), fall=String(value(d,'fall')).toUpperCase();
      if (![hr,spo2,lat,lon].every(Number.isFinite)) throw new Error('One or more sensor fields are not numbers');
      els.name.textContent=name; els.ageAddress.textContent=`Age: ${age} | ${adr}`; els.phone.textContent=`Tel: ${phone}`;
      els.hr.textContent=String(Math.round(hr)); els.hrNote.textContent='Live reading'; els.spo2.textContent=String(Math.round(spo2)); els.spo2Bar.style.width=`${Math.max(0,Math.min(100,spo2))}%`;
      els.lat.textContent=`${Math.abs(lat).toFixed(4)}° ${lat>=0?'N':'S'}`; els.lon.textContent=`${Math.abs(lon).toFixed(4)}° ${lon>=0?'E':'W'}`; els.gpsAddress.textContent=adr;
      if(fall==='YES'){els.fall.textContent='● YES (❌)';els.fall.className='fall alert';els.fallNote.textContent='Emergency status active';}
      else if(fall==='NO'){els.fall.textContent='● NO (✔)';els.fall.className='fall safe';els.fallNote.textContent='No emergency reported';}
      else {els.fall.textContent='● UNKNOWN';els.fall.className='fall unknown';els.fallNote.textContent='Unrecognized fall value';}
      history.push(hr); if(history.length>10) history.shift(); drawChart(); els.updated.textContent=`Updated ${new Date().toLocaleTimeString()}`; els.message.textContent='Live data received.';
    } catch(e) { els.message.textContent=`Payload error: ${e.message}`; }
  }
  function drawChart(){const c=els.history,ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);const pad={l:36,r:8,t:12,b:28},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;const vals=history.length?history:[70,75,78];let min=Math.min(50,...vals)-5,max=Math.max(150,...vals)+5;for(const v of [50,100,150]){const y=pad.t+(max-v)/(max-min)*ch;ctx.strokeStyle='#34363d';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#999da5';ctx.font='12px system-ui';ctx.fillText(v,pad.l-30,y+4);}if(vals.length<2)return;ctx.strokeStyle='#8fcfff';ctx.lineWidth=3;ctx.beginPath();vals.forEach((v,i)=>{const x=pad.l+i*cw/(vals.length-1),y=pad.t+(max-v)/(max-min)*ch;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();vals.forEach((v,i)=>{const x=pad.l+i*cw/(vals.length-1),y=pad.t+(max-v)/(max-min)*ch;ctx.fillStyle='#101010';ctx.strokeStyle='#8fcfff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.stroke()});ctx.fillStyle='#999da5';ctx.font='12px system-ui';ctx.fillText('Older',pad.l,h-5);ctx.fillText('Now',w-pad.r-25,h-5);}
  async function connect(){
    if(!('bluetooth' in navigator)){els.message.textContent='Web Bluetooth is unavailable. Open the installed app in Android Chrome.';return;}
    try {status('Choose ElderCare-ESP32 in the Bluetooth picker.');device=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'ElderCare_ESP32'}],optionalServices:[SERVICE_UUID]});device.addEventListener('gattserverdisconnected',onDisconnect);status('Connecting…');const server=await device.gatt.connect();const service=await server.getPrimaryService(SERVICE_UUID);characteristic=await service.getCharacteristic(CHARACTERISTIC_UUID);await characteristic.startNotifications();characteristic.addEventListener('characteristicvaluechanged',onNotification);status('Connected and listening for ESP32 notifications.',true);}
    catch(e){status(e.name==='NotFoundError'?'No device selected.':`Connection failed: ${e.message}`);device=null;characteristic=null;}
  }
  function onDisconnect(){if(characteristic)characteristic.removeEventListener('characteristicvaluechanged',onNotification);characteristic=null;chunks.clear();lastFrame=null;status('ESP32 disconnected.');}
  async function disconnect(){if(device?.gatt?.connected)device.gatt.disconnect();else onDisconnect();}
  els.connect.addEventListener('click',connect);els.disconnect.addEventListener('click',disconnect);window.addEventListener('resize',drawChart);drawChart();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();


