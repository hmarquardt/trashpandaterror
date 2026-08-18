import * as THREE from 'three';
import { CATS, GARY } from '../systems/Tuning.js';
import { behaviorOf } from '../data/gary.js';

const mat=(c,r=.85)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
function ellipsoid(radius,color,scale){const m=new THREE.Mesh(new THREE.SphereGeometry(radius,14,10),mat(color));m.scale.set(...scale);m.castShadow=true;return m}

function makeAnimal(def,isRaccoon=false){
  const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);
  const body=ellipsoid(.55,def.coat,isRaccoon?[1.25,.75,1.7]:[.9,.75,1.45]);body.position.y=.58;rig.add(body);
  const head=ellipsoid(.4,def.coat,isRaccoon?[1,.85,1.05]:[.82,.95,.9]);head.position.set(0,.87,.62);rig.add(head);
  const muzzle=ellipsoid(.19,isRaccoon?0x9da19a:def.accent,[.85,.62,.8]);muzzle.position.set(0,.78,.94);rig.add(muzzle);
  const nose=ellipsoid(.075,0x111514,[1,.7,.8]);nose.position.set(0,.83,1.09);rig.add(nose);
  const ears=[];for(const x of [-.22,.22]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.15,.36,6),mat(def.coat));ear.position.set(x,1.19,.55);ear.rotation.z=x>0?-.13:.13;ear.castShadow=true;rig.add(ear);ears.push(ear);const eye=ellipsoid(.047,isRaccoon?0xcdda86:0xafd46e,[1,1,.5]);eye.material.emissive=new THREE.Color(eye.material.color);eye.material.emissiveIntensity=.7;eye.position.set(x*.7,.95,.91);rig.add(eye)}
  if(isRaccoon){const mask=ellipsoid(.31,def.accent,[1.12,.34,.55]);mask.position.set(0,.95,.82);rig.add(mask);mask.renderOrder=-1}
  const legs=[];for(const x of [-.33,.33])for(const z of [-.37,.38]){const leg=ellipsoid(.13,isRaccoon?0x343836:def.coat,[.8,1.3,.8]);leg.position.set(x,.25,z);rig.add(leg);legs.push(leg)}
  const tail=new THREE.Group();for(let i=0;i<(isRaccoon?7:5);i++){const seg=ellipsoid(.18-i*.012,isRaccoon?(i%2?0x262927:0x6e726d):def.coat,[1,1,1.55]);seg.position.set(0,.05+i*.03,-i*.25);tail.add(seg)}tail.position.set(0,.62,-.7);tail.rotation.x=-.25;rig.add(tail);
  root.userData.rig={rig,head,tail,legs,ears};return root;
}

