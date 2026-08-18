// CDP driver for Trash Panda Terror gameplay validation.
// Scenarios: prep | idle | active | shot
// Uses OUR OWN headless Chrome (port 9222) + OUR OWN http server (port 8123).
const CDB = 9333, HTTP = 8123;
const PAGE = 'http://127.0.0.1:' + HTTP + '/index.html';
const OUT = process.env.OUT || '/tmp/tpt-harness/';
import fs from 'node:fs';

let ws, msgId = 0; const pending = new Map();
function connect(url) { return new Promise((res, rej) => { ws = new WebSocket(url); ws.onopen = res; ws.onerror = rej; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }; }); }
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evalJs(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails)); return r.result && r.result.value; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(expr, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evalJs(expr)) return true; } catch (e) {} await sleep(120); } throw new Error('timeout: ' + what); }
async function rect(sel) { return evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,hidden:s.display==="none"}})()`); }
async function click(sel) { await evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e)e.scrollIntoView({block:'center',inline:'center'});return !!e})()`); const r = await rect(sel); if (!r || r.hidden) throw new Error('not clickable: ' + sel); const x = Math.round(r.x), y = Math.round(r.y); await mouse(x, y, 'mouseMoved'); await mouse(x, y, 'mousePressed'); await mouse(x, y, 'mouseReleased'); }
async function mouse(x, y, type, button = 'left') { if (type === 'mousePressed') { try { await evalJs('window.__TRASH_PANDA_TERROR__.scene.updateMatrixWorld(true);true'); } catch (e) {} } await send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button, clickCount: type === 'mousePressed' ? 1 : 0 }); }
const PROJECT = '(()=>{const g=window.__TRASH_PANDA_TERROR__,a=g.gary;if(!a||!a.root.visible)return null;const v=a.root.position.clone().project(g.camera);return{x:(v.x*0.5+0.5)*innerWidth,y:(-v.y*0.5+0.5)*innerHeight}})()';
const SNAP = '(()=>{const g=window.__TRASH_PANDA_TERROR__;if(!g)return null;return{phase:g.state.phase,progress:+g.state.progress.toFixed(3),elapsed:+g.state.elapsed.toFixed(1),garyVisible:!!(g.gary.root.visible),garyState:g.gary.state,gx:+g.gary.root.position.x.toFixed(1),gz:+g.gary.root.position.z.toFixed(1),stolen:+g.stats.stolen.toFixed(3),catFood:+g.stats.catFood.toFixed(3),startles:(g.stats.catStartles||0),fed:g.cats.filter(c=>c.wasFed).length,fedTotal:g.cats.length,raided:g.raidsDone,spr:g.objects.sprinklers.reduce((s,x)=>s+x.userData.triggered,0),hoses:g.nightLog.hoses}})()';
async function freshSave() { await evalJs('localStorage.clear(); location.reload(); true'); await waitFor('!!window.__TRASH_PANDA_TERROR__', 8000, 'boot'); await sleep(700); }
async function goDusk() { await click('#shop-dusk'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="DUSK"', 4000, 'DUSK'); }
async function setSpeed(x) { await evalJs(`window.__TRASH_PANDA_TERROR__.state.speed=${x}; true`); }
async function startNight() { await click('#start-night'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="NIGHT"', 4000, 'NIGHT'); }
async function pollUntilResults(hook, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await snap(); if (!s) { await sleep(60); continue; } if (hook && s.phase === 'NIGHT') await hook(s); if (s.phase === 'RESULTS') return s; await sleep(90); } throw new Error('no RESULTS'); }
async function resultsDom() { return evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__;return{grade:document.querySelector('#result-grade').textContent,chow:(g.lastNight&&g.lastNight.chowEarned)||0,raids:g.raidsDone,fed:document.querySelector('#result-cats').textContent,theft:document.querySelector('#result-theft').textContent,story:document.querySelector('#result-story').textContent}})()`); }
async function fresh() { await connect((await (await fetch('http://127.0.0.1:' + CDB + '/json/new?' + encodeURIComponent(PAGE), { method: 'PUT' })).json()).webSocketDebuggerUrl); await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await waitFor('!!window.__TRASH_PANDA_TERROR__', 8000, 'boot'); }
async function shot() { await waitFor('!!window.__TRASH_PANDA_TERROR__', 8000, 'boot'); await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__;g.state.phase='NIGHT';g.state.progress=0.62;g.state.speed=0;const spots=[['tom',-3,2],['princess',-1,2],['nero',1,2],['gary',3,2]];g.cats.forEach(c=>c.root.visible=false);g.gary.root.visible=false;for(const[id,x,z]of spots){const a=id==='gary'?g.gary:g.cats.find(c=>c.def.id===id);a.root&&(a.root.visible=true,a.root.position.set(x,0,z),a.state='watching')}g.controls.target.set(0,0,1.5);g.controls.update();g.renderer.render(g.scene,g.camera);true})()`); await sleep(250); const cam = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(OUT + 'ident-04.png', Buffer.from(cam.data, 'base64')); console.log('captured ident-04.png'); }
async function doPrep() { await freshSave(); console.log('DBG rect shop-dusk=', JSON.stringify(await rect('#shop-dusk')), 'phase=', await evalJs('window.__TRASH_PANDA_TERROR__.state.phase'), 'shopHidden=', await evalJs('document.querySelector("#shop").classList.contains("hidden")')); await goDusk(); await setSpeed(30); await startNight(); await pollUntilResults(null, 120000); const dom = await resultsDom(); console.log('P1 results shown, grade =', dom.grade); await click('#next-night'); await waitFor('document.querySelector("#results").classList.contains("hidden")', 4000, 'RESULTS hidden'); const shopVisible = await evalJs('!document.querySelector("#shop").classList.contains("hidden")'); console.log('P2 RESULTS hidden =', await evalJs('document.querySelector("#results").classList.contains("hidden")'), ', SHOP visible =', shopVisible); await evalJs(`window.__TRASH_PANDA_TERROR__.prog.chow=999;window.__TRASH_PANDA_TERROR__.ui.refreshShop(window.__TRASH_PANDA_TERROR__.prog,window.__TRASH_PANDA_TERROR__.gary.traits,window.__TRASH_PANDA_TERROR__.lastNight);true`); const before = await evalJs('window.__TRASH_PANDA_TERROR__.prog.upgrades.anchors||0'); await click('.shop-item button'); await sleep(150); const after = await evalJs('window.__TRASH_PANDA_TERROR__.prog.upgrades.anchors||0'); console.log('P3 shop interactive: anchors', before, '->', after); await click('#shop-dusk'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="DUSK"', 4000, 'DUSK(night2)'); console.log('P4 DUSK, night =', await evalJs('window.__TRASH_PANDA_TERROR__.prog.night'), ', tray =', await evalJs('!document.querySelector("#start-night").classList.contains("hidden")')); const shot1 = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + 'prep-fixed.png', Buffer.from(shot1.data, 'base64')); await click('#start-night'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="NIGHT"', 4000, 'NIGHT(night2)'); console.log('P5 Night2 started, sprinklers =', await evalJs('window.__TRASH_PANDA_TERROR__.objects.sprinklers.length'), '(>=2 => starter sprinkler returns)'); }
async function doRun(active) { const B0 = Date.now(); await freshSave(); console.error('T boot+save ' + ((Date.now() - B0) / 1000).toFixed(1) + 's'); await goDusk(); console.error('T dusk ' + ((Date.now() - B0) / 1000).toFixed(1) + 's'); await setSpeed(30); await startNight(); console.error('T night-started ' + ((Date.now() - B0) / 1000).toFixed(1) + 's'); const log = []; let armed = false, sprays = 0, lastTick = -1; const t0 = Date.now(), BUDGET = 20000; while (Date.now() - t0 < BUDGET) { let s; try { s = await snap(); } catch (e) { s = null; } if (s) { if (active && s.phase === 'NIGHT') { log.push(s); if (s.garyVisible) { if (!armed) { try { await click('#build-tray [data-tool="hose"]'); } catch (e) {} armed = true; } const p = await evalJs(PROJECT); if (p) { await mouse(640, 360, 'mousePressed'); await mouse(p.x, p.y, 'mouseMoved'); await mouse(p.x, p.y, 'mouseReleased'); sprays++; } } await sleep(200); } else { log.push(s); } const tk = Math.floor((Date.now() - t0) / 1000); if (tk !== lastTick) { lastTick = tk; console.error('T+' + tk + 's', s.phase, 'elapsed=' + s.elapsed, 'gary=' + s.garyVisible + '/' + s.garyState, 'stolen=' + s.stolen); } if (s.phase === 'RESULTS') break; } else { await sleep(60); } } const garyFirst = log.find(s => s.garyVisible); const results = await resultsDom(); const maxSpr = log.reduce((a, s) => Math.max(a, s.spr), 0); console.log(JSON.stringify({ scenario: active ? 'active' : 'idle', first_gary_elapsed_s: garyFirst ? garyFirst.elapsed : null, gary_reached_food: log.some(s => s.garyState === 'eating'), max_theft_units: Math.max(0, ...log.map(s => s.stolen)), final_theft_pct: results.theft, cats_fed: results.fed, final_grade: results.grade, chow_earned: results.chow, sprinkler_fired_total: maxSpr, saw_gary: !!garyFirst, active_hose_sprays: sprays }, null, 2)); }
async function bounds() { await waitFor('!!window.__TRASH_PANDA_TERROR__', 8000, 'boot'); const r = await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__;g.state.phase='NIGHT';g.state.progress=0.62;g.state.speed=0;const spots=[['tom',-3,2],['princess',-1,2],['nero',1,2],['gary',3,2]];g.cats.forEach(c=>c.root.visible=false);g.gary.root.visible=false;for(const[id,x,z]of spots){const a=id==='gary'?g.gary:g.cats.find(c=>c.def.id===id);if(a){a.root.visible=true;a.root.position.set(x,0,z);a.state='watching'}}g.controls.target.set(0,0,1.5);g.controls.update();g.renderer.render(g.scene,g.camera);const out={};for(const c of g.cats){const p=c.root.position.clone().project(g.camera);out[c.def.id]={x:+((p.x*0.5+0.5)*innerWidth).toFixed(1),y:+((-p.y*0.5+0.5)*innerHeight).toFixed(1)}}const p=g.gary.root.position.clone().project(g.camera);out.gary={x:+((p.x*0.5+0.5)*innerWidth).toFixed(1),y:+((-p.y*0.5+0.5)*innerHeight).toFixed(1)};return out})()`); console.log(JSON.stringify(r)); }
async function bme() { await waitFor('!!window.__TRASH_PANDA_TERROR__', 8000, 'boot'); const r = await evalJs(`(async()=>{const T=await import('http://127.0.0.1:8123/vendor/three/build/three.module.js');const g=window.__TRASH_PANDA_TERROR__,o={};function nm(o){let n=0;o.traverse(x=>{if(x.isMesh)n++});return n}function dim(a){const b=new T.Box3();b.setFromObject(a.root);const s=b.getSize(new T.Vector3());let rings=0;const rig=a.root.userData&&a.root.userData.rig;if(rig&&rig.tail)rings=rig.tail.children.filter(c=>c.material).length;return{w:+s.x.toFixed(2),h:+s.y.toFixed(2),d:+s.z.toFixed(2),m:nm(a.root),tail:rings,coat:a.def.coat}}function lum(c){const r=(c>>16)&255,gg=(c>>8)&255,b=c&255;return Math.round(0.299*r+0.587*gg+0.114*b)}o.tom=dim(g.cats[0]);o.princess=dim(g.cats[1]);o.nero=dim(g.cats[2]);o.gary=dim(g.gary);o.garycoat=('#'+g.gary.def.coat.toString(16).padStart(6,'0'));o.coatLum={tom:lum(g.cats[0].def.coat),princess:lum(g.cats[1].def.coat),nero:lum(g.cats[2].def.coat),gary:lum(g.gary.def.coat)};return o})()`); console.log(JSON.stringify(r, null, 2)); }
async function worldPx(wx, y, z) { return evalJs(`(async()=>{const T=await import('http://127.0.0.1:8123/vendor/three/build/three.module.js');const g=window.__TRASH_PANDA_TERROR__,v=new T.Vector3(${wx},${y},${z}).project(g.camera);return{x:(v.x*0.5+0.5)*innerWidth,y:(-v.y*0.5+0.5)*innerHeight}})()`); }
async function diag() {
  await fresh(); await sleep(200);
  await click('#shop-dusk'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="DUSK"', 4000, 'DUSK');
  await click('#build-tray [data-tool="bowl"]');
  await mouse(900, 430, 'mousePressed'); await mouse(900, 430, 'mouseReleased'); await sleep(160);
  const o = await evalJs(`(()=>{const pts=[[600,300],[600,380],[640,360],[900,430],[700,320]];const out=[];for(const[x,y]of pts){const e=document.elementFromPoint(x,y);out.push({x,y,tag:e?e.tagName:null,id:e?e.id:null,cls:e?String(e.className):null})}return{pts:out,cardVisible:!!document.querySelector('#selection-card')&&!document.querySelector('#selection-card').classList.contains('hidden'),cardHTML:document.querySelector('#selection-card').innerHTML}})()`);
  console.log('DIAG', JSON.stringify(o, null, 2));
}
async function catdiag() {
  await fresh(); await sleep(200);
  await click('#shop-dusk'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="DUSK"', 4000, 'DUSK');
  await click('#build-tray [data-tool="select"]');
  await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__,t=g.cats[0];t.root.visible=true;t.root.position.set(-1,0,6);t.state='watching';true})()`);
  const tp = await worldPx(-1, 0.55, 6);
  const ray = await evalJs(`(async()=>{const T=await import('http://127.0.0.1:8123/vendor/three/build/three.module.js');const g=window.__TRASH_PANDA_TERROR__;const sx=${tp.x},sy=${tp.y};const ndcx=(sx/innerWidth*2-1),ndcy=-(sy/innerHeight*2-1);const r=new T.Raycaster();r.setFromCamera(new T.Vector2(ndcx,ndcy),g.camera);const hits=r.intersectObjects([g.cats[0].root],true);return hits.slice(0,4).map(h=>{let o=h.object;while(o&&!o.userData.agent)o=o.parent;return o&&o.userData.agent?o.userData.agent.def.id:(o?'x:'+o.type+' agent='+(o.userData&&o.userData.agent?1:0):'none')})})()`);
  console.log('CATDIAG tp=', JSON.stringify(tp), 'rayHits=', JSON.stringify(ray));
  await mouse(tp.x, tp.y, 'mousePressed'); await mouse(tp.x, tp.y, 'mouseReleased'); await sleep(160);
  console.log('CATDIAG card=', JSON.stringify(await selCard()));
}
async function selCard() { return evalJs('document.querySelector("#selection-card").innerText||""'); }
async function input() {
  const log = [];
  const ok = (n, c) => { log.push((c ? 'PASS' : 'FAIL') + ' | ' + n); };
  const a = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  await fresh(); await sleep(300);
  await click('#shop-dusk'); await waitFor('window.__TRASH_PANDA_TERROR__.state.phase==="DUSK"', 4000, 'DUSK');
  await click('#build-tray [data-tool="hose"]');
  await mouse(640, 380, 'mousePressed'); await mouse(640, 380, 'mouseReleased'); await sleep(120);
  ok('DUSK hose -> feedback toast', /after nightfall/.test(await evalJs('document.querySelector("#toast-stack").innerText||""')));
  await click('#build-tray [data-tool="bowl"]');
  const before = await evalJs('window.__TRASH_PANDA_TERROR__.objects.bowls.length');
  await mouse(900, 430, 'mousePressed'); await mouse(900, 430, 'mouseReleased'); await sleep(120);
  const after = await evalJs('window.__TRASH_PANDA_TERROR__.objects.bowls.length');
  ok('DUSK place bowl', after === before + 1);
  const bi = after - 1;
  const bp = await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__,o=g.objects.bowls[${bi}],v=new o.position.constructor(o.position.x,0.2,o.position.z).project(g.camera);return{x:(v.x*0.5+0.5)*innerWidth,y:(-v.y*0.5+0.5)*innerHeight}})()`);
  const posBefore = await evalJs(`window.__TRASH_PANDA_TERROR__.objects.bowls[${bi}].position.toArray().join(',')`);
  await mouse(bp.x, bp.y, 'mousePressed'); await mouse(bp.x + 12, bp.y - 16, 'mouseMoved'); await mouse(bp.x + 12, bp.y - 16, 'mouseReleased'); await sleep(150);
  const posAfter = await evalJs(`window.__TRASH_PANDA_TERROR__.objects.bowls[${bi}].position.toArray().join(',')`);
  ok('DUSK drag bowl', posBefore !== posAfter);
  await click('#build-tray [data-tool="select"]');
  await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__,t=g.cats[0];t.root.visible=true;t.root.position.set(-1,0,6);t.state='watching';true})()`);
  const tp = await worldPx(-1, 0.55, 6);
  await mouse(tp.x, tp.y, 'mousePressed'); await mouse(tp.x, tp.y, 'mouseReleased'); await sleep(150);
  ok('Inspect DUSK cat (Old Tom)', /Old Tom/.test(await selCard()));
  await setSpeed(8); await startNight();
  await waitFor('window.__TRASH_PANDA_TERROR__.gary.root.visible', 6000, 'gary spawn');
  await setSpeed(0);
  await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__,c=g.cats.find(c=>c.root.visible);c.root.visible=true;c.root.position.set(-1,0,6);g.gary.root.visible=true;g.gary.root.position.set(1,0,4);g.scene.updateMatrixWorld(true);true})()`);
  const cxp = await worldPx(-1, 0.55, 6);
  await mouse(cxp.x, cxp.y, 'mousePressed'); await mouse(cxp.x, cxp.y, 'mouseReleased'); await sleep(150);
  ok('Inspect NIGHT cat', /(Old Tom|Princess|Nero)/.test(await selCard()));
  const gxp = await worldPx(1, 0.7, 3);
  await mouse(gxp.x, gxp.y, 'mousePressed'); await mouse(gxp.x, gxp.y, 'mouseReleased'); await sleep(150);
  ok('Inspect NIGHT Gary', /GARY/.test(await selCard()));
  await click('#build-tray [data-tool="hose"]');
  await mouse(gxp.x, gxp.y, 'mouseMoved');
  await mouse(gxp.x, gxp.y, 'mousePressed');
  let hFire = false;
  try { await waitFor(`(()=>{const g=window.__TRASH_PANDA_TERROR__;return !!(g.hosing&&g.hoseTarget&&g.objects.hoseAim&&g.objects.hoseAim.visible&&g.objects.splashes.length>0)})()`, 900, 'hose fire'); hFire = true; } catch (e) { hFire = false; }
  ok('hose fires on press (no wiggle)', hFire);
  await mouse(gxp.x + 160, gxp.y - 30, 'mouseMoved'); await sleep(140);
  const ht2 = await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__;return g.hoseTarget?g.hoseTarget.toArray().join(','):null})()`);
  ok('hose follows move', typeof ht2 === 'string' && ht2.length > 0);
  await mouse(45, 45, 'mouseReleased'); await sleep(160);
  const h3 = await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__;return{hosing:g.hosing,ctl:g.controls.enabled,aim:g.objects.hoseAim?g.objects.hoseAim.visible:false}})()`);
  ok('hose release cleanup', h3.hosing === false && h3.ctl === true && h3.aim === false);
  await mouse(gxp.x, gxp.y, 'mousePressed'); await sleep(80);
  await evalJs(`(()=>{const el=document.querySelector('#game canvas');el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}));true})()`);
  await sleep(100);
  const h4 = await evalJs(`(()=>{const g=window.__TRASH_PANDA_TERROR__;return{hosing:g.hosing,ctl:g.controls.enabled}})()`);
  ok('pointercancel cleanup', h4.hosing === false && h4.ctl === true);
  await click('#build-tray [data-tool="select"]');
  const c0 = await evalJs(`window.__TRASH_PANDA_TERROR__.camera.position.toArray().join(',')`);
  await mouse(1000, 280, 'mousePressed'); await mouse(880, 330, 'mouseMoved'); await mouse(880, 330, 'mouseReleased'); await sleep(200);
  const c1 = await evalJs(`window.__TRASH_PANDA_TERROR__.camera.position.toArray().join(',')`);
  ok('camera orbit after hose', c0 !== c1);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 340, deltaX: 0, deltaY: -240 }); await sleep(140);
  const c2 = await evalJs(`window.__TRASH_PANDA_TERROR__.camera.position.toArray().join(',')`);
  ok('wheel zoom after hose', c2 !== c0);
  console.log('INPUT_SCENARIO_RESULTS\n' + log.join('\n'));
  const failed = log.filter(x => x.startsWith('FAIL'));
  console.log('TOTAL ' + (log.length - failed.length) + '/' + log.length + ' passed' + (failed.length ? '\n' + failed.join('\n') : ''));
}
const scenario = process.argv[2] || 'shot';
(async () => { if (scenario === 'input') await input(); else { await fresh(); if (scenario === 'diag') await diag(); else if (scenario === 'catdiag') await catdiag(); else if (scenario === 'shot') await shot(); else if (scenario === 'bounds') await bounds(); else if (scenario === 'bme') await bme(); else if (scenario === 'prep') await doPrep(); else if (scenario === 'idle') await doRun(false); else if (scenario === 'active') await doRun(true); } process.exit(0); })().catch(e => { console.error('FATAL', e); process.exit(1); });
async function snap() { return evalJs(SNAP); }