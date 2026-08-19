(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let state={tablets:[],licenses:[],history:[],licenseFilter:'ALL',selectedApps:new Set(),updateSelectedApps:new Set(),uninstallSelectedApps:new Set(),dashboardUrl:location.href};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'PHP '+Number(value||0).toFixed(2);
const mode=value=>({0:'CENTRALIZED SMART CHARGING',1:'CENTRALIZED MODE',3:'STANDALONE SMART CHARGING',4:'DIRECT USB CHARGER ONLY'}[value]||String(value||'UNKNOWN'));
const ago=value=>{if(!value)return'NEVER';const seconds=Math.max(0,(Date.now()-new Date(value.replace(' ','T')+'Z'))/1000);if(seconds<60)return Math.floor(seconds)+'s';if(seconds<3600)return Math.floor(seconds/60)+'m';if(seconds<86400)return Math.floor(seconds/3600)+'h';return Math.floor(seconds/86400)+'d';};
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.style.borderColor=error?'#ff4d59':'#38bdf8';el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),4000);}
function busy(button,work){const old=button.textContent;button.disabled=true;button.textContent='PLEASE WAIT…';return Promise.resolve().then(work).catch(e=>toast(e.message||String(e),true)).finally(()=>{button.disabled=false;button.textContent=old;});}
function showLogin(message='',error=false){$('#app').classList.add('hidden');$('#login').classList.remove('hidden');if(message){$('#login-message').textContent=message;$('#login-message').classList.toggle('error',error);}}
function showApp(){$('#login').classList.add('hidden');$('#app').classList.remove('hidden');}
function target(){const location=$('#admin-location').value,tabletId=Number($('#admin-tablet').value||0);return tabletId?{tabletId}:location&&location!=='ALL LOCATIONS'?{location}:{};}
function sourceTablet(){return state.tablets.find(t=>String(t.id)===$('#source-tablet').value);}
function page(name){$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===name));$$('.page').forEach(x=>x.classList.toggle('active',x.id===name+'-page'));const labels={dashboard:['Monitoring Dashboard','All registered locations and tablets'],admin:['Dashboard Admin Settings','Remote fleet settings and Play Store deployment'],licenses:['Manage Licenses','Availability, ownership, history and transfers']};$('#page-title').textContent=labels[name][0];$('#page-subtitle').textContent=labels[name][1];if(name==='licenses')loadLicenses();if(name==='admin')loadDashboardAdmin();}
function stat(label,value,color=''){return`<div class="stat"><b${color?` style="color:${color}"`:''}>${esc(value)}</b><small>${esc(label)}</small></div>`;}
function installedLauncherVersion(t){
  const settings=t&&t.settings&&typeof t.settings==='object'?t.settings:{};
  let raw=t?.launcherVersion||t?.appVersion||t?.versionName||settings.appVersion||settings.launcherVersion||settings.versionName||'';
  raw=String(raw||'').trim();
  if(!raw)return 'NOT REPORTED';
  raw=raw.replace(/^launcher\s*:?\s*/i,'').replace(/^version\s*:?\s*/i,'').trim();
  return /^v/i.test(raw)?raw:'V'+raw;
}
const latestLauncherVersion=String(window.CointabApiConfig?.latestLauncherVersion||'V6.0.0').trim();
function versionParts(value){
  const match=String(value||'').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match?[Number(match[1]||0),Number(match[2]||0),Number(match[3]||0)]:null;
}
function compareVersions(a,b){
  const av=versionParts(a),bv=versionParts(b);
  if(!av||!bv)return null;
  for(let i=0;i<3;i++){if(av[i]!==bv[i])return av[i]>bv[i]?1:-1;}
  return 0;
}
function launcherStatus(t){
  const installed=installedLauncherVersion(t);
  if(installed==='NOT REPORTED')return{installed,label:'Launcher: NOT REPORTED',className:'launcher-unknown'};
  const comparison=compareVersions(installed,latestLauncherVersion);
  if(comparison===null)return{installed,label:'Launcher: '+installed,className:'launcher-unknown'};
  if(comparison<0)return{installed,label:'Launcher: '+installed+' · UPDATE REQUIRED',className:'launcher-outdated'};
  return{installed,label:'Launcher: '+installed+' · CURRENT',className:'launcher-current'};
}



function appSizeBytes(app){
  if(!app||typeof app!=='object')return 0;
  const candidates=[
    app.sizeBytes,app.appSizeBytes,app.installedSizeBytes,app.totalSizeBytes,
    app.packageSizeBytes,app.bytes,app.size
  ];
  for(const raw of candidates){
    if(raw===null||raw===undefined||raw==='')continue;
    if(typeof raw==='number'&&Number.isFinite(raw)&&raw>0)return raw;
    const text=String(raw).trim();
    if(!text)continue;
    if(/^\d+(\.\d+)?$/.test(text)){
      const n=Number(text);
      if(Number.isFinite(n)&&n>0)return n;
    }
    const m=text.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
    if(m){
      const n=Number(m[1]),unit=m[2].toUpperCase();
      const scale={B:1,KB:1024,MB:1024**2,GB:1024**3,TB:1024**4}[unit]||1;
      if(Number.isFinite(n)&&n>0)return n*scale;
    }
  }
  return 0;
}
function formatAppSize(bytes){
  const value=Number(bytes)||0;
  if(value<=0)return 'SIZE NOT REPORTED';
  const units=['B','KB','MB','GB','TB'];
  let n=value,i=0;
  while(n>=1024&&i<units.length-1){n/=1024;i++;}
  const digits=i>=3?2:i>=2?1:0;
  return `${n.toFixed(digits)} ${units[i]}`;
}

function syncableLocationApps(tablet){
  const apps=Array.isArray(tablet?.apps)?tablet.apps:[];
  const blockedPrefixes=['android.','com.android.','com.google.android.','com.mediatek.','com.transsion.','com.samsung.android.','com.sec.android.'];
  const result=new Map();
  apps.forEach(app=>{
    const pkg=String(app?.package||'').trim();
    if(!pkg||app?.protected)return;
    const lower=pkg.toLowerCase();
    if(blockedPrefixes.some(prefix=>lower.startsWith(prefix)))return;
    result.set(pkg,{
      package:pkg,
      label:String(app?.label||app?.name||pkg),
      icon:String(app?.icon||''),
      sizeBytes:appSizeBytes(app)
    });
  });
  return result;
}
async function syncLocationApps(location,button){
  const tablets=state.tablets.filter(t=>tabletLocation(t)===location);
  if(tablets.length<2)throw new Error('At least two tablets are required in this location.');
  const ranked=tablets.map(t=>({tablet:t,apps:syncableLocationApps(t)})).sort((a,b)=>b.apps.size-a.apps.size);
  const reference=ranked[0];
  if(!reference||reference.apps.size===0)throw new Error('No uploaded app list is available for this location yet.');
  let targets=0,totalMissing=0,alreadyMatched=0;
  const details=[];
  for(const item of ranked.slice(1)){
    const missing=[...reference.apps.keys()].filter(pkg=>!item.apps.has(pkg));
    if(!missing.length){alreadyMatched++;continue;}
    await CoinTabApi.command('INSTALL_APPS',{tabletId:item.tablet.id},{packages:missing});
    targets++;totalMissing+=missing.length;
    details.push(`${item.tablet.device}: ${missing.length}`);
  }
  if(!targets){
    toast(`All ${tablets.length} tablets at ${location} already match ${reference.tablet.device} (${reference.apps.size} apps).`);
    return;
  }
  toast(`Location sync queued: ${totalMissing} missing app install(s) across ${targets} tablet(s). Reference: ${reference.tablet.device}.`);
}