export class Agent {
  constructor(def,type,scene,persistent={}){this.def={...def,...persistent};this.type=type;this.root=makeAnimal(this.def,type==='raccoon');this.root.userData.agent=this;this.root.position.set(def.approach[0],0,def.approach[1]);this.root.visible=false;scene.add(this.root);this.state='waiting';this.target=null;this.fear=0;this.fed=0;this.wasFed=false;this.memory=Object.assign({sprinkler:0,hose:0,barrier:0,raised:0,light:0},persistent.memory||{});this.traits=persistent.traits||[];this.personality=behaviorOf(this.traits);this.pose={crouch:0,headUp:0,tailUp:0,earsIn:0};this.speed=type==='raccoon'?1.25:1.05;this.scene=scene;this.nextDecision=0;this.active=false;this.bumpCd=0}
  reset(){this.state='waiting';this.target=null;this.fear=0;this.fed=0;this.wasFed=false;this.active=false;this.root.visible=false;this.delay=0;this.wander=null;this.climbedNow=false;this.boundaryPokes=0;this.lightTriggered=false;this.lastSprayedAt=-99;this.bumpCd=0;this.fedGoal=this.type==='raccoon'?(this.p('fedTarget')||GARY.fedTarget):CATS.feedNeeded}
  spawn(delay=0,from=null){this.delay=delay;this.active=true;this.root.visible=false;this.state='arriving';if(from){this.root.position.set(from[0],0,from[1])}}
  p(name){return this.personality[name]}
  setPose(target){const P=this.pose,t=target||{};P.crouch=THREE.MathUtils.lerp(P.crouch,t.crouch??0,.12);P.headUp=THREE.MathUtils.lerp(P.headUp,t.headUp??0,.12);P.tailUp=THREE.MathUtils.lerp(P.tailUp,t.tailUp??0,.12);P.earsIn=THREE.MathUtils.lerp(P.earsIn,t.earsIn??0,.16);const rig=this.root.userData.rig;const cr=1-P.crouch*.28;rig.rig.position.y=cr;rig.rig.scale.set(cr,1+P.crouch*.14,cr);rig.head.position.y=.87+.18*P.headUp;rig.tail.rotation.x=-.25-.32*P.tailUp;rig.ears.forEach(e=>e.rotation.z=(e.position.x>0?-.13:.13)-P.earsIn)}
  fleeFrom(point,amount=1){if(this.type==='raccoon'){const resist=this.p('startleResist')||0;let a=amount*(1-resist);if(this.memory.hose>1)a*=Math.max(.5,1-this.memory.hose*.03);amount=Math.max(.2,a)}amount*=this.p('fearMult')||1;this.fear=Math.max(this.fear,amount);this.state='fleeing';this.target=this.root.position.clone().sub(point).setY(0).normalize().multiplyScalar(8).add(this.root.position);this.target.x=THREE.MathUtils.clamp(this.target.x,-15,15);this.target.z=THREE.MathUtils.clamp(this.target.z,-7,13)}
  moveToward(target,dt,barriers=[]){const d=target.clone().sub(this.root.position);d.y=0;const dist=d.length();if(dist>.05){d.normalize();let pushed=false;for(const b of barriers){const away=this.root.position.clone().sub(b.position).setY(0),bd=away.length();const R=b.userData.blockRadius||1.65,str=b.userData.blockStrength||1.8;if(bd<R&&bd>.01){pushed=true;away.normalize();const side=new THREE.Vector3(-d.z,0,d.x);if(side.dot(away)<0)side.negate();d.addScaledVector(side,(R-bd)*str)}}if(pushed&&this.type==='raccoon'){this.memory.barrier=(this.memory.barrier||0)+.05;if(this.bumpCd<=0){this.bumpCd=.5;this.justBumped=1}}this.bumpCd=Math.max(0,this.bumpCd-dt);d.normalize();const boost=this.fear>GARY.boostFear-(this.p('sprintCommit')?0.15:0)?1.75:1;const pace=this.speed*boost;this.root.position.addScaledVector(d,Math.min(dist,pace*dt));this.root.rotation.y=THREE.MathUtils.lerp(this.root.rotation.y,Math.atan2(d.x,d.z),dt*6);const rig=this.root.userData.rig;rig.rig.position.y+=Math.abs(Math.sin(performance.now()*.01*pace))*.04;rig.legs.forEach((l,i)=>l.rotation.x=Math.sin(performance.now()*.011*pace+i*Math.PI)*.5)}return dist}
  update(dt,ctx){
    if(!this.active)return;if(this.delay>0){this.delay-=dt;return}this.root.visible=true;this.fear=Math.max(0,this.fear-dt*GARY.fearDecay*(this.p('fearRecovery')||1));if(this.justBumped){this.justBumped=0;if(ctx.onBarrier&&this.type==='raccoon')ctx.onBarrier(this)}if(this.type==='cat')this.updateCat(dt,ctx);else this.updateRaccoon(dt,ctx)
  }
  updateCat(dt,ctx){
    if(this.state==='arriving'){this.target=new THREE.Vector3(this.def.preferred[0],0,this.def.preferred[1]);this.state='seeking'}
    if(this.state==='fleeing'){if(this.moveToward(this.target,dt)<.2){this.state='hesitating';this.nextDecision=(1+this.def.skittishness)*1.1+Math.random()*1.3}return}
    if(this.state==='hesitating'){this.nextDecision-=dt;if(this.nextDecision<=0){this.state='seeking';this.wander=null;const n=ctx.objects.getNearestBowl(this.root.position);this.target=n.bowl?.position.clone()||new THREE.Vector3(...this.def.approach)}return}
    if(this.state==='seeking'&&!this.wander&&this.def.curiosity>.6&&Math.random()<dt*.12){this.wander=this.root.position.clone().add(new THREE.Vector3((Math.random()-.5)*8,0,(Math.random()-.5)*8));this.wander.x=THREE.MathUtils.clamp(this.wander.x,-13,13);this.wander.z=THREE.MathUtils.clamp(this.wander.z,-6,11)}
    if(this.wander){if(this.moveToward(this.wander,dt,ctx.objects.barriers)<.35){this.wander=null}return}
    const nearest=ctx.objects.getNearestBowl(this.root.position);if(!nearest.bowl){this.state='leaving';this.target=new THREE.Vector3(this.def.approach[0],0,this.def.approach[1])}
    else if(this.state!=='eating'){this.target=nearest.bowl.position.clone();this.state='seeking'}
    if(this.state==='seeking'&&this.moveToward(this.target,dt,ctx.objects.barriers)<.72){this.state='eating';this.target=nearest.bowl}
    if(this.state==='eating'){this.setPose({crouch:.25});if(this.nextDecision<=0){this.nextDecision=1;ctx.onMunch&&ctx.onMunch(this)}const used=ctx.objects.consume(this.target,dt*CATS.baseEat*(this.def.pace||1),'cat',ctx.stats);this.fed+=used;if(used<=0||this.fed>CATS.feedNeeded){this.state='leaving';this.target=new THREE.Vector3(this.def.approach[0],0,this.def.approach[1]);if(!this.wasFed){this.wasFed=true;ctx.onFed(this)}}}
    if(this.state==='leaving'){this.nextDecision-=dt;this.setPose({});this.moveToward(this.target,dt)}
  }
  pickBowl(ctx){const nearest=ctx.objects.getNearestBowl(this.root.position).bowl;const bars=ctx.objects.barriers;if(!bars.length||this.memory.barrier<2)return nearest;let best=null,bs=Infinity;for(const b of ctx.objects.bowls){if(b.userData.food<=.005)continue;let penalty=0;for(const bar of bars){if(b.position.distanceTo(bar.position)<((bar.userData.blockRadius||1.65)*2.2))penalty+=7}const score=b.position.distanceTo(this.root.position)+penalty;if(score<bs){bs=score;best=b}}if(best&&best!==nearest)this.justRerouted=1;return best||nearest}
  updateRaccoon(dt,ctx){
    if(this.state==='arriving'){this.state='watching';this.nextDecision=.6+(this.p('watch')||0)*.4+Math.random()*.4;ctx.onGarySeen(this)}
    if(this.state==='watching'){this.setPose({crouch:.65,headUp:.55});this.nextDecision-=dt;if(this.nextDecision>0)return;this.state='seeking';this.target=this.pickBowl(ctx)?.position.clone()||new THREE.Vector3(0,0,0)}
    if(this.justRerouted){this.justRerouted=0;ctx.onReroute&&ctx.onReroute(this)}
    if(ctx.effects.motionLight&&this.state!=='leaving'){if(!this.lightTriggered){this.lightTriggered=true;ctx.onLight(this)}if(this.state==='eating'&&Math.random()<dt*.25)this.memory.light+=1}
    if(this.state!=='leaving'&&this.state!=='fleeing'&&this.state!=='eating'&&this.state!=='climbing'){
      const savvy=this.memory.sprinkler||0,tr=ctx.objects.sprinklers[0];
      if(tr&&savvy>0){const R=tr.userData.radius||4,dist=this.root.position.distanceTo(tr.position),learnAt=this.p('adaptRate')>1?1:2;
        if(dist<R&&tr.userData.cooldown<=0){ctx.objects.triggerSprinkler(tr);this.memory.sprinkler+=(this.p('adaptRate')||1);ctx.stats.adaptation+=1;ctx.onSprayed(this,false);this.fleeFrom(tr.position,this.memory.sprinkler>=3?0.5:1);return}
        if(savvy>=learnAt&&tr.userData.cooldown<=0&&dist<R+Math.min(2,.6+savvy*.2)&&(this.state==='seeking')){this.state='testing';this.nextDecision=(1.0+(this.p('probe')||0))+Math.random()*.6;this.testSpr=tr;this.boundaryPokes=(this.boundaryPokes||0)+1;const away=this.root.position.clone().sub(tr.position).setY(0).normalize();this.target=tr.position.clone().add(away.multiplyScalar(R*.5));ctx.onProbe&&ctx.onProbe(this)}
      }
    }
    if(this.state==='climbing'){this.setPose({crouch:.3,headUp:.5});this.nextDecision-=dt;const b=this.target;if(b&&b.userData&&b.userData.raised&&Math.random()<dt*2&&!this.climbedNow){this.climbedNow=true;this.memory.raised+=1;ctx.onClimb(this)}if(this.nextDecision<=0){if(b?.userData?.food>.005){this.state='eating'}else{this.state='seeking';this.target=this.pickBowl(ctx)?.position.clone()}}return}
    if(this.state==='testing'){this.setPose({crouch:.7,headUp:.5});this.nextDecision-=dt;this.moveToward(this.target,dt);if(this.nextDecision<=0){const tr=this.testSpr;const cap=4+(this.p('probeMax')||0);if(tr&&tr.userData.cooldown<=0&&(this.boundaryPokes||0)<cap&&!(this.p('bold')||0)){this.nextDecision=.7;this.boundaryPokes+=1}else{this.boundaryPokes=0;this.state='seeking'}}return}
    if(this.state==='fleeing'){this.setPose({crouch:.5,tailUp:.9,earsIn:.5});if(this.moveToward(this.target,dt)<.3||this.fear<GARY.boostFear){this.state='hesitating';const savvy=this.memory.hose||0;this.nextDecision=Math.max(.6,(1.5+Math.random()*2)-(savvy*0.4));this.flank=null}return}
    if(this.state==='hesitating'){this.nextDecision-=dt;if(this.nextDecision<=0){const flankChance=this.p('flank')||.4;if((this.memory.hose||0)>=(this.p('preferCover')?1:2)&&Math.random()<flankChance){this.state='flanking';this.flank=this.root.position.clone().add(new THREE.Vector3((Math.random()-.5)*10,0,6+Math.random()*4));this.flank.x=THREE.MathUtils.clamp(this.flank.x,-13,13);this.flank.z=THREE.MathUtils.clamp(this.flank.z,2,12)}else{this.state='watching';this.nextDecision=Math.max(.3,(this.p('watch')||0)*.4)}}return}
    if(this.state==='flanking'){this.setPose({crouch:.85});if(this.moveToward(this.flank,dt)<.4){this.state='seeking';this.target=this.pickBowl(ctx)?.position.clone();ctx.onCover(this)}return}
    const nearest=this.pickBowl(ctx);if(!nearest){this.state='leaving';this.target=new THREE.Vector3(-11,0,7)}else if(this.state!=='eating'&&this.state!=='climbing'&&this.state!=='testing'&&this.state!=='leaving'){this.target=nearest.position.clone();this.state='seeking'}
    if(this.state==='seeking'&&this.moveToward(this.target,dt,ctx.objects.barriers)<.85){if(nearest.userData.raised&&ctx.effects.platformPause>0){this.state='climbing';this.nextDecision=Math.max(.2,(ctx.effects.platformPause||0)-(this.memory.raised||0)*.35);this.climbedNow=false;this.target=nearest;ctx.onTheft(this)}else{this.state='eating';this.target=nearest;ctx.onTheft(this)}}
    if(this.state==='eating'){this.setPose({crouch:.25});const lightMult=ctx.effects.motionLight?Math.max(.55,1-Math.min(.2,.06+this.memory.light*.005)):1;const appetiteBase=GARY.appetiteBase*(1+Math.max(0,(ctx.night||1)-1)*GARY.appetitePerNight);const rate=appetiteBase*(this.p('appetite')||1)*(this.target.userData.garyEat||1)*lightMult*(this.p('eatCommit')||1);if(this.nextDecision<=0){this.nextDecision=1;ctx.onMunch&&ctx.onMunch(this)}const used=ctx.objects.consume(this.target,rate*dt,'raccoon',ctx.stats);this.fed+=used;if(used<=0||this.fed>this.fedGoal){this.state='leaving';this.target=new THREE.Vector3(-11,0,7)}}
    if(this.state==='leaving'){this.setPose({tailUp:.5});if(this.moveToward(this.target,dt)<.35){this.state='gone';this.active=false;this.root.visible=false;ctx.onGaryLeft(this)}}
  }
}
