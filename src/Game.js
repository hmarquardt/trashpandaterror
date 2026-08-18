import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World } from './world/World.js';
import { ObjectManager } from './objects/Objects.js';
import { Agent } from './agents/Agent.js';
import { CAT_DEFS, GARY_DEF, RATINGS } from './data/animals.js';
import { UI } from './ui/UI.js';
import { AudioManager } from './audio/Audio.js';
import { Progression, computeReward, headline as genHeadline } from './systems/Progression.js';

export class Game {
  constructor(container){
    this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071419);this.scene.fog=new THREE.FogExp2(0x071419,.025);
    this.camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);this.camera.position.set(15,15,19);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,-.5);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=11;this.controls.maxDistance=32;this.controls.maxPolarAngle=1.25;this.controls.minPolarAngle=.55;this.controls.minAzimuthAngle=-1.2;this.controls.maxAzimuthAngle=1.2;this.controls.enablePan=true;
    this.persisted=this.load();
    this.prog=new Progression(this.persisted.prog||{});
    this.clock=new THREE.Clock();this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.state={phase:'PREP',progress:.025,speed:1,elapsed:0};
    this.stats={catFood:0,stolen:0,adaptation:0,catStartles:0};
    this.world=new World(this.scene);this.objects=new ObjectManager(this.scene);this.objects.setEffects(this.prog.effects());this.ui=new UI();
    this.cats=CAT_DEFS.map(d=>new Agent(d,'cat',this.scene,{trust:this.persisted.cats?.[d.id]??d.trust}));
    this.gary=new Agent(GARY_DEF,'raccoon',this.scene,{memory:this.persisted.gary?.memory||{}});
    this.selected=null;this.dragging=null;this.hosing=false;this.hoseTimer=0;this.baseTrust=this.averageTrust();this.raidTimer=null;this.raidsTotal=1;this.raidsDone=0;this.theftNotified=false;
    this.setupLights();this.addStars();this.placeDefaults();this.bind();this.animate();
    this.audio=new AudioManager();
    this.ui.showShop(this.prog);
    setTimeout(()=>this.ui.toast('PROVISIONS','Spend Chow wisely. Then head out at dusk and earn it back.'),600);
  }
  load(){try{return JSON.parse(localStorage.getItem('trashPandaTerror.save'))||{}}catch{return {}}}
  save(){const cats={};this.cats.forEach(c=>cats[c.def.id]=c.def.trust);localStorage.setItem('trashPandaTerror.save',JSON.stringify({cats,gary:{memory:this.gary.memory},prog:{chow:this.prog.chow,night:this.prog.night,upgrades:this.prog.upgrades,bestRating:this.prog.bestRating}}))}
  averageTrust(){return this.cats.reduce((n,c)=>n+c.def.trust,0)/this.cats.length}
  setupLights(){this.hemi=new THREE.HemisphereLight(0x7890a5,0x152019,1.55);this.scene.add(this.hemi);this.moon=new THREE.DirectionalLight(0xa9c5e9,2.5);this.moon.position.set(-12,18,9);this.moon.castShadow=true;this.moon.shadow.mapSize.set(2048,2048);this.moon.shadow.camera.left=-20;this.moon.shadow.camera.right=20;this.moon.shadow.camera.top=18;this.moon.shadow.camera.bottom=-18;this.moon.shadow.bias=-.0004;this.scene.add(this.moon);this.moonDisc=new THREE.Mesh(new THREE.SphereGeometry(.75,20,14),new THREE.MeshBasicMaterial({color:0xdde8e7}));this.moonDisc.position.set(-19,18,-25);this.scene.add(this.moonDisc)}
  addStars(){const count=500,p=new Float32Array(count*3);for(let i=0;i<count;i++){p[i*3]=(Math.random()-.5)*80;p[i*3+1]=10+Math.random()*30;p[i*3+2]=-15-Math.random()*35}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));this.stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xcfe3e2,size:.06,transparent:true,opacity:.65}));this.scene.add(this.stars)}
  placeDefaults(){this.objects.place('bowl',new THREE.Vector3(-1.2,0,-6.8));this.objects.place('bowl',new THREE.Vector3(1.2,0,-6.8));this.objects.place('barrier',new THREE.Vector3(-4,0,-4.4));const s=this.objects.place('sprinkler',new THREE.Vector3(3.8,0,-3.2));s.rotation.y=.4}
  resetNight(){
    clearTimeout(this.raidTimer);this.raidTimer=null;
    this.objects.setEffects(this.prog.effects());this.objects.clear();this.placeDefaults();
    this.stats={catFood:0,stolen:0,adaptation:0,catStartles:0};
    this.cats.forEach(c=>c.reset());this.gary.reset();this.baseTrust=this.averageTrust();
    this.raidsTotal=Math.min(3,1+Math.floor((this.prog.night-1)/2));this.raidsDone=0;this.hoseTimer=0;this.theftNotified=false;
    this.state.phase='DUSK';this.state.progress=.025;this.state.elapsed=0;this.state.dawn=0;this.state.speed=Math.min(this.state.speed||1,4);
    this.world.eyes.visible=false;this.ui.resetNightUI();
  }
  bind(){
    addEventListener('resize',()=>this.resize());const el=this.renderer.domElement;el.addEventListener('pointerdown',e=>this.pointerDown(e));el.addEventListener('pointermove',e=>this.pointerMove(e));el.addEventListener('pointerup',e=>this.pointerUp(e));el.addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();if(this.state.phase==='DUSK')this.startNight()}if(e.key==='`')document.querySelector('#dev-panel').classList.toggle('hidden');const map={1:'select',2:'bowl',3:'barrier',4:'sprinkler',h:'hose',H:'hose'};if(map[e.key]){if(this.state.phase!=='PREP')this.ui.setTool(map[e.key])}});
    this.ui.on('start',()=>{if(this.state.phase==='DUSK')this.startNight()});
    this.ui.on('shop-dusk',()=>this.beginDusk());
    this.ui.on('buy',id=>this.buy(id));
    this.ui.on('shop',()=>this.openPrep());
    this.ui.on('gary',()=>{if(!this.gary.active){this.gary.spawn(1,[-9,-8]);if(this.state.phase!=='NIGHT'){this.state.phase='NIGHT';this.state.progress=.3;this.state.elapsed=20}}});
    this.ui.on('speed',b=>{this.state.speed=this.state.speed===1?4:1;b.textContent=`Speed ×${this.state.speed===1?4:1}`});
    this.ui.on('time',v=>{this.state.progress=v;if(v<.12){this.state.phase='DUSK'}else if(v<.9){this.state.phase='NIGHT';this.state.elapsed=Math.max(0,(v-.13)/.75*115);this.spawnCats();if(!this.gary.active)this.scheduleRaid(this.firstRaidDelay())}else{this.state.phase='DAWN';this.state.dawn=Math.max(0,(v-.88)/.12*5)}});
  }
  buy(id){if(this.prog.purchase(id)){this.save();this.objects.setEffects(this.prog.effects());this.objects.applyConfig();this.ui.refreshShop(this.prog);this.ui.toast('UPGRADED',`${this.prog.info(id).name} → level ${this.prog.level(id)}`)}else this.ui.toast('BROKE','Not enough chow for that one.')}
  beginDusk(){this.resetNight();this.ui.hideShop();this.ui.toast('DUSK','Set up the yard, then start the night when ready.')}
  openPrep(){this.prog.nextNight();this.state.phase='PREP';this.ui.showShop(this.prog)}
  mouse(e){const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);this.raycaster.setFromCamera(this.pointer,this.camera)}
  rootItem(o){while(o&&o!==this.scene){if(o.userData?.type)return o;o=o.parent}return null}
  groundPoint(e){this.mouse(e);const hit=this.raycaster.intersectObject(this.world.interactables[0])[0];return hit?.point}
  pointerDown(e){this.mouse(e);if(this.ui.tool==='hose'&&this.state.phase==='NIGHT'){this.audio.unlock();this.hosing=true;this.controls.enabled=false;return}const hits=this.raycaster.intersectObjects(this.objects.items,true);const item=hits.length?this.rootItem(hits[0].object):null;if(item&&(this.state.phase==='DUSK'||this.ui.tool==='select')){if(this.state.phase==='DUSK'){this.dragging=item;this.controls.enabled=false}this.selected=item;this.ui.select(item);return}
    const ah=this.raycaster.intersectObjects(this.cats.map(c=>c.root),true);if(ah.length&&this.state.phase==='DUSK'){let o=ah[0].object;while(o&&!o.userData.agent)o=o.parent;if(o.userData.agent?.type==='cat'){this.ui.inspectCat(o.userData.agent);return}}
    const p=this.groundPoint(e);if(p&&this.state.phase==='DUSK'&&['bowl','barrier','sprinkler'].includes(this.ui.tool)){const placed=this.objects.place(this.ui.tool,p);if(placed){this.audio.play('bowl');this.selected=placed;this.ui.select(placed)}else this.ui.toast('BUILD LIMIT','That is all you have tonight.')}}
  pointerMove(e){if(!this.dragging&&!this.hosing)return;const p=this.groundPoint(e);if(this.dragging&&p){this.dragging.position.x=THREE.MathUtils.clamp(p.x,-14,14);this.dragging.position.z=THREE.MathUtils.clamp(p.z,-7.8,11.5)}if(this.hosing&&p){this.hoseTarget=p}}
  pointerUp(){this.dragging=null;this.hosing=false;this.controls.enabled=true}
  firstRaidDelay(){return Math.max(4,13-(this.prog.night-1)*1.4+Math.random()*4)}
  spawnCats(){this.cats.forEach((c,i)=>c.spawn(2+i*4))}
  startNight(){if(this.state.phase!=='DUSK')return;this.audio.startAmbient();this.state.phase='NIGHT';this.state.progress=.13;this.state.elapsed=0;this.spawnCats();this.scheduleRaid(this.firstRaidDelay());this.ui.nightMode();this.ui.toast('NIGHT FALLS','Crickets rise. Something rustles behind the shed.')}
  scheduleRaid(delay){clearTimeout(this.raidTimer);this.raidTimer=setTimeout(()=>this.launchRaid(),(delay||8)*1000/this.state.speed)}
  launchRaid(){clearTimeout(this.raidTimer);this.raidTimer=null;if(!['NIGHT','DAWN'].includes(this.state.phase))return;if(this.gary.active)return;const from=this.raidsDone===0?[-9,-8]:this.randSpawn();if(this.state.phase==='NIGHT'&&!this.gary.root.visible)this.world.eyes.visible=true;this.gary.spawn(1,from)}
  randSpawn(){return [[-9,-8],[8,-7],[11,5],[-13,10],[10,-6]][Math.floor(Math.random()*5)]}
  context(){const g=this.gary;
    return {objects:this.objects,stats:this.stats,effects:this.prog.effects(),night:this.prog.night,
      onFed:c=>{c.def.trust+=c.def.id==='princess'?5:2;this.audio.play('cat');this.ui.toast(c.def.name.toUpperCase(),'Fed and feeling safer here.');this.ui.showThought(c,'♥ safe',this.camera)},
      onGarySeen:gg=>{this.world.eyes.visible=false;this.audio.play('rustle');this.ui.toast('GARY','Gary has entered the yard. He looks confident.');this.ui.showThought(gg,'food?',this.camera)},
      onSprayed:(a,manual)=>{this.audio.play('spray');if(a.type==='cat'){const loss=(1-a.def.noiseTolerance)*4;a.def.trust-=loss;this.stats.catStartles=(this.stats.catStartles||0)+1;this.ui.showThought(a,'!!',this.camera)}else this.ui.showThought(a,manual?'RUDE':'noted.',this.camera)},
      onAdapt:gg=>{this.ui.toast('GARY IS LEARNING','He triggered the sprinkler, backed off, and is waiting.');this.ui.showThought(gg,'cooldown...',this.camera)},
      onTheft:gg=>{if(!this.theftNotified){this.theftNotified=true;this.ui.toast('THEFT IN PROGRESS','Gary has reached the food! Use the hose.');this.ui.showThought(gg,'jackpot',this.camera)}},
      onGaryLeft:()=>{this.raidsDone++;this.world.eyes.visible=false;if(this.raidsDone<this.raidsTotal&&['NIGHT','DAWN'].includes(this.state.phase))this.scheduleRaid(6+Math.random()*5)},
      onLight:gg=>{this.ui.toast('FLOODLIGHT','The porch light flares. Gary hesitates in the glare.');this.ui.showThought(gg,'ah, light',this.camera)},
      onCover:gg=>{this.ui.showThought(gg,'cover',this.camera);this.ui.toast('GARY LEARNS','He is sneaking in through the bushes to dodge the hose.')},
      onClimb:gg=>{this.ui.showThought(gg,'climbing...',this.camera);this.ui.toast('GARY CLIMBS','He hauled himself up onto the feeding deck.')}};
  }
  hose(dt){if(!this.hosing||!this.hoseTarget||this.state.phase!=='NIGHT')return;this.hoseTimer-=dt;if(this.hoseTimer<=0){this.hoseTimer=.045;const origin=new THREE.Vector3(5,.35,-7);this.objects.sprayHose(origin,this.hoseTarget);for(const a of [...this.cats,this.gary])if(a.root.visible&&a.root.position.distanceTo(this.hoseTarget)<this.prog.effects().hoseRange){if(a.type==='raccoon'){a.memory.hose=(a.memory.hose||0)+1;this.stats.adaptation+=1}else this.stats.catStartles=(this.stats.catStartles||0)+1;a.fleeFrom(this.hoseTarget,.9*this.prog.effects().hoseForce);this.context().onSprayed(a,true)}}}
  finish(){if(this.state.phase==='RESULTS')return;this.state.phase='RESULTS';this.audio.stop();this.world.eyes.visible=false;const endTrust=this.averageTrust(),delta=endTrust-this.baseTrust,served=this.objects.bowls.length;const rw=computeReward(this.prog.night,this.stats,this.cats,endTrust,delta,served);this.prog.addChow(rw.total);const foodTotal=Math.max(.001,this.stats.catFood+this.stats.stolen);const defense=Math.round((this.stats.catFood/foodTotal)*70+(this.cats.filter(c=>c.wasFed).length/3)*30);const rating=RATINGS.find(r=>defense>=r.min);this.prog.setBest(rating.grade);const story=genHeadline(this.prog.night,this.stats,this.cats,rw);this.save();this.ui.finish({...this.stats,catFood:this.stats.catFood/served,stolen:this.stats.stolen/served},this.cats,delta,rw,this.prog,rating,story)}
  update(dt){const speedDt=dt*this.state.speed;if(this.state.phase==='NIGHT'){this.state.elapsed+=speedDt;this.state.progress=.13+this.state.elapsed/115*.75;if(this.state.progress>=.88){this.state.phase='DAWN';this.state.dawn=0;this.ui.toast('DAWN','The yard is still. Time to count the bowls.')}}else if(this.state.phase==='DAWN'){this.state.dawn+=speedDt;this.state.progress=.88+Math.min(.12,this.state.dawn/5*.12);if(this.state.dawn>5)this.finish()}let nightness=.45;if(this.state.phase==='NIGHT')nightness=Math.min(1,.55+this.state.progress);else if(this.state.phase==='DAWN'||this.state.phase==='RESULTS')nightness=Math.max(.25,1-(this.state.progress-.88)*5);else if(this.state.phase==='PREP')nightness=.5;this.scene.background.setRGB(.025+.08*(1-nightness),.07+.055*(1-nightness),.085+.07*(1-nightness));this.scene.fog.color.copy(this.scene.background);this.hemi.intensity=.75+(.8*(1-nightness));this.moon.intensity=1.7+nightness*.8;this.renderer.toneMappingExposure=.92+(1-nightness)*.23;this.world.update(this.clock.elapsedTime,nightness);this.objects.update(dt);if(this.state.phase==='NIGHT'||this.state.phase==='DAWN'){const ctx=this.context();this.cats.forEach(c=>c.update(speedDt,ctx));this.gary.update(speedDt,ctx);this.checkSprinklers(ctx)}this.hose(dt);this.ui.update(this.state,this.objects,this.averageTrust(),this.prog)}
  checkSprinklers(ctx){for(const s of this.objects.sprinklers){if(s.userData.cooldown>0)continue;for(const c of this.cats){if(this.state.elapsed-(c.lastSprayedAt??-99)<12)continue;if(c.root.visible&&c.root.position.distanceTo(s.position)<s.userData.radius&&!s.userData.catAware){c.lastSprayedAt=this.state.elapsed;this.stats.catStartles=(this.stats.catStartles||0)+1;this.objects.triggerSprinkler(s);c.fleeFrom(s.position,1);ctx.onSprayed(c,false);this.ui.toast('FRIENDLY FIRE',`${c.def.name} was startled by the sprinkler.`);break}}}}
  animate=()=>{requestAnimationFrame(this.animate);const dt=Math.min(.05,this.clock.getDelta());this.update(dt);this.controls.update();this.renderer.render(this.scene,this.camera)}
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)}
}