function locationSyncAppCatalog(location){
  const tablets=state.tablets.filter(t=>tabletLocation(t)===location);
  if(!tablets.length)return {tablets:[],reference:null,apps:[]};
  const ranked=tablets.map(t=>({tablet:t,apps:syncableLocationApps(t)})).sort((a,b)=>b.apps.size-a.apps.size);
  const reference=ranked[0]||null;
  const combined=new Map();
  ranked.forEach(item=>item.apps.forEach((a,pkg)=>{
    const existing=combined.get(pkg);
    if(!existing)combined.set(pkg,{...a});
    else if((Number(a.sizeBytes)||0)>(Number(existing.sizeBytes)||0))existing.sizeBytes=Number(a.sizeBytes)||0;
  }));
  const apps=reference?[...reference.apps.values()].map(a=>{
    const merged=combined.get(a.package)||a;
    return {...a,sizeBytes:Number(merged.sizeBytes)||Number(a.sizeBytes)||0};
  }).sort((a,b)=>String(a.label||a.package).localeCompare(String(b.label||b.package),undefined,{sensitivity:'base',numeric:true})):[];
  return {tablets,reference,apps};
}
function locationUninstallAppsModal(location){
  const catalog=locationSyncAppCatalog(location);
  if(!catalog.reference||!catalog.apps.length)throw new Error('No synced app list is available for '+location+' yet.');
  const apps=catalog.apps;
  const referenceName=catalog.reference.tablet.device||'REFERENCE TABLET';
  modal(`<div class="admin-dialog-head"><div><h2>${esc(location)} — UNINSTALL APPS</h2>
    <p>Select apps from the synced location catalog. The selected apps will be removed from every tablet in this location where they are installed.</p></div></div>
    <section class="admin-section">
      <div class="app-picker-toolbar">
        <input id="location-uninstall-search" type="search" autocomplete="off" placeholder="Search app name or package">
        <span id="location-uninstall-count" class="total-apps-badge">SELECTED: 0 · SYNC APPS: ${apps.length}</span>
      </div>
      <p class="muted">SYNC SOURCE: ${esc(referenceName)} · ${apps.length} APPS · TARGET: ${catalog.tablets.length} TABLET${catalog.tablets.length===1?'':'S'}</p>
      <div id="location-uninstall-list" class="app-list tablet-action-app-list"></div>
    </section>
    <div class="admin-action-bar">
      <button id="location-uninstall-select-all" class="secondary">SELECT ALL</button>
      <button id="location-uninstall-clear" class="secondary">CLEAR</button>
      <button id="location-uninstall-confirm" class="danger">UNINSTALL SELECTED FROM LOCATION</button>
    </div>`);
  const selected=new Set();
  const updateCount=()=>{$('#location-uninstall-count').textContent=`SELECTED: ${selected.size} · SYNC APPS: ${apps.length}`;};
  const render=()=>{
    const query=$('#location-uninstall-search').value.trim().toLowerCase();
    const visible=apps.filter(a=>(String(a.label||a.package||'')+' '+String(a.package||'')).toLowerCase().includes(query));
    $('#location-uninstall-list').innerHTML=visible.map(a=>`<label class="app-item">
      <input type="checkbox" data-location-uninstall-package="${esc(a.package)}" ${selected.has(a.package)?'checked':''}>
      <span class="app-item-copy">
        <b>${esc(a.label||a.package)}</b>
        <small>${esc(a.package)}</small>
      </span>
      <strong class="app-size">${esc(formatAppSize(a.sizeBytes))}</strong>
    </label>`).join('')||'<p>No matching apps.</p>';
    $$('[data-location-uninstall-package]').forEach(box=>box.onchange=()=>{
      if(box.checked)selected.add(box.dataset.locationUninstallPackage);else selected.delete(box.dataset.locationUninstallPackage);
      updateCount();
    });
  };
  $('#location-uninstall-search').oninput=render;
  $('#location-uninstall-select-all').onclick=()=>{apps.forEach(a=>selected.add(a.package));render();updateCount();};
  $('#location-uninstall-clear').onclick=()=>{selected.clear();render();updateCount();};
  $('#location-uninstall-confirm').onclick=()=>busy($('#location-uninstall-confirm'),async()=>{
    const packages=[...selected];
    if(!packages.length)throw new Error('Select at least one app to uninstall.');
    if(!confirm(`Uninstall ${packages.length} selected app(s) from ALL ${catalog.tablets.length} tablet(s) at ${location}?`))return;
    await CoinTabApi.command('UNINSTALL_APPS',{location},{packages});
    toast(`Uninstall queued for ${packages.length} app(s) across ${location}`);
    closeModal();
  });
  render();updateCount();
}

function tabletNaturalCompare(a,b){
  return String(a?.device||'').localeCompare(String(b?.device||''),undefined,{sensitivity:'base',numeric:true});
}

function tabletLocation(t){
  const settings=t&&t.settings&&typeof t.settings==='object'?t.settings:{};
  const candidates=[t?.location,t?.licenseLocation,t?.ownerLocation,t?.locationName,settings.location,settings.ownerLocation,settings.locationName,settings.owner];
  for(const value of candidates){const v=String(value||'').trim();if(v)return v;}
  return 'UNASSIGNED';
}
function tabletCard(t){
  const preview=t.preview?`<img src="${esc(t.preview)}" alt="${esc(t.device)} preview">`:'REMOTE SCREEN PREVIEW<br><small>Waiting for the next secure snapshot</small>';
  const launcher=launcherStatus(t);
  const battery=Math.max(0,Math.min(100,Number(t.battery||0)));
  const batteryClass=battery<=50?'battery-low':'battery-good';
  const totalApps=Array.isArray(t.apps)?t.apps.length:0;
  return`<article class="tablet-card" data-tablet="${t.id}"><button class="tablet-remove" data-remove-tablet="${t.id}" type="button" title="Remove tablet" aria-label="Remove ${esc(t.device)}">×</button><div class="preview" data-preview="${t.id}">${preview}</div><div class="tablet-body"><div class="tablet-head"><h3>${esc(t.device)}</h3><span class="status ${t.online?'online':'offline'}">${t.online?'ONLINE':'OFFLINE'}</span></div><div class="tablet-meta">${esc(mode(t.mode))}<br>Battery: <span class="battery-percent ${batteryClass}">${battery}%</span> · Last seen: ${esc(ago(t.lastSeen))}<br><span class="preview-apps-row"><span>Preview: ${esc(ago(t.previewAt))}</span><span class="card-app-count">Total apps: ${totalApps}</span></span><br><span class="launcher-version ${launcher.className}">${esc(launcher.label)}</span></div><div class="sales"><div class="sale"><small>TODAY</small>${money(t.sales?.today)}</div><div class="sale"><small>THIS WEEK</small>${money(t.sales?.week)}</div><div class="sale"><small>THIS MONTH</small>${money(t.sales?.month)}</div><div class="sale"><small>ALL-TIME</small>${money(t.sales?.allTime)}</div></div><div class="tablet-actions"><button data-remote="${t.id}">REMOTE CONTROL</button><button data-settings="${t.id}" class="secondary">ADMIN SETTINGS</button></div></div></article>`;}
