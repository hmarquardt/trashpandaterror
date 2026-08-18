import * as THREE from 'three';

const standard=(c,r=.7,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function shadow(o){o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true}});return o}

const DEFAULTS={garyEatRate:1,platformPause:0,barrierRadius:1.65,barrierStrength:1.8,sprinklerRadius:4,sprinklerCooldown:5.5,sprinklerCatAware:false};

export class ObjectManager {
  constructor(scene){this.scene=scene;this.items=[];this.bowls=[];this.barriers=[];this.sprinklers=[];this.splashes=[];this.effects={...DEFAULTS};this.clear()}
  setEffects(e){this.effects={...DEFAULTS,...e}}
  // Remake the bowl meshes in place so purchased physical upgrades (raised deck)
  // show up in the PREP backyard without losing current food/their theft log.
  rebuildBowls(){const kept=this.bowls.map(b=>({pos:b.position.clone(),food:b.userData.food,stolen:b.userData.stolen||0,full:b.userData.full||1}));for(const b of this.bowls)this.scene.remove(b);this.bowls=[];this.items=this.items.filter(o=>o.userData.type!=='bowl');for(const k of kept){const b=this.makeBowl();b.position.copy(k.pos);b.userData.food=k.food;b.userData.stolen=k.stolen||0;b.userData.full=k.full;b.userData.foodMesh.scale.y=Math.max(.03,k.food);b.userData.foodMesh.position.y=(b.userData.liftY||0)+.195+.045*k.food;this.scene.add(b);this.items.push(b);this.bowls.push(b)}}
  bumpDust(pos){for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.03+Math.random()*.03,5,4),new THREE.MeshBasicMaterial({color:0x9a8458,transparent:true,opacity:.5}));p.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*.4,0,(Math.random()-.5)*.4));p.userData.vel=new THREE.Vector3((Math.random()-.5)*1.6,1+Math.random()*.8,(Math.random()-.5)*1.6);p.userData.life=.5+Math.random()*.3;this.scene.add(p);this.splashes.push(p)}}
  applyConfig(){for(const b of this.bowls){b.userData.garyEat=this.effects.garyEatRate}for(const b of this.barriers){b.userData.blockRadius=this.effects.barrierRadius;b.userData.blockStrength=this.effects.barrierStrength}for(const s of this.sprinklers){s.userData.radius=this.effects.sprinklerRadius;s.userData.recharge=this.effects.sprinklerCooldown;s.userData.catAware=this.effects.sprinklerCatAware;s.userData.ring.scale.setScalar(this.effects.sprinklerRadius/4)}}
  clear(){for(const o of this.items)this.scene.remove(o);this.items=[];this.bowls=[];this.barriers=[];this.sprinklers=[];this.splashes=[]}
  place(type,point){
    if(type==='bowl' && this.bowls.length>=3)return null;
    if(type==='barrier' && this.barriers.length>=5)return null;
    if(type==='sprinkler' && this.sprinklers.length>=1)return null;
    let o;if(type==='bowl')o=this.makeBowl();if(type==='barrier')o=this.makeBarrier();if(type==='sprinkler')o=this.makeSprinkler();if(!o)return null;
    o.position.copy(point);o.position.y=0;o.userData.type=type;o.userData.draggable=true;this.scene.add(o);this.items.push(o);this[`${type}s`].push(o);return o;
  }
  makeBowl(){const g=new THREE.Group();const lift=this.effects.platformPause>0?.42:0;g.position.y=lift;
    const outer=new THREE.Mesh(new THREE.CylinderGeometry(.58,.42,.23,24,1,true),standard(0xa8b5ad,.26,.55));outer.position.y=.15;g.add(outer);
    const food=new THREE.Mesh(new THREE.CylinderGeometry(.43,.4,.09,24),standard(0x7a4825,1));food.position.y=.24;g.add(food);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.55,.055,8,24),standard(0xd3dad3,.22,.7));rim.rotation.x=Math.PI/2;rim.position.y=.27;g.add(rim);
    if(lift>0){const deck=new THREE.Mesh(new THREE.CylinderGeometry(.85,.9,.42,14),standard(0x5c4a36,.85));deck.position.y=.05;shadow(deck);g.add(deck);}
    const rate=this.effects.garyEatRate;
    g.userData={food:1,full:1,foodMesh:food,label:'Food bowl',type:'bowl',liftY:lift,garyEat:rate,raised:lift>0,stolen:0};shadow(g);return g}
  makeBarrier(){const g=new THREE.Group();const wood=standard(0x8e6845,.9);for(const z of [-.3,.3]){const rail=new THREE.Mesh(new THREE.BoxGeometry(2.8,.42,.17),wood);rail.position.set(0,.45,z);g.add(rail)}for(const x of [-1.2,1.2]){const post=new THREE.Mesh(new THREE.BoxGeometry(.18,1,.18),wood);post.position.set(x,.48,0);g.add(post)}g.userData={label:'Garden barrier',type:'barrier',blocks:true,blockRadius:this.effects.barrierRadius,blockStrength:this.effects.barrierStrength};shadow(g);return g}
  makeSprinkler(){const g=new THREE.Group();const metal=standard(0x778e82,.32,.65);const base=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,.13,16),metal);base.position.y=.08;g.add(base);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,.75,10),metal);stem.position.y=.46;g.add(stem);const head=new THREE.Mesh(new THREE.BoxGeometry(.72,.12,.12),standard(0xa2b3a7,.25,.5));head.position.y=.85;g.add(head);const r=this.effects.sprinklerRadius/4;const ring=new THREE.Mesh(new THREE.RingGeometry(3.9,4,64),new THREE.MeshBasicMaterial({color:0x89cde0,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.scale.setScalar(r);g.add(ring);g.userData={label:'Motion sprinkler',type:'sprinkler',radius:this.effects.sprinklerRadius,cooldown:0,active:0,triggered:0,catAware:this.effects.sprinklerCatAware,recharge:this.effects.sprinklerCooldown,ring};shadow(g);return g}
  getNearestBowl(pos){let best=null,d=Infinity;for(const b of this.bowls){if(b.userData.food<=.005)continue;const bd=pos.distanceTo(b.position);if(bd<d){d=bd;best=b}}return {bowl:best,distance:d}}
  consume(bowl,amount,kind,stats){const used=Math.min(bowl.userData.food,amount);bowl.userData.food-=used;bowl.userData.foodMesh.scale.y=Math.max(.03,bowl.userData.food);bowl.userData.foodMesh.position.y=bowl.userData.liftY+.195+.045*bowl.userData.food;if(kind==='cat')stats.catFood+=used;else{stats.stolen+=used;bowl.userData.stolen=(bowl.userData.stolen||0)+used}return used}
  triggerSprinkler(s){s.userData.active=1.35;s.userData.cooldown=s.userData.recharge;s.userData.triggered++;for(let i=0;i<75;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.025,5,4),new THREE.MeshBasicMaterial({color:0xa6dcec,transparent:true,opacity:.85}));const a=Math.random()*Math.PI*2,spd=3+Math.random()*5;p.position.copy(s.position).add(new THREE.Vector3(0,.75,0));p.userData.vel=new THREE.Vector3(Math.cos(a)*spd,2+Math.random()*3,Math.sin(a)*spd);p.userData.life=.7+Math.random()*.5;this.scene.add(p);this.splashes.push(p)}}
  sprayHose(origin,target){for(let i=0;i<12;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.025,5,4),new THREE.MeshBasicMaterial({color:0xb6e8f1,transparent:true,opacity:.9}));p.position.copy(origin);const dir=target.clone().sub(origin).normalize();p.userData.vel=dir.multiplyScalar(12+Math.random()*3).add(new THREE.Vector3((Math.random()-.5),Math.random()*1.2,(Math.random()-.5)));p.userData.life=.7;this.scene.add(p);this.splashes.push(p)}}
  update(dt){for(const s of this.sprinklers){s.userData.cooldown=Math.max(0,s.userData.cooldown-dt);s.userData.active=Math.max(0,s.userData.active-dt);s.rotation.y+=s.userData.active?dt*15:0;s.userData.ring.material.opacity=s.userData.active?.25:.1}for(let i=this.splashes.length-1;i>=0;i--){const p=this.splashes[i];p.userData.life-=dt;p.userData.vel.y-=9*dt;p.position.addScaledVector(p.userData.vel,dt);p.material.opacity=Math.max(0,p.userData.life);if(p.userData.life<=0||p.position.y<0){this.scene.remove(p);p.geometry.dispose();p.material.dispose();this.splashes.splice(i,1)}}}
}
