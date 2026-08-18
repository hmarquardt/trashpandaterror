import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './world/World.js';
import { ObjectManager } from './objects/Objects.js';
import { Agent } from './agents/Agent.js';
import { CAT_DEFS, GARY_DEF, RATINGS } from './data/animals.js';
import { UI } from './ui/UI.js';
import { AudioManager } from './audio/Audio.js';
import { Progression, computeReward, headline as genHeadline, SAVE_KEY } from './systems/Progression.js';
import { NIGHT, RAIDS, TENSION } from './systems/Tuning.js';
import { loadSave, persistSave } from './systems/Save.js';
import { rollTraits, traitEvidenceHints } from './data/gary.js';

const panOf=v=>Math.max(-1,Math.min(1,v/15));

export class Game {
  constructor(container){
    this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071419);this.scene.fog=new THREE.FogExp2(0x071419,.025);
    this.camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);this.camera.position.set(15,15,19);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,-.5);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=11;this.controls.maxDistance=32;this.controls.maxPolarAngle=1.25;this.controls.minPolarAngle=.55;this.controls.minAzimuthAngle=-1.2;this.controls.maxAzimuthAngle=1.2;this.controls.enablePan=true;
    this.saved=loadSave();
    this.prog=new Progression(this.saved.prog||{});
    this.clock=new THREE.Clock();this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.state={phase:'PREP',progress:.025,speed:1,elapsed:0};
    this.stats={catFood:0,stolen:0,adaptation:0,catStartles:0};
    this.world=new World(this.scene);this.objects=new ObjectManager(this.scene);this.objects.setEffects(this.prog.effects());this.ui=new UI();
    this.cats=CAT_DEFS.map(d=>new Agent(d,'cat',this.scene,{trust:typeof this.saved.cats?.[d.id]==='number'?this.saved.cats[d.id]:d.trust}));
    const traits=this.saved.needsPersonality?rollTraits():this.saved.gary.personality||[];
    this.gary=new Agent(GARY_DEF,'raccoon',this.scene,{memory:this.saved.gary.memory||{},traits});
    this.history=this.saved.gary.history||{sprinkler:{total:0,streak:0},side:{east:0,west:0},climbs:{total:0,streak:0},barrier:{total:0,streak:0},bigTheft:0};
    this.selected=null;this.dragging=null;this.hosing=false;this.hoseTimer=0;this.baseTrust=this.averageTrust();this.raidTimer=null;this.raidsTotal=1;this.raidsDone=0;this.raidSeq=0;this.theftNotified=false;this.camPulse=0;this.beatT=0;this.lightFlashed=false;this.firstGaryCallout=false;this.pointerId=null;
    this.nightLog=this.freshNightLog();
    this.setupLights();this.addStars();this.placeDefaults();this.bind();this.animate();
    this.audio=new AudioManager();
    this.ui.showShop(this.prog,this.gary.traits,this.lastNight={raids:0,chowEarned:0,recognition:''});
    if(!this.saved.existed&&this.ui.shouldShowHint())setTimeout(()=>this.ui.showGuideHint(),800);
  }
  freshNightLog(){return {probes:0,bumps:0,reroutes:0,flanks:0,climbs:0,raids:0,hoses:0,munchCats:0,catsFed:[],catStartles:{},contested:false,sideE:0,sideW:0,big:false}}
  averageTrust(){return this.cats.reduce((n,c)=>n+c.def.trust,0)/this.cats.length}
  setupLights(){this.hemi=new THREE.HemisphereLight(0x7890a5,0x152019,1.55);this.scene.add(this.hemi);this.moon=new THREE.DirectionalLight(0xa9c5e9,2.5);this.moon.position.set(-12,18,9);this.moon.castShadow=true;this.moon.shadow.mapSize.set(2048,2048);this.moon.shadow.camera.left=-20;this.moon.shadow.camera.right=20;this.moon.shadow.camera.top=18;this.moon.shadow.camera.bottom=-18;this.moon.shadow.bias=-.0004;this.scene.add(this.moon);this.moonDisc=new THREE.Mesh(new THREE.SphereGeometry(.75,20,14),new THREE.MeshBasicMaterial({color:0xdde8e7}));this.moonDisc.position.set(-19,18,-25);this.scene.add(this.moonDisc)}
  addStars(){const count=500,p=new Float32Array(count*3);for(let i=0;i<count;i++){p[i*3]=(Math.random()-.5)*80;p[i*3+1]=10+Math.random()*30;p[i*3+2]=-15-Math.random()*35}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));this.stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xcfe3e2,size:.06,transparent:true,opacity:.65}));this.scene.add(this.stars)}
  placeDefaults(){this.objects.place('bowl',new THREE.Vector3(-1.2,0,-6.8));this.objects.place('bowl',new THREE.Vector3(1.2,0,-6.8));this.objects.place('barrier',new THREE.Vector3(-4,0,-4.4));
    // Night 1 has NO automatic sprinkler: Gary must be met by the player (hose / their own
    // placement), never silently repelled offscreen. The starter sprinkler returns from Night 2
    // on, once the player has laid eyes on Gary at least once.
    if(this.prog.night>=2){const s=this.objects.place('sprinkler',new THREE.Vector3(-4.2,0,-2.8));if(s)s.rotation.y=.4}}
  resetNight(){
    clearTimeout(this.raidTimer);this.raidTimer=null;this.raidSeq++;
    this.objects.setEffects(this.prog.effects());this.objects.clear();this.placeDefaults();this.objects.applyConfig();
    this.stats={catFood:0,stolen:0,adaptation:0,catStartles:0};
    this.cats.forEach(c=>c.reset());this.gary.reset();this.baseTrust=this.averageTrust();
    this.raidsTotal=Math.min(4,Math.max(1,RAIDS.perNight(this.prog.night)+(this.gary.personality.raidsBias||0)));this.raidsDone=0;this.hoseTimer=0;this.theftNotified=false;this.camPulse=0;this.beatT=0;
    this.nightLog=this.freshNightLog();
    this.state.phase='DUSK';this.state.progress=.025;this.state.elapsed=0;this.state.dawn=0;this.state.speed=Math.min(this.state.speed||1,4);
    this.world.eyes.visible=false;this.ui.resetNightUI();
  }
  bind(){
    addEventListener('resize',()=>this.resize());const el=this.renderer.domElement;el.addEventListener('pointerdown',e=>{this.audio.unlock();this.pointerDown(e)});el.addEventListener('pointermove',e=>this.pointerMove(e));el.addEventListener('pointerup',e=>this.pointerUp(e));el.addEventListener('pointercancel',e=>this.pointerCancel(e));el.addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('keydown',e=>{this.audio.unlock();if(e.key==='Escape'){if(this.ui.guideOpen)this.ui.hideGuide();return}if(this.ui.guideOpen)return;if(e.code==='Space'){e.preventDefault();if(this.state.phase==='DUSK')this.startNight()}if(e.key==='`')document.querySelector('#dev-panel').classList.toggle('hidden');const map={1:'select',2:'bowl',3:'barrier',4:'sprinkler',h:'hose',H:'hose'};if(map[e.key]){if(this.state.phase!=='PREP')this.ui.setTool(map[e.key])}});
    this.ui.on('start',()=>{if(this.state.phase==='DUSK')this.startNight()});
    this.ui.on('shop-dusk',()=>this.beginDusk());
    this.ui.on('buy',id=>this.buy(id));
    this.ui.on('shop',()=>this.openPrep());
    this.ui.on('reset',()=>this.resetSave());
    this.ui.on('gary',()=>{if(!this.gary.active){this.gary.spawn(1,[-9,-8]);if(this.state.phase!=='NIGHT'){this.state.phase='NIGHT';this.state.progress=.3;this.state.elapsed=20}}});
    this.ui.on('speed',b=>{this.state.speed=this.state.speed===1?4:1;b.textContent=`Speed ×${this.state.speed===1?4:1}`});
    this.ui.on('chow',()=>{this.prog.addChow(50);this.ui.refreshShop(this.prog,this.gary.traits,this.lastNight);});
    this.ui.on('time',v=>{this.state.progress=v;if(v<.12){this.state.phase='DUSK'}else if(v<.9){this.state.phase='NIGHT';this.state.elapsed=Math.max(0,(v-.13)/.75*NIGHT.duration);this.spawnCats();if(!this.gary.active)this.scheduleFirstRaid()}else{this.state.phase='DAWN';this.state.dawn=Math.max(0,(v-.88)/.12*NIGHT.dawn)}});
  }
  resetSave(){if(window.confirm('Reset ALL Trash Panda Terror progress? This clears your save and reloads.')){try{localStorage.removeItem(SAVE_KEY)}catch{}location.reload()}}
  buy(id){if(this.prog.purchase(id)){const e=this.prog.effects();this.objects.setEffects(e);if(id==='platform')this.objects.rebuildBowls();else this.objects.applyConfig();this.persistSave();this.ui.refreshShop(this.prog,this.gary.traits,this.lastNight);this.ui.toast('UPGRADED',`${this.prog.info(id).name} → level ${this.prog.level(id)}`);this.audio.play('chow')}else this.ui.toast('BROKE','Not enough chow for that one.')}
  persistSave(){persistSave({cats:{tom:this.cats[0].def.trust,princess:this.cats[1].def.trust,nero:this.cats[2].def.trust},garyMemory:this.gary.memory,garyPersonality:this.gary.traits,garyHistory:this.history,prog:{chow:this.prog.chow,night:this.prog.night,upgrades:this.prog.upgrades,bestRating:this.prog.bestRating}})}
  beginDusk(){this.resetNight();this.ui.hideShop();this.ui.toast('DUSK','Set up the yard, then start the night when ready.')}
  openPrep(){this.prog.nextNight();this.state.phase='PREP';this.ui.showShop(this.prog,this.gary.traits,this.lastNight)}
  mouse(e){const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);this.raycaster.setFromCamera(this.pointer,this.camera)}
  rootItem(o){while(o&&o!==this.scene){if(o.userData?.type)return o;o=o.parent}return null}
  groundPoint(e){this.mouse(e);const hit=this.raycaster.intersectObject(this.world.interactables[0])[0];return hit?.point}
  pointerCapture(e){this.pointerId=e.pointerId;try{this.renderer.domElement.setPointerCapture(e.pointerId)}catch{}}
  releaseCapture(){if(this.pointerId!=null){try{this.renderer.domElement.releasePointerCapture(this.pointerId)}catch{}this.pointerId=null}}
  itemAt(e){const hits=this.raycaster.intersectObjects(this.objects.items,true);const item=hits.length?this.rootItem(hits[0].object):null;return item}
  animalAt(e){const ah=this.raycaster.intersectObjects([...this.cats,this.gary].map(a=>a.root),true);if(!ah.length)return null;let o=ah[0].object;while(o&&!o.userData.agent)o=o.parent;return o&&o.userData.agent?o.userData.agent:null}
  inspectAnimal(a){if(a.type==='cat')this.ui.inspectCat(a);else this.ui.inspectGary(a,this.garyInspectLine())}
  garyInspectLine(){const L=this.nightLog;if(this.state.phase==='NIGHT'&&this.gary.active)return 'Raccoon · currently raiding the yard';if(this.nightLog.hoses>0)return 'Raccoon · not a fan of the hose.';if(L.probes>0)return 'Raccoon · keeps testing the sprinkler line.';if(L.climbs>0)return 'Raccoon · climbed the feeding deck.';if(L.flanks>0)return 'Raccoon · slips in through the bushes.';if(L.bumps>0)return 'Raccoon · tried his luck at the barrier.';return 'Raccoon · he is out here every night. Watch the bowls.'}
  endAction(){this.dragging=null;this.hosing=false;this.hoseTarget=null;this.controls.enabled=true;this.objects.setHoseAim(null,(this.prog.effects()||{}).hoseRange||1.35);this.releaseCapture()}
  pointerCancel(){this.endAction()}
  pointerDown(e){this.mouse(e);this.controls.enabled=true;const tool=this.ui.tool,night=this.state.phase==='NIGHT',dusk=this.state.phase==='DUSK';
    if(tool==='hose'){
      if(!night){this.ui.toast('HOSE','HOSE — available after nightfall');return}
      this.pointerCapture(e);this.hosing=true;this.controls.enabled=false;const p=this.groundPoint(e);if(p)this.hoseTarget=p;return;
    }
    if(tool==='select'){
      const a=this.animalAt(e);if(a){this.pointerCapture(e);this.controls.enabled=false;this.inspectAnimal(a);return}
      const item=this.itemAt(e);if(item){this.selected=item;this.ui.select(item);if(dusk){this.pointerCapture(e);this.dragging=item;this.controls.enabled=false}return}return;
    }
    if(dusk&&['bowl','barrier','sprinkler'].includes(tool)){
      const item=this.itemAt(e);if(item){this.pointerCapture(e);this.dragging=item;this.selected=item;this.controls.enabled=false;this.ui.select(item);return}
      const p=this.groundPoint(e);if(p){const placed=this.objects.place(tool,p);if(placed){this.audio.play('bowl');this.selected=placed;this.ui.select(placed)}else this.ui.toast('BUILD LIMIT','That is all you have tonight.')}return;
    }
    if(['bowl','barrier','sprinkler'].includes(tool)){this.ui.toast(tool.toUpperCase(),`${tool} — place it during DUSK`);return}
  }
  pointerMove(e){if(!this.dragging&&!this.hosing)return;const p=this.groundPoint(e);if(this.dragging&&p){this.dragging.position.x=THREE.MathUtils.clamp(p.x,-14,14);this.dragging.position.z=THREE.MathUtils.clamp(p.z,-7.8,11.5)}if(this.hosing&&p)this.hoseTarget=p}
  pointerUp(){this.endAction()}
  spawnCats(){this.cats.forEach((c,i)=>c.spawn(2+i*4))}
  scheduleFirstRaid(){this.scheduleRaid(RAIDS.firstDelay(this.prog.night))}
  startNight(){if(this.state.phase!=='DUSK')return;this.ui.markHintSeen();this.audio.startAmbient();this.state.phase='NIGHT';this.state.progress=NIGHT.progressStart;this.state.elapsed=0;this.spawnCats();this.scheduleFirstRaid();this.ui.nightMode();this.ui.toast('NIGHT FALLS','Crickets rise. Something rustles behind the shed.')}
  scheduleRaid(delay){const seq=++this.raidSeq;clearTimeout(this.raidTimer);this.raidTimer=setTimeout(()=>{if(seq!==this.raidSeq)return;this.launchRaid()},Math.max(.5,delay)*1000/this.state.speed)}
  launchRaid(){clearTimeout(this.raidTimer);this.raidTimer=null;if(!['NIGHT','DAWN'].includes(this.state.phase))return;if(this.gary.active)return;const from=this.raidsDone===0?[-9,-8]:this.randSpawn();if(this.state.phase==='NIGHT'&&!this.gary.root.visible)this.world.eyes.visible=true;this.world.rustleBush(from[0],from[1]);this.gary.spawn(1,from)}
  randSpawn(){return [[-9,-8],[8,-7],[11,5],[-13,10],[10,-6]][Math.floor(Math.random()*5)]}
  alarm(){this.alarmTimer=.85;const el=document.getElementById('alarm');if(el){el.classList.add('on');clearTimeout(this._alarmTO);this._alarmTO=setTimeout(()=>el.classList.remove('on'),850)}}
  // The "Gary found the gap" tension beat: brief damped time + a sting + food scatter.
  breakthrough(g,strong){this.objects.foodToss(g.root.position);this.audio.play('bowl');if(strong&&!this.beatT){this.beatT=TENSION.beatDuration;this.camPulse=Math.max(this.camPulse,.9);this.audio.play('sting',panOf(g.root.position.x))}else{this.camPulse=Math.max(this.camPulse,.45)}this.audio.play('deter')}
  recognitionLine(){const h=this.history,parts=[];const side=h.side.east>h.side.west?'east':'west';if(h.sprinkler.streak>=2)parts.push(`sprinkler: ${h.sprinkler.streak} nights running`);if(h.climbs.total>=2)parts.push('deck: routine');if(h.side.east+h.side.west>=2)parts.push(`favorite side: ${side}`);if(h.bigTheft>=2)parts.push('knows the buffet hours');return parts.slice(0,1).join(' · ')}
  context(){const g=this.gary,L=this.nightLog,self=this;
    return {objects:this.objects,stats:this.stats,effects:this.prog.effects(),night:this.prog.night,
      onFed:c=>{L.catsFed.push(c.def.id);c.def.trust+={tom:2,princess:5,nero:2}[c.def.id]||2;this.audio.play('cat');this.ui.toast(c.def.name.toUpperCase(),'Fed and feeling safer here.');this.ui.showThought(c,'♥ safe',this.camera)},
      onBowl:c=>this.audio.play('bowl'),
      onMunch:c=>this.audio.play(Math.random()<.5?'munch':'munch2'),
      onStep:a=>this.audio.play(a.type==='raccoon'?'step':'step',panOf(a.root.position.x)),
      onAnchored:gg=>{this.audio.play('tug',panOf(gg.root.position.x));this.ui.showThought(gg,'won’t budge',this.camera)},
      onGarySeen:gg=>{this.world.eyes.visible=false;this.world.rustleBush(gg.root.position.x,gg.root.position.z);this.audio.play('rustle',panOf(gg.root.position.x));this.ui.toast('GARY','Gary has entered the yard. He looks confident.');this.ui.showThought(gg,'food?',this.camera);this.camPulse=Math.max(this.camPulse,.5);this.alarm();if(this.prog.night===1&&!this.firstGaryCallout){this.firstGaryCallout=true;this.ui.calloutGary(gg,this.camera)}},
      onBarrier:gg=>{L.bumps++;L.contested=true;this.audio.play('bump');this.objects.bumpDust(gg.root.position);this.ui.showThought(gg,'dang fence',this.camera)},
      onReroute:gg=>{L.reroutes++;L.contested=true;this.ui.showThought(gg,'around it is',this.camera)},
      onProbe:gg=>{L.probes++;L.contested=true;this.audio.play('deter');this.ui.showThought(gg,'got a bead on this…',this.camera)},
      onCover:gg=>{L.flanks++;L.contested=true;this.audio.play('rustle');this.ui.showThought(gg,'cover',this.camera)},
      onClimb:gg=>{L.climbs++;L.contested=true;this.audio.play('climb');this.ui.showThought(gg,'climbing…',this.camera);this.ui.toast('GARY CLIMBS','He hauled himself up onto the feeding deck.')},
      onLight:gg=>{this.ui.toast('FLOODLIGHT','The porch light flares. Gary hesitates in the glare.');this.ui.showThought(gg,'ah, light',this.camera);this.camPulse=Math.max(this.camPulse,.3);this.audio.play('light')},
      onSprayed:(a,manual)=>{this.audio.play('spray');if(a.type==='cat'){const loss=(1-a.def.noiseTolerance)*4;a.def.trust-=loss;this.stats.catStartles=(this.stats.catStartles||0)+1;L.catStartles[a.def.id]=(L.catStartles[a.def.id]||0)+1;this.ui.showThought(a,'!!',this.camera)}else{L.contested=true;this.ui.showThought(a,manual?'RUDE':'noted.',this.camera)}},
      onTheft:gg=>{if(gg.root.position.x>=0)L.sideE++;else L.sideW++;if(!this.theftNotified){this.theftNotified=true;this.ui.toast('THEFT IN PROGRESS','Gary has reached the food! Use the hose.');this.ui.showThought(gg,'jackpot',this.camera);self.breakthrough(gg,L.contested)}else{self.breakthrough(gg,L.contested)}},
      onGaryLeft:()=>{this.raidsDone++;this.world.eyes.visible=false;if(this.raidsDone<this.raidsTotal&&['NIGHT','DAWN'].includes(this.state.phase))this.scheduleRaid(RAIDS.gap())}};
  }
  hose(dt){const fx=this.prog.effects();this.objects.setHoseAim(this.hosing&&this.state.phase==='NIGHT'&&this.hoseTarget?this.hoseTarget:null,fx.hoseRange);if(!this.hosing||!this.hoseTarget||this.state.phase!=='NIGHT')return;
    // Legible aim: while the player holds water down, gloss anything standing in the splash zone
    // so friendly fire is a *choice*, never a confusing accident. Hitting cats stays allowed.
    for(const a of [...this.cats,this.gary])if(a.root.visible&&a.root.position.distanceTo(this.hoseTarget)<fx.hoseRange+.3)a.flashHit();
    this.hoseTimer-=dt;if(this.hoseTimer<=0){this.hoseTimer=.045;const origin=new THREE.Vector3(5,.35,-7),fxb=this.prog.effects();this.objects.sprayHose(origin,this.hoseTarget);for(const a of [...this.cats,this.gary])if(a.root.visible&&a.root.position.distanceTo(this.hoseTarget)<fxb.hoseRange){const pan=panOf(a.root.position.x),dir=a.root.position.clone().sub(origin).setY(0);if(dir.lengthSq()<0.0001)dir.set(0,0,1);dir.normalize();a.root.position.addScaledVector(dir,0.12*fxb.hoseForce);a.hopT=Math.max(a.hopT,.22);a.flashHit();this.objects.impactSplash(a.root.position,fxb.hoseForce);if(a.type==='raccoon'){a.memory.hose+=1;this.stats.adaptation+=1;this.nightLog.hoses++;this.camPulse=Math.max(this.camPulse,.25);this.audio.play('splash',pan)}else this.stats.catStartles=(this.stats.catStartles||0)+1;a.fleeFrom(this.hoseTarget,.9*fxb.hoseForce,Math.max(1,fxb.hoseForce),dir);this.context().onSprayed(a,true)}}}
  deriveObservations(){const L=this.nightLog,out=[],h=this.history;const sideOf=x=>x<0?'west':'east';
    if(L.probes>0)out.push(`Gary tested the ${sideOf(this.objects.sprinklers[0]?.position.x??0)} sprinkler boundary ${L.probes}× tonight.`);
    for(const c of this.cats){const n=L.catStartles[c.def.id]||0;if(n>0&&!c.wasFed)out.push(`${c.def.name} was startled ${n}× before ever finishing a bowl.`);else if(n>1)out.push(`${c.def.name} got washed ${n}× tonight.`);}
    let wl=null,px=0;for(const b of this.objects.bowls){const st=b.userData.stolen||0;if(st>px){px=st;wl=b}}if(wl&&px>(wl.userData.full||1)*.3)out.push(`The ${sideOf(wl.position.x)} bowl lost ${Math.round(px/((wl.userData.full||1))*100)}% of its food.`);
    if(L.flanks>1)out.push(`Gary kept busy slipping in through the bushes (${L.flanks}×).`);
    if(L.climbs>0)out.push(`Gary breezed up the feeding deck ${L.climbs}× to reach the spoils.`);
    if(L.reroutes>1)out.push('Gary hauled around the barrier on his later visits — the fence stopped holding him.');
    if(L.raids>1&&L.probes===0&&L.flanks===0)out.push(`Gary came back ${L.raids} times before dawn, and each time he knew the way in.`);
    if(h.sprinkler.streak>=3)out.push(`He’s probed that same sprinkler line ${h.sprinkler.streak} nights running.`);
    if(h.sprinkler.total>=3&&L.probes===0)out.push('He didn’t even bother testing the sprinkler tonight. He just walked around it.');
    if(h.climbs.streak>=2)out.push(`${h.climbs.streak} straight nights of deck climbing — he expects it now.`);
    const em=h.side.east,hw=h.side.west;if(Math.max(em,hw)>=3)out.push(`Gary clearly prefers the ${em>hw?'eastern':'western'} of the yard.`);
    const seen=L.probes+L.flanks+L.climbs+L.bumps+L.reroutes;
    if(seen>=3&&this.gary.traits.length){const hints=traitEvidenceHints(this.gary.traits,{probes:L.probes,flanks:L.flanks,climbs:L.climbs,bumps:L.bumps,reroutes:L.reroutes});out.push(`OBSERVE: Gary ${hints[0]} this season.`)}
    return out.slice(0,3);}
  finish(){if(this.state.phase==='RESULTS')return;this.state.phase='RESULTS';this.finishedThisNight=true;this.audio.stop();this.world.eyes.visible=false;clearTimeout(this.raidTimer);this.gary.active=false;this.gary.root.visible=false;this.gary.state='gone';const h=this.history;h.sprinkler.total+=this.nightLog.probes;h.sprinkler.streak=this.nightLog.probes>0?h.sprinkler.streak+1:0;h.side.east+=this.nightLog.sideE;h.side.west+=this.nightLog.sideW;h.climbs.total+=this.nightLog.climbs;h.climbs.streak=this.nightLog.climbs>0?h.climbs.streak+1:0;if(this.stats.stolen>.6)h.bigTheft+=1;const endTrust=this.averageTrust(),delta=endTrust-this.baseTrust,served=this.objects.bowls.length;const rw=computeReward(this.prog.night,this.stats,this.cats,endTrust,delta,served);this.prog.addChow(rw.total);const foodTotal=Math.max(.001,this.stats.catFood+this.stats.stolen);const defense=Math.round((this.stats.catFood/foodTotal)*70+(this.cats.filter(c=>c.wasFed).length/3)*30);const rating=RATINGS.find(r=>defense>=r.min);this.prog.setBest(rating.grade);this.lastNight={raids:this.raidsDone,chowEarned:rw.total,recognition:this.recognitionLine()};const obs=this.deriveObservations();const story=genHeadline(this.prog.night,this.stats,this.cats,rw,{raids:this.raidsDone,climbs:this.nightLog.climbs});this.persistSave();this.audio.play('dawn');this.ui.finish({...this.stats,catFood:this.stats.catFood/served,stolen:this.stats.stolen/served},this.cats,delta,rw,this.prog,rating,story,obs)}
  update(dt){let tscale=1;if(this.beatT>0){this.beatT-=dt;tscale=TENSION.timeScale}const speedDt=dt*this.state.speed*tscale;if(this.state.phase==='NIGHT'){this.state.elapsed+=speedDt;this.state.progress=NIGHT.progressStart+this.state.elapsed/NIGHT.duration*(NIGHT.progressEnd-NIGHT.progressStart);if(this.state.progress>=NIGHT.progressEnd){this.state.phase='DAWN';this.state.dawn=0;this.audio.play('dawn');this.ui.toast('DAWN','The yard is still. Time to count the bowls.')}}else if(this.state.phase==='DAWN'){this.state.dawn+=speedDt;this.state.progress=NIGHT.progressEnd+Math.min(.12,this.state.dawn/NIGHT.dawn*.12);if(this.state.dawn>NIGHT.dawn)this.finish()}let nightness=.45;if(this.state.phase==='NIGHT')nightness=Math.min(1,.55+this.state.progress);else if(this.state.phase==='DAWN'||this.state.phase==='RESULTS')nightness=Math.max(.25,1-(this.state.progress-.88)*5);else if(this.state.phase==='PREP')nightness=.5;this.scene.background.setRGB(.025+.08*(1-nightness),.07+.055*(1-nightness),.085+.07*(1-nightness));this.scene.fog.color.copy(this.scene.background);this.hemi.intensity=.75+(.8*(1-nightness));this.moon.intensity=1.7+nightness*.8;this.renderer.toneMappingExposure=.92+(1-nightness)*.23;this.world.update(this.clock.elapsedTime,nightness);this.objects.update(dt);if(this.state.phase==='NIGHT'||this.state.phase==='DAWN'){const ctx=this.context();this.cats.forEach(c=>c.update(speedDt,ctx));this.gary.update(speedDt,ctx);this.checkSprinklers(ctx)}this.hose(dt);this.camPulse=Math.max(0,this.camPulse-dt*1.6);this.camera.fov=42+this.camPulse*4;this.camera.updateProjectionMatrix();const _srv=this.objects.bowls.length;this.ui.update(this.state,this.objects,this.averageTrust(),this.prog,this.lastNight,{fed:this.cats.filter(c=>c.wasFed).length,fedTotal:this.cats.length,stolenFrac:_srv>0?this.stats.stolen/_srv:0,garyActive:this.gary.active&&this.gary.root.visible})}
  checkSprinklers(ctx){for(const s of this.objects.sprinklers){if(s.userData.cooldown>0)continue;let catIn=false;for(const c of this.cats){if(this.state.elapsed-(c.lastSprayedAt??-99)<12)continue;if(c.root.visible&&c.root.position.distanceTo(s.position)<s.userData.radius){if(s.userData.catAware){catIn=true;s.userData.spare=.45;this.audio.play('safe');}else{c.lastSprayedAt=this.state.elapsed;this.stats.catStartles=(this.stats.catStartles||0)+1;this.nightLog.catStartles[c.def.id]=(this.nightLog.catStartles[c.def.id]||0)+1;this.objects.triggerSprinkler(s);c.rememberSprinkler(s);c.fleeFrom(s.position,1);ctx.onSprayed(c,false);this.ui.toast('FRIENDLY FIRE',`${c.def.name} was startled by the sprinkler.`);}break}}if(catIn)continue}}
  animate=()=>{requestAnimationFrame(this.animate);const dt=Math.min(.05,this.clock.getDelta());this.update(dt);this.controls.update();this.renderer.render(this.scene,this.camera)}
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)}
}