function renderDashboard(data){state.tablets=(data.tablets||[]).filter(t=>String(t.licenseStatus||'USED').toUpperCase()==='USED'&&t.licenseKey&&t.installId).map(t=>({...t,location:tabletLocation(t)}));const online=state.tablets.filter(x=>x.online).length,
locations=[...new Set(state.tablets.map(tabletLocation))].sort((a,b)=>
  String(a).localeCompare(String(b), undefined, {sensitivity:'base', numeric:true})
);$('#summary-cards').innerHTML=stat('ONLINE TABLETS',online,'#12d977')+stat('REGISTERED TABLETS',state.tablets.length)+stat('LOCATIONS',locations.length,'#38bdf8')+stat('ALL-TIME SALES',money(data.sales?.allTime),'#ffc13d');$('#locations').innerHTML=locations.map(location=>{const tablets=state.tablets.filter(x=>tabletLocation(x)===location).sort(tabletNaturalCompare);return`<section><div class="location-title"><h2>${esc(location)}</h2><div class="location-actions"><span>${tablets.length} TABLET${tablets.length===1?'':'S'}</span><button class="location-update-apps secondary" data-location-update-apps="${esc(location)}">UPDATE ALL APPS</button><button class="location-update-launchers" data-location-update-launchers="${esc(location)}">UPDATE ALL LAUNCHERS</button><button class="location-sync-apps" data-location-sync-apps="${esc(location)}">SYNC LOCATION APPS</button><button class="location-uninstall-apps danger" data-location-uninstall-apps="${esc(location)}">UNINSTALL APPS</button></div></div><div class="tablet-grid">${tablets.map(tabletCard).join('')}</div></section>`;}).join('')||'<div class="panel">No registered tablets yet.</div>';fillTargets();bindTabletButtons();bindLocationUpdateButtons();}
function optionList(locations,allLabel='ALL LOCATIONS'){return '<option>'+allLabel+'</option>'+locations.map(x=>`<option>${esc(x)}</option>`).join('');}
function tabletOptions(location,allLabel='ALL TABLETS IN SELECTED LOCATION'){const tabs=state.tablets.filter(x=>!location||location==='ALL LOCATIONS'||tabletLocation(x)===location).sort(tabletNaturalCompare);return '<option value="">'+allLabel+'</option>'+tabs.map(x=>`<option value="${x.id}">${esc(x.device)}</option>`).join('');}
function fillTargets(){const locations=[...new Set(state.tablets.map(tabletLocation))].sort((a,b)=>
  String(a).localeCompare(String(b), undefined, {sensitivity:'base', numeric:true})
);const all=optionList(locations);['resetSalesLocation','bulkUpdateLocation','bulkThemeLocation','bulkNetworkLocation','bulkProtectedGmailLocation','ownInstallLocation','allGamesLocation','updateLocation','uninstallLocation','stopLocation'].forEach(id=>{const e=$('#'+id);if(e)e.innerHTML=all;});const sourceOptions=[...state.tablets].sort(tabletNaturalCompare).map(x=>`<option value="${x.id}">${esc(tabletLocation(x)+' / '+x.device)}</option>`).join('');
['source-tablet','update-source-tablet','uninstall-source-tablet'].forEach(id=>{const source=$('#'+id);if(source)source.innerHTML=sourceOptions;});
refreshDeployTabletOptions();}
function refreshDeployTabletOptions(){[['ownInstallLocation','ownInstallTablet'],['allGamesLocation','allGamesTablet'],['updateLocation','updateTablet'],['uninstallLocation','uninstallTablet']].forEach(([l,t])=>{const le=$('#'+l),te=$('#'+t);if(le&&te)te.innerHTML=tabletOptions(le.value);});}
let dashboardRefreshInFlight=false;
let dashboardLastSuccess=0;
async function refresh(){
  if(dashboardRefreshInFlight)return;
  dashboardRefreshInFlight=true;
  try{
    const data=await CoinTabApi.summary();
    renderDashboard(data);
    dashboardLastSuccess=Date.now();
    $('#server-pill').className=$('#online-pill').className='pill good';
  }finally{
    dashboardRefreshInFlight=false;
  }
}
function modal(html){$('#modal-content').innerHTML=html;$('#modal').classList.remove('hidden');}
function closeModal(){$('#modal').classList.add('hidden');$('#modal-content').innerHTML='';}
function bindTabletButtons(){$$('[data-preview]').forEach(el=>el.onclick=()=>{const t=state.tablets.find(x=>x.id==el.dataset.preview);if(t?.preview)modal(`<h2>${esc(t.device)} — SCREEN PREVIEW</h2><img src="${esc(t.preview)}" style="width:100%;max-height:75vh;object-fit:contain;background:#000">`);});$$('[data-remote]').forEach(el=>el.onclick=()=>remoteModal(Number(el.dataset.remote)));$$('[data-settings]').forEach(el=>el.onclick=()=>settingsModal(Number(el.dataset.settings)));$$('[data-remove-tablet]').forEach(el=>el.onclick=event=>{event.stopPropagation();removeTabletFromDashboard(Number(el.dataset.removeTablet),el);});}
async function removeTabletFromDashboard(id,button){
  const t=state.tablets.find(x=>Number(x.id)===Number(id));
  if(!t)throw new Error('Tablet not found. Refresh the dashboard and try again.');
  const license=String(t.licenseKey||'').trim(),installId=String(t.installId||'').trim();
  if(!license)throw new Error('This tablet has no license key to release.');
  const ok=confirm(`Remove ${t.device} from the Monitoring Dashboard?\n\nThis will RELEASE license ${license} from this installation. The license will become available for reuse.\n\nThis does not erase the tablet. Continue?`);
  if(!ok)return;
  await busy(button,async()=>{
    const result=await CoinTabApi.release(license,installId);
    toast(result?.message||`${t.device} removed. License released.`);
    await refresh();
  });
}
function bindLocationUpdateButtons(){
  $$('[data-location-update-apps]').forEach(button=>button.onclick=()=>busy(button,async()=>{const location=button.dataset.locationUpdateApps;if(!confirm('Update ALL Play Store apps on every tablet at '+location+'?'))return;await CoinTabApi.command('UPDATE_APPS',{location},{all:true});toast('All-app update queued for '+location);}));
  $$('[data-location-update-launchers]').forEach(button=>button.onclick=()=>busy(button,async()=>{const location=button.dataset.locationUpdateLaunchers;if(!confirm('Update the launcher on every tablet at '+location+'?'))return;await CoinTabApi.command('UPDATE_LAUNCHER',{location},{});toast('Launcher update queued for every tablet at '+location);}));
  $$('[data-location-sync-apps]').forEach(button=>button.onclick=()=>busy(button,async()=>{const location=button.dataset.locationSyncApps;if(!confirm('Match the installed apps for every tablet at '+location+' using the tablet with the largest app list as the reference?\n\nOnly missing apps will be installed.'))return;await syncLocationApps(location,button);}));
  $$('[data-location-uninstall-apps]').forEach(button=>button.onclick=()=>{const location=button.dataset.locationUninstallApps;try{locationUninstallAppsModal(location);}catch(e){toast(e.message||String(e),true);}});
}
function remoteModal(id){const t=state.tablets.find(x=>x.id===id);modal(`<h2>${esc(t.device)} — REMOTE CONTROL</h2><p>Commands are queued and applied when the licensed tablet is online. Reboot and power lock require Device Owner.</p><div class="remote-grid"><button data-cmd="SCREEN_ON">TURN SCREEN ON</button><button data-cmd="BACK">BACK</button><button data-cmd="HOME">HOME</button><button data-cmd="RECENTS">RECENTS</button><button data-cmd="OPEN_WIFI">OPEN WI-FI</button><button data-cmd="POWER" class="danger">POWER / LOCK</button><button data-cmd="REBOOT" class="danger">REBOOT DEVICE</button></div><textarea id="remote-message" class="remote-message" placeholder="Message to display on the tablet"></textarea><button id="send-message">SEND MESSAGE</button>`);$$('[data-cmd]').forEach(button=>button.onclick=()=>busy(button,async()=>{await CoinTabApi.command(button.dataset.cmd,{tabletId:id},{});toast(button.dataset.cmd+' queued');closeModal();}));$('#send-message').onclick=()=>busy($('#send-message'),async()=>{const message=$('#remote-message').value.trim();if(!message)throw new Error('Enter a message first.');await CoinTabApi.command('MESSAGE',{tabletId:id},{message});toast('Message queued');closeModal();});}
function settingsModal(id){
  const t=state.tablets.find(x=>x.id===id),s=t.settings||{},apps=Array.isArray(t.apps)?t.apps:[];
  const themes=['Midnight Blue','Neon Arcade','Emerald Matrix','Crimson Carbon','Royal Gold','Ocean Cyan','Violet Storm','Sunset Orange','Ice Silver','Rose Neon'];
  const appRows=apps.map((a,index)=>{const label=esc(a.label||a.name||a.package||'APP'),pkg=esc(a.package||''),protectedApp=!!a.protected;return`<div class="policy-row" data-app-index="${index}"><div class="policy-name"><span class="policy-icon">${label.slice(0,1).toUpperCase()}</span><span><b>${label}</b><small>${pkg}${protectedApp?' · PROTECTED':''}</small></span></div><div class="policy-actions"><label><input class="p-display" type="checkbox" ${a.displayed!==false?'checked':''}> DISPLAY</label><label><input class="p-pin" type="checkbox" ${a.requirePin?'checked':''}> PIN</label><label><input class="p-clear" type="checkbox" ${a.clearData?'checked':''} ${protectedApp?'disabled':''}> CLEAR</label></div></div>`;}).join('');
  modal(`<div class="admin-dialog-head"><div><h2>${esc(t.device)} — TABLET ADMIN SETTINGS</h2><p>Changes are securely queued and applied by this licensed tablet on its next online heartbeat.</p></div></div>
  <section class="admin-section license-info-section"><h3>Tablet License</h3><div class="license-info-grid">
    <div><small>LICENSE KEY</small><b>${esc(t.licenseKey||'NOT REPORTED')}</b></div>
    <div><small>STATUS</small><b>${esc(String(t.licenseStatus||'USED').toUpperCase())}</b></div>
    <div><small>INSTALL ID</small><b>${esc(t.installId||'NOT REPORTED')}</b></div>
    <div><small>LOCATION</small><b>${esc(tabletLocation(t)||'UNASSIGNED')}</b></div>
  </div></section>
  <section class="admin-section"><h3>Connection & Mode</h3><div class="form-grid admin-grid">
    <label>Operating Mode<select id="m-mode"><option value="0">Centralized Mode</option><option value="1">Centralized Mode With Smart Charging</option><option value="3">Standalone Smart Charging</option><option value="4">Direct USB Charger Only</option></select></label>
    <label>Controller URL<input id="m-url" value="${esc(s.url||s.controllerUrl||'')}" placeholder="http://192.168.1.90"></label>
    <label>Location / Owner<input id="m-location" value="${esc(t.location||s.locationName||'')}"></label>
    <label>Device Name<input id="m-device" value="${esc(t.device||s.deviceName||'')}"></label>
    <label>Protected Play Store Gmail<input id="m-protected-email" type="email" value="${esc(s.protectedGoogleAccount||'')}"></label>
    <label>Minutes Per Rate<input id="m-minutes" type="number" min=".25" step=".25" value="${Number(s.chargerMinutesPerPeso??s.rateMinutes??6)}"></label>
    <label>Peso Per Rate<input id="m-peso" type="number" min=".01" step=".01" value="${Number(s.chargerPeso??s.ratePeso??1)}"></label>
    <label>Cleanup Delay (minutes)<input id="m-cleanup" type="number" min="0" max="1440" value="${Number(s.cleanup??10)}"></label>
    <label>Preview Refresh (seconds)<input id="m-preview" type="number" min="3" max="120" value="${Number(s.screenMonitorRemoteInterval??15)}"></label>
  </div></section>
  <section class="admin-section"><h3>Appearance & Themes</h3><p>Use the same launcher themes and category organization as the launcher Admin Settings.</p><div class="form-grid admin-grid">
    <label>Launcher Theme<select id="m-theme">${themes.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label>
    <label>Background Media<select id="m-media"><option value="">Launcher Default</option><option value="NONE">No Background Media</option><option value="VIDEO">Video Background</option><option value="IMAGE">Image Background</option></select></label>
    <label class="check"><input id="m-categories" type="checkbox" ${s.categoryMode?'checked':''}> Organize Launcher Into App Categories</label>
    <label class="check"><input id="m-daily-theme" type="checkbox" ${s.dailyThemeRotation?'checked':''}> Automatically Change Theme Every Day</label>
  </div></section>
  <section class="admin-section"><h3>Launcher Features & Voice</h3><div class="form-grid admin-grid">
    <label class="check"><input id="m-widget" type="checkbox" ${s.timeWidget!==false?'checked':''}> Time Left Widget</label>
    <label class="check"><input id="m-monitor" type="checkbox" ${s.screenMonitoringEnabled!==false?'checked':''}> Remote Screen Monitoring</label>
    <label class="check"><input id="m-voice-coin" type="checkbox" ${s.voiceCoinEnabled!==false?'checked':''}> Coin Voice</label>
    <label class="check"><input id="m-voice-five" type="checkbox" ${s.voiceFiveEnabled!==false?'checked':''}> Five-Minute Voice</label>
    <label class="check"><input id="m-voice-one" type="checkbox" ${s.voiceOneEnabled!==false?'checked':''}> One-Minute Voice</label>
    <label class="check"><input id="m-voice-up" type="checkbox" ${s.voiceUpEnabled!==false?'checked':''}> Time-Up Voice</label>
  </div></section>
  <section class="admin-section"><h3>Network Protection</h3><div class="form-grid admin-grid">
    <label class="check"><input id="m-adult" type="checkbox" ${s.blockAdultSites?'checked':''}> Block Known Adult Sites</label>
    <label class="check"><input id="m-ads" type="checkbox" ${s.blockAdDomains?'checked':''}> Block Known Ad Domains</label>
    <label class="check"><input id="m-vpn" type="checkbox" ${s.vpnControlsEnabled?'checked':''}> Show VPN Controls</label>
  </div></section>
  <section class="admin-section"><div class="section-heading"><div><h3>Installed App Controls</h3><p>Choose which apps are displayed, require the Administrator PIN, or have their data cleared after rental use.</p></div><div class="app-count-badges"><span class="total-apps-badge">TOTAL APPS: ${apps.length}</span></div></div><div id="m-app-policies" class="policy-list">${appRows||'<div class="empty-policy">The tablet has not reported its installed applications yet. Keep it online, refresh the dashboard, then reopen Admin Settings.</div>'}</div></section>
  <section class="admin-section"><h3>Administrator Security</h3><div class="form-grid admin-grid"><label>New Administrator PIN (optional)<input id="m-pin" inputmode="numeric" maxlength="8" placeholder="Leave blank to keep current PIN"></label></div></section>
  <div class="admin-action-bar"><button id="m-reload" class="secondary">RELOAD TABLET DATA</button><button id="m-reset" class="danger">RESET TABLET SALES</button><button id="m-update">UPDATE LAUNCHER</button><button id="m-app-uninstall" class="danger">UNINSTALL APPS</button><button id="m-save">SAVE TO TABLET</button></div>`);
  $('#m-mode').value=String(s.mode??t.mode??0);$('#m-theme').value=String(s.uiTheme??0);$('#m-media').value=String(s.media||'');
  $('#m-app-uninstall').onclick=()=>tabletAppActionModal(id,'UNINSTALL_APPS');
  $('#m-reload').onclick=()=>busy($('#m-reload'),async()=>{await refresh();toast('Tablet data refreshed');closeModal();settingsModal(id);});
  $('#m-save').onclick=()=>busy($('#m-save'),async()=>{
    const settings={mode:Number($('#m-mode').value),url:$('#m-url').value.trim(),locationName:$('#m-location').value.trim(),deviceName:$('#m-device').value.trim().toUpperCase(),protectedGoogleAccount:$('#m-protected-email').value.trim().toLowerCase(),chargerMinutesPerPeso:Number($('#m-minutes').value),chargerPeso:Number($('#m-peso').value),cleanup:Number($('#m-cleanup').value),screenMonitorRemoteInterval:Number($('#m-preview').value),uiTheme:Number($('#m-theme').value),categoryMode:$('#m-categories').checked,dailyThemeRotation:$('#m-daily-theme').checked,media:$('#m-media').value,timeWidget:$('#m-widget').checked,screenMonitoringEnabled:$('#m-monitor').checked,voiceCoinEnabled:$('#m-voice-coin').checked,voiceFiveEnabled:$('#m-voice-five').checked,voiceOneEnabled:$('#m-voice-one').checked,voiceUpEnabled:$('#m-voice-up').checked,blockAdultSites:$('#m-adult').checked,blockAdDomains:$('#m-ads').checked,vpnControlsEnabled:$('#m-vpn').checked};
    const pin=$('#m-pin').value.trim();if(pin)settings.newAdminPin=pin;
    const appPolicies=[...document.querySelectorAll('#m-app-policies .policy-row')].map(row=>{const a=apps[Number(row.dataset.appIndex)]||{};return{package:a.package||'',label:a.label||a.name||'',displayed:row.querySelector('.p-display').checked,requirePin:row.querySelector('.p-pin').checked,clearData:row.querySelector('.p-clear').checked,protected:!!a.protected};});
    await CoinTabApi.command('APPLY_SETTINGS',{tabletId:id},{settings,apps:appPolicies});toast('Full tablet settings queued');closeModal();
  });
  $('#m-reset').onclick=()=>busy($('#m-reset'),async()=>{if(!confirm('Reset Today, This Week, This Month and All-Time sales for '+t.device+'?'))return;const r=await CoinTabApi.resetSales(id);toast(r.message||'Reset queued — waiting for the tablet heartbeat');closeModal();setTimeout(()=>refresh().catch(()=>{}),1500);});
  $('#m-update').onclick=()=>busy($('#m-update'),async()=>{await CoinTabApi.command('UPDATE_LAUNCHER',{tabletId:id},{});toast('Launcher update queued');closeModal();});
}
async function loadLicenses(){const [licenses,history]=await Promise.all([CoinTabApi.licenses(),CoinTabApi.licenseHistory()]);state.licenses=licenses.licenses||[];state.history=history.history||[];renderLicenses();}
function licenseStatus(x){return String(x&&x.status||'').trim().toUpperCase();}
function licenseKey(x){return String(x&&(x.licenseKey||x.key)||'').trim().toUpperCase();}
function isRealCustomerLicense(x){
  const key=licenseKey(x);
  if(!key)return false;
  if(key.startsWith('MIG-SALE-'))return false;
  if(key.startsWith('MIG-'))return false;
  if(key.startsWith('LEGACY-'))return false;
  if(key.startsWith('CTR-ARCH-'))return false;
  if(key.startsWith('ARCHIVE-'))return false;
  return key.startsWith('CTR-');
}
function setLicenseFilter(filter){state.licenseFilter=filter;renderLicenses();}
function renderLicenseTabs(){
  const realLicenses=state.licenses.filter(isRealCustomerLicense);
  const all=realLicenses.length;
  const available=realLicenses.filter(x=>licenseStatus(x)==='AVAILABLE').length;
  const used=realLicenses.filter(x=>licenseStatus(x)==='USED').length;
  const counts={ALL:all,AVAILABLE:available,USED:used};
  $$('.license-filter-tab').forEach(button=>{
    const filter=button.dataset.licenseFilter;
    button.classList.toggle('active',state.licenseFilter===filter);
    const count=button.querySelector('.license-tab-count');
    if(count)count.textContent=counts[filter]||0;
  });
}
function renderLicenses(){
  renderLicenseTabs();
  const query=$('#license-search').value.trim().toLowerCase();
  const rows=state.licenses.filter(x=>{
    if(!isRealCustomerLicense(x))return false;
    const matchesFilter=state.licenseFilter==='ALL'||licenseStatus(x)===state.licenseFilter;
    const matchesSearch=!query||JSON.stringify(x).toLowerCase().includes(query);
    return matchesFilter&&matchesSearch;
  });
  $('#license-list').innerHTML=rows.map(x=>`<div class="license"><div><b>${esc(x.licenseKey||x.key)}</b><small>${esc(x.email)} · ${esc(x.type)} · ${esc(x.device||'NOT ASSIGNED')} · ${esc(x.location||'')}</small></div><span class="status ${licenseStatus(x)==='USED'?'online':licenseStatus(x)==='AVAILABLE'?'':'offline'}">${esc(licenseStatus(x)||'UNKNOWN')}</span><button data-license-action="${licenseStatus(x)==='REVOKED'?'restore':'revoke'}" data-key="${esc(x.licenseKey||x.key)}" class="secondary">${licenseStatus(x)==='REVOKED'?'RESTORE':'REVOKE'}</button><button data-transfer="${esc(x.licenseKey||x.key)}">TRANSFER</button></div>`).join('')||'<p class="license-empty">No licenses in this tab.</p>';
  $('#license-history').innerHTML=state.history.map(x=>{const d=x.details||{};const from=x.from_email||d.fromEmail||d.from_email||'';const to=x.to_email||d.toEmail||d.to_email||'';const ownership=(from||to)?`<span class="history-owner"><small>FROM</small><b>${esc(from||'NOT RECORDED')}</b><span class="history-arrow">→</span><small>TO</small><b>${esc(to||'NOT RECORDED')}</b></span>`:'<span class="history-owner muted">Ownership email was not recorded for this event.</span>';return `<div class="history-row"><div><b>${esc(x.event_type)}</b><small>${esc(x.license_key)}</small></div>${ownership}<small class="history-date">${esc(x.created_at)}</small></div>`}).join('')||'<p>No license history.</p>';
  $$('[data-license-action]').forEach(button=>button.onclick=()=>busy(button,async()=>{if(button.dataset.licenseAction==='restore')await CoinTabApi.restore(button.dataset.key);else await CoinTabApi.revoke(button.dataset.key);toast('License updated');await loadLicenses();}));
  $$('[data-transfer]').forEach(button=>button.onclick=()=>{const email=prompt('New owner Gmail');if(!email)return;const seller=confirm('Keep the currently activated tablet and transfer its dashboard/settings to the new owner?\n\nOK = Seller transfer\nCancel = Normal transfer');CoinTabApi.transfer(button.dataset.transfer,email,seller).then(async()=>{toast('License transferred. Dashboard ownership refreshed.');await loadLicenses();await refresh();}).catch(e=>toast(e.message,true));});
}
function selectedPackages(){const packages=[...state.selectedApps];const optional=$('#package').value.trim();if(optional&&!packages.includes(optional))packages.push(optional);if(!packages.length)throw new Error('Select or enter at least one package.');return packages;}
function renderSourceApps(){const t=sourceTablet(),apps=t?.apps||[];state.selectedApps.clear();$('#source-apps').innerHTML=apps.map(a=>`<label class="app-item"><input type="checkbox" data-package="${esc(a.package)}"><img src="${esc(a.icon||'')}" onerror="this.style.display='none'"><span>${esc(a.label||a.package)}<small>${esc(a.package)}</small></span></label>`).join('')||'<p>This tablet has not uploaded its installed-app list yet.</p>';$$('[data-package]').forEach(box=>box.onchange=()=>box.checked?state.selectedApps.add(box.dataset.package):state.selectedApps.delete(box.dataset.package));}

function tabletBySelect(selectId){
  const id=Number($('#'+selectId)?.value||0);
  return state.tablets.find(x=>x.id===id)||null;
}
function deploySelection(name){
  if(name==='update')return state.updateSelectedApps;
  if(name==='uninstall')return state.uninstallSelectedApps;
  return state.selectedApps;
}
function renderDeployAppPicker(name){
  const config={
    update:{source:'update-source-tablet',host:'update-source-apps',search:'update-app-search'},
    uninstall:{source:'uninstall-source-tablet',host:'uninstall-source-apps',search:'uninstall-app-search'}
  }[name];
  if(!config)return;
  const tablet=tabletBySelect(config.source);
  const host=$('#'+config.host);
  const search=String($('#'+config.search)?.value||'').trim().toLowerCase();
  const selected=deploySelection(name);
  const apps=Array.isArray(tablet?.apps)?tablet.apps:[];
  const visible=apps.filter(app=>{
    const label=String(app.label||app.name||app.package||'');
    const pkg=String(app.package||'');
    return !search||(label+' '+pkg).toLowerCase().includes(search);
  });
  host.innerHTML=visible.map(app=>{
    const pkg=String(app.package||'').trim();
    const label=String(app.label||app.name||pkg||'APP');
    const protectedApp=!!app.protected||pkg.startsWith('com.android.')||pkg.startsWith('com.google.android.');
    const disabled=name==='uninstall'&&protectedApp;
    return `<label class="app-item deploy-app-item ${disabled?'protected-app':''}">
      <input type="checkbox" data-${name}-package="${esc(pkg)}" ${selected.has(pkg)?'checked':''} ${disabled?'disabled':''}>
      <img src="${esc(app.icon||'')}" onerror="this.style.display='none'">
      <span>${esc(label)}<small>${esc(pkg)}${disabled?' · PROTECTED':''}</small></span>
    </label>`;
  }).join('')||'<p class="app-picker-empty">No matching apps. Load a source tablet that has reported its installed Play Store apps.</p>';
  $$(`[data-${name}-package]`).forEach(box=>box.onchange=()=>{
    if(box.checked)selected.add(box.dataset[name+'Package']);
    else selected.delete(box.dataset[name+'Package']);
    updateDeploySelectionCount(name);
  });
  updateDeploySelectionCount(name,apps.length);
}
function loadDeployAppPicker(name){
  const selected=deploySelection(name);
  selected.clear();
  const searchId=name==='update'?'update-app-search':'uninstall-app-search';
  const search=$('#'+searchId);if(search)search.value='';
  renderDeployAppPicker(name);
}
function selectVisibleDeployApps(name){
  const selected=deploySelection(name);
  $$(`[data-${name}-package]:not(:disabled)`).forEach(box=>{
    box.checked=true;
    selected.add(box.dataset[name+'Package']);
  });
  updateDeploySelectionCount(name);
}
function clearDeployApps(name){
  deploySelection(name).clear();
  $$(`[data-${name}-package]`).forEach(box=>box.checked=false);
  updateDeploySelectionCount(name);
}
function updateDeploySelectionCount(name,total){
  const selected=deploySelection(name);
  const target=$('#'+name+'-selection-count');
  if(target)target.textContent=`SELECTED: ${selected.size}${Number.isFinite(total)?` · SOURCE APPS: ${total}`:''}`;
}
function selectedDeployPackages(name,manualId,allowAll=false){
  const packages=[...deploySelection(name)];
  const manual=String($('#'+manualId)?.value||'').trim();
  if(manual&&!packages.includes(manual))packages.push(manual);
  if(!packages.length&&!allowAll)throw new Error('Select at least one app from the source tablet.');
  return packages;
}
function tabletAppActionModal(id,action){
  const tablet=state.tablets.find(x=>x.id===id);
  if(!tablet)return;
  const apps=(Array.isArray(tablet.apps)?tablet.apps:[]).filter(app=>{
    const pkg=String(app.package||'');
    return !app.protected&&!pkg.startsWith('com.android.')&&!pkg.startsWith('com.google.android.');
  });
  modal(`<div class="admin-dialog-head"><div><h2>${esc(tablet.device)} — UNINSTALL APPS</h2>
    <p>Select apps reported by this tablet. Protected and system apps are excluded.</p></div></div>
    <section class="admin-section">
      <div class="app-picker-toolbar">
        <input id="tablet-uninstall-search" type="search" autocomplete="off" placeholder="Search app name or package">
        <span id="tablet-uninstall-count" class="total-apps-badge">SELECTED: 0 · TOTAL APPS: ${apps.length}</span>
      </div>
      <div id="tablet-uninstall-list" class="app-list tablet-action-app-list"></div>
    </section>
    <div class="admin-action-bar">
      <button id="tablet-uninstall-select-all" class="secondary">SELECT ALL</button>
      <button id="tablet-uninstall-clear" class="secondary">CLEAR</button>
      <button id="tablet-uninstall-confirm" class="danger">UNINSTALL SELECTED</button>
    </div>`);
  const selected=new Set();
  const render=()=>{
    const query=$('#tablet-uninstall-search').value.trim().toLowerCase();
    const visible=apps.filter(a=>(String(a.label||a.name||'')+' '+String(a.package||'')).toLowerCase().includes(query));
    $('#tablet-uninstall-list').innerHTML=visible.map(a=>`<label class="app-item">
      <input type="checkbox" data-tablet-uninstall-package="${esc(a.package)}" ${selected.has(a.package)?'checked':''}>
      <img src="${esc(a.icon||'')}" onerror="this.style.display='none'">
      <span class="app-item-copy">
        <b>${esc(a.label||a.name||a.package)}</b>
        <small>${esc(a.package)}</small>
      </span>
      <strong class="app-size">${esc(formatAppSize(appSizeBytes(a)))}</strong>
    </label>`).join('')||'<p>No matching apps.</p>';
    $$('[data-tablet-uninstall-package]').forEach(box=>box.onchange=()=>{
      if(box.checked)selected.add(box.dataset.tabletUninstallPackage);
      else selected.delete(box.dataset.tabletUninstallPackage);
      $('#tablet-uninstall-count').textContent=`SELECTED: ${selected.size} · TOTAL APPS: ${apps.length}`;
    });
  };
  $('#tablet-uninstall-search').oninput=render;
  $('#tablet-uninstall-select-all').onclick=()=>{apps.forEach(a=>selected.add(a.package));render();$('#tablet-uninstall-count').textContent=`SELECTED: ${selected.size} · TOTAL APPS: ${apps.length}`;};
  $('#tablet-uninstall-clear').onclick=()=>{selected.clear();render();$('#tablet-uninstall-count').textContent=`SELECTED: 0 · TOTAL APPS: ${apps.length}`;};
  $('#tablet-uninstall-confirm').onclick=()=>busy($('#tablet-uninstall-confirm'),async()=>{
    const packages=[...selected];
    if(!packages.length)throw new Error('Select at least one app to uninstall.');
    if(!confirm(`Uninstall ${packages.length} selected app(s) from ${tablet.device}?`))return;
    await CoinTabApi.command('UNINSTALL_APPS',{tabletId:id},{packages});
    toast(`Uninstall queued for ${packages.length} app(s) on ${tablet.device}`);
    closeModal();
  });
  render();
}

function configMap(rows){const result={};(rows||[]).forEach(r=>{if(r.scope==='ACCOUNT'||r.scope==='GLOBAL')result[r.config_key]=r.value;});return result;}
function renderOrganization(){const host=$('#organization');if(!host)return;host.innerHTML=state.tablets.map(t=>`<div class="organization-row" data-org-id="${t.id}"><label>Location<input class="org-location" value="${esc(t.location||'UNASSIGNED')}"></label><label>Tablet Name<input class="org-device" value="${esc(t.device||'TABLET')}"></label><label class="check org-monitor"><input class="org-monitoring" type="checkbox" ${t.monitoringEnabled!==false?'checked':''}> Monitor</label><button class="danger org-remove" type="button">REMOVE TABLET</button></div>`).join('');$$('.org-remove').forEach(btn=>btn.onclick=()=>{const row=btn.closest('.organization-row');if(!confirm('Disable monitoring for this tablet? Full removal requires deactivating or releasing its license.'))return;row.querySelector('.org-monitoring').checked=false;toast('Monitoring disabled in this form. Press SAVE SETTINGS to queue it.');});}
async function loadDashboardAdmin(){renderOrganization();fillTargets();try{const data=await CoinTabApi.configuration(),m=configMap(data.configuration);if(m.requireLogin!==undefined)$('#requireLogin').checked=!!m.requireLogin;if(m.requireAdminPin!==undefined)$('#requireAdminPin').checked=!!m.requireAdminPin;if(m.trustedDays!==undefined)$('#trustedDays').value=m.trustedDays;if(m.previewSeconds!==undefined)$('#previewSeconds').value=m.previewSeconds;if(m.liveMinutes!==undefined)$('#liveMinutes').value=m.liveMinutes;if(m.monitoringEnabled!==undefined)$('#monitoringEnabled').checked=!!m.monitoringEnabled;}catch(e){toast('Dashboard settings loaded from current defaults: '+e.message,true);}}
async function saveDashboardAdmin(button){await busy(button,async()=>{const settings={requireLogin:$('#requireLogin').checked,requireAdminPin:$('#requireAdminPin').checked,trustedDays:Number($('#trustedDays').value||14),previewSeconds:Number($('#previewSeconds').value||15),liveMinutes:Number($('#liveMinutes').value||10),monitoringEnabled:$('#monitoringEnabled').checked};for(const [key,value] of Object.entries(settings))await CoinTabApi.setConfiguration('ACCOUNT','',key,value);for(const row of $$('.organization-row')){const id=Number(row.dataset.orgId),t=state.tablets.find(x=>x.id===id);if(!t)continue;const payload={settings:{locationName:row.querySelector('.org-location').value.trim(),deviceName:row.querySelector('.org-device').value.trim().toUpperCase(),screenMonitoringEnabled:row.querySelector('.org-monitoring').checked}};await CoinTabApi.command('APPLY_SETTINGS',{tabletId:id},payload);}toast('Settings and tablet organization queued.');await refresh();});}
function locationTarget(selectId,tabletSelectId=''){const location=$('#'+selectId)?.value||'ALL LOCATIONS';const tabletId=tabletSelectId?Number($('#'+tabletSelectId)?.value||0):0;return tabletId?{tabletId}:location==='ALL LOCATIONS'?{}:{location};}
function selectedPackagesFromManual(inputId){const manual=$('#'+inputId)?.value.trim();const p=[...state.selectedApps];if(manual&&!p.includes(manual))p.push(manual);if(!p.length)throw new Error('Select or enter at least one application package.');return p;}
function showDeploy(name){$$('.deploy-pane').forEach(x=>x.classList.toggle('active',x.id==='deploy-'+name));}

async function initialize(){try{const access=new URLSearchParams(location.search).get('access');if(access&&!CoinTabApi.hasSession())await CoinTabApi.access(access);if(!CoinTabApi.hasSession())return showLogin();showApp();await refresh();}catch(error){CoinTabApi.logout();showLogin(error.message,true);}}
$('#login-form').onsubmit=event=>{event.preventDefault();busy(event.submitter,async()=>{await CoinTabApi.login($('#email').value.trim(),$('#pin').value.trim());showApp();await refresh();});};$('#logout').onclick=()=>{CoinTabApi.logout();showLogin('Signed out successfully.');};$('#refresh').onclick=()=>busy($('#refresh'),refresh);$('#admin-shortcut').onclick=()=>page('admin');$$('[data-page]').forEach(button=>button.onclick=()=>page(button.dataset.page));['ownInstallLocation','allGamesLocation','updateLocation','uninstallLocation'].forEach(id=>{const e=$('#'+id);if(e)e.onchange=refreshDeployTabletOptions;});
$('#modal-close').onclick=closeModal;$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal();};$('#license-search').oninput=renderLicenses;$$('[data-license-filter]').forEach(button=>button.onclick=()=>setLicenseFilter(button.dataset.licenseFilter));
$$('[data-deploy-tab]').forEach(b=>b.onclick=()=>{
  showDeploy(b.dataset.deployTab);
  if(b.dataset.deployTab==='update'){const e=$('#updateManual');if(e&&e.value.includes('@'))e.value='';}
  if(b.dataset.deployTab==='uninstall'){const e=$('#uninstallManual');if(e&&e.value.includes('@'))e.value='';}
});
$('#reset-location-sales').onclick=()=>busy($('#reset-location-sales'),async()=>{const location=$('#resetSalesLocation').value;const r=await CoinTabApi.resetSales(null,location==='ALL LOCATIONS'?'':location);toast(r.message||'Reset queued');await refresh();});
$('#bulk-update-launcher').onclick=()=>busy($('#bulk-update-launcher'),async()=>{await CoinTabApi.command('UPDATE_LAUNCHER',locationTarget('bulkUpdateLocation'),{});toast('Launcher update queued');});
$('#bulk-appearance').onclick=()=>busy($('#bulk-appearance'),async()=>{await CoinTabApi.command('APPLY_SETTINGS',locationTarget('bulkThemeLocation'),{settings:{uiTheme:Number($('#bulkTheme').value),categoryMode:$('#bulkCategories').checked,dailyThemeRotation:$('#bulkDailyTheme').checked}});toast('Appearance settings queued');});
$('#bulk-network').onclick=()=>busy($('#bulk-network'),async()=>{await CoinTabApi.command('APPLY_SETTINGS',locationTarget('bulkNetworkLocation'),{settings:{blockAdultSites:$('#bulkAdultSites').checked,blockAdDomains:$('#bulkAdDomains').checked,vpnControlsEnabled:$('#bulkShowVpn').checked}});toast('Network protection queued');});
$('#bulk-protected-gmail').onclick=()=>busy($('#bulk-protected-gmail'),async()=>{await CoinTabApi.command('APPLY_SETTINGS',locationTarget('bulkProtectedGmailLocation'),{settings:{protectedGoogleAccount:$('#bulkProtectedGmail').value.trim().toLowerCase()}});toast('Protected Gmail queued');});
$('#load-apps').onclick=renderSourceApps;$('#select-all').onclick=()=>{$$('[data-package]').forEach(box=>{box.checked=true;state.selectedApps.add(box.dataset.package);});};
$('#install-apps').onclick=()=>busy($('#install-apps'),async()=>{await CoinTabApi.command('INSTALL_APPS',locationTarget('ownInstallLocation','ownInstallTablet'),{packages:selectedPackagesFromManual('package')});toast('App installation queued');});
$('#install-all-games').onclick=()=>busy($('#install-all-games'),async()=>{await CoinTabApi.command('INSTALL_APPS',locationTarget('allGamesLocation','allGamesTablet'),{actions:{installAllGames:true},packages:[]});toast('100-game catalog installation queued');});
$('#load-update-apps').onclick=()=>loadDeployAppPicker('update');
$('#update-app-search').oninput=()=>renderDeployAppPicker('update');
$('#update-select-all').onclick=()=>selectVisibleDeployApps('update');
$('#update-clear-selection').onclick=()=>clearDeployApps('update');
$('#update-source-tablet').onchange=()=>loadDeployAppPicker('update');
$('#load-uninstall-apps').onclick=()=>loadDeployAppPicker('uninstall');
$('#uninstall-app-search').oninput=()=>renderDeployAppPicker('uninstall');
$('#uninstall-select-all').onclick=()=>selectVisibleDeployApps('uninstall');
$('#uninstall-clear-selection').onclick=()=>clearDeployApps('uninstall');
$('#uninstall-source-tablet').onchange=()=>loadDeployAppPicker('uninstall');
$('#update-apps').onclick=()=>busy($('#update-apps'),async()=>{
  const packages=selectedDeployPackages('update','updateManual',true);
  const payload=packages.length?{packages}:{all:true};
  await CoinTabApi.command('UPDATE_APPS',locationTarget('updateLocation','updateTablet'),payload);
  toast(packages.length?`Update queued for ${packages.length} selected app(s)`:'Update all apps queued');
});
$('#uninstall-apps').onclick=()=>busy($('#uninstall-apps'),async()=>{
  const packages=selectedDeployPackages('uninstall','uninstallManual',false);
  if(!confirm(`Uninstall ${packages.length} selected app(s) from the selected target?`))return;
  await CoinTabApi.command('UNINSTALL_APPS',locationTarget('uninstallLocation','uninstallTablet'),{packages});
  toast(`Uninstall queued for ${packages.length} selected app(s)`);
});
$('#stop-apps').onclick=()=>busy($('#stop-apps'),async()=>{await CoinTabApi.command('STOP_APP_MAINTENANCE',locationTarget('stopLocation'),{});toast('Stop installation queued');});
$('#email-link').onclick=()=>busy($('#email-link'),async()=>{await CoinTabApi.dashboardLink(true);toast('Dashboard link email requested');});
$('#regenerate-link').onclick=()=>busy($('#regenerate-link'),async()=>{const data=await CoinTabApi.dashboardLink(false);await navigator.clipboard.writeText(data.dashboardUrl);toast('Current permanent dashboard link copied. Token regeneration requires the server regeneration endpoint.');});
$('#signout-all').onclick=()=>{CoinTabApi.logout();showLogin('Signed out on this browser. Server-wide session invalidation requires the account-session endpoint.');};
$('#save-dashboard-settings').onclick=()=>saveDashboardAdmin($('#save-dashboard-settings'));
setInterval(()=>{
  if(CoinTabApi.hasSession()&&!document.hidden){
    refresh().catch(()=>{
      if(!dashboardLastSuccess || Date.now()-dashboardLastSuccess>15000){
        $('#server-pill').className=$('#online-pill').className='pill bad';
      }
    });
  }
},1000);
initialize();
})();
