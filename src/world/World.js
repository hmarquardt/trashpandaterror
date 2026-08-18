import * as THREE from 'three';

const mat=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const mesh=(geo,material,cast=true,receive=true)=>{const m=new THREE.Mesh(geo,material);m.castShadow=cast;m.receiveShadow=receive;return m};

export class World {
  constructor(scene){
    this.scene=scene; this.interactables=[]; this.fireflies=[]; this.foliage=[];
    this.mats={ grass:mat(0x1e3528,1), wood:mat(0x594538,.9), trim:mat(0xb8ad8e,.8), dark:mat(0x151c1a,.8), metal:mat(0x56615d,.4,.45), leaf:mat(0x173325,1), stone:mat(0x727367,1), soil:mat(0x352a22,1) };
    this.build();
  }
  add(o,x=0,y=0,z=0){o.position.set(x,y,z);this.scene.add(o);return o}
  box(w,h,d,material,x,y,z){return this.add(mesh(new THREE.BoxGeometry(w,h,d),material),x,y,z)}
  build(){
    const ground=this.add(mesh(new THREE.PlaneGeometry(36,30,50,50),this.mats.grass,false),0,0,0);ground.rotation.x=-Math.PI/2;ground.name='yard';ground.userData.ground=true;this.interactables.push(ground);
    // damp patches give the lawn moonlit texture
    const wet=mat(0x142923,.75,.05);wet.transparent=true;wet.opacity=.56;
    for(let i=0;i<22;i++){const p=mesh(new THREE.CircleGeometry(.25+Math.random()*.85,14),wet,false);p.rotation.x=-Math.PI/2;p.position.set((Math.random()-.5)*25,.012,(Math.random()-.5)*20);this.scene.add(p)}
    // House and porch occupy the north edge.
    this.box(19,6,4,this.mats.wood,0,3,-12.3);this.box(19,.35,5.2,this.mats.stone,0,.16,-9.65);
    const steps=this.box(5.8,.28,1.35,this.mats.wood,0,.14,-6.85);steps.rotation.y=0;
    this.box(3.1,4.4,.18,this.mats.trim,0,2.35,-10.23);this.box(2.6,4,.22,mat(0x27413e,.7),0,2.2,-10.08);
    const knob=this.add(mesh(new THREE.SphereGeometry(.07),mat(0xd4a34d,.25,.8)),.95,2.2,-9.92);
    for(const x of [-6,6]){this.box(3.2,2.6,.18,this.mats.trim,x,3,-10.24);this.box(2.75,2.2,.2,mat(0x15252c,.2),x,3,-10.08);this.box(.08,2.2,.05,this.mats.trim,x,3,-9.94);this.box(2.75,.08,.05,this.mats.trim,x,3,-9.94)}
    // Warm porch lamps.
    for(const x of [-2.25,2.25]){const lamp=this.add(mesh(new THREE.CylinderGeometry(.13,.2,.45,8),mat(0x332d22,.3,.6)),x,3.7,-9.78);const bulb=new THREE.PointLight(0xffb65e,4.4,10,2);bulb.position.set(x,3.55,-9.25);bulb.castShadow=true;bulb.shadow.mapSize.set(512,512);this.scene.add(bulb);const glow=this.add(mesh(new THREE.SphereGeometry(.1),new THREE.MeshBasicMaterial({color:0xffc777})),x,3.55,-9.28)}
    // Shed: Gary's entrance landmark.
    this.box(6.2,3.6,4.5,mat(0x39433a,1),-11,1.8,7.4);const roof=this.box(6.8,.28,5.1,mat(0x161b1a,.8),-11,3.75,7.4);roof.rotation.z=.08;
    this.box(2.7,2.7,.15,this.mats.dark,-10.5,1.38,5.1);this.box(.16,2.7,.15,this.mats.wood,-9.14,1.38,5.02);this.box(.16,2.7,.15,this.mats.wood,-11.86,1.38,5.02);
    // Glowing eyes beneath shed, revealed at night.
    this.eyes=new THREE.Group();for(const x of [-.11,.11]){const e=mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0xd4dd8d}));e.position.set(x,0,0);this.eyes.add(e)}this.eyes.position.set(-10.7,.34,4.98);this.eyes.visible=false;this.scene.add(this.eyes);
    // Fence around the diorama.
    for(let x=-17;x<=17;x+=1.05)this.box(.85,1.5,.14,this.mats.wood,x,.75,14.2);
    for(let z=-8;z<=14;z+=1.05){this.box(.14,1.5,.85,this.mats.wood,-17.2,.75,z);this.box(.14,1.5,.85,this.mats.wood,17.2,.75,z)}
    // Bushes, trees and planters.
    for(let i=0;i<34;i++){const side=i%2?-1:1;const x=side*(12+Math.random()*4);const z=-7+Math.random()*19;this.makeBush(x,z,.65+Math.random()*.75)}
    this.makeTree(13.5,10.5,.78);this.makeTree(14,-4,.9);
    for(const x of [-7.5,7.5]){this.add(mesh(new THREE.CylinderGeometry(.65,.5,.55,12),mat(0x5c4437,1)),x,.28,-8.7);this.makeBush(x,-8.7,.65)}
    this.makeFireflies();
    // garden hose coil
    const curve=new THREE.CatmullRomCurve3(Array.from({length:18},(_,i)=>{const a=i/17*Math.PI*4;return new THREE.Vector3(5+Math.cos(a)*(1-i/40),.05,-7+Math.sin(a)*(1-i/40))}));
    this.hoseMesh=this.add(mesh(new THREE.TubeGeometry(curve,70,.045,6,false),mat(0x6c8a45,.55),false));
  }
  makeBush(x,z,s){const g=new THREE.Group();for(let i=0;i<5;i++){const b=mesh(new THREE.IcosahedronGeometry(s*(.65+Math.random()*.35),1),this.mats.leaf);b.scale.y=.8;b.position.set((Math.random()-.5)*s,(.45+Math.random()*.35)*s,(Math.random()-.5)*s);g.add(b)}g.position.set(x,0,z);g.userData.phase=Math.random()*6.2;this.foliage.push(g);this.scene.add(g)}
  makeTree(x,z,s){const g=new THREE.Group();const trunk=mesh(new THREE.CylinderGeometry(.22*s,.34*s,4.2*s,9),this.mats.wood);trunk.position.y=2.1*s;g.add(trunk);for(let i=0;i<7;i++){const c=mesh(new THREE.IcosahedronGeometry((1.25+Math.random()*.5)*s,1),this.mats.leaf);c.position.set((Math.random()-.5)*2*s,(4+Math.random()*1.2)*s,(Math.random()-.5)*2*s);g.add(c)}g.position.set(x,0,z);g.userData.phase=Math.random()*6;this.foliage.push(g);this.scene.add(g)}
  makeFireflies(){const count=70,pos=new Float32Array(count*3),colors=new Float32Array(count*3);for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*30;pos[i*3+1]=.2+Math.random()*3;pos[i*3+2]=(Math.random()-.5)*24;colors.set([.65+Math.random()*.35,1,.35],i*3)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.07,vertexColors:true,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));this.scene.add(pts);this.fireflyPoints=pts}
  // Shake the bush closest to a point so Gary's approach is readable in-world.
  rustleBush(x,z){let best=null,bd=1e9;for(const f of this.foliage){const d=(f.position.x-x)**2+(f.position.z-z)**2;if(d<bd){bd=d;best=f}}if(best)best.userData.surge=1}
  update(t,nightness){for(const f of this.foliage){const s=f.userData.surge||0;f.rotation.z=Math.sin(t*.55+f.userData.phase)*.008+(s?Math.sin(t*22)*.16*s:0);f.rotation.x=Math.cos(t*.42+f.userData.phase)*.005+(s?Math.cos(t*18)*.08*s:0);if(s)f.userData.surge=Math.max(0,s-.018)}if(this.fireflyPoints){this.fireflyPoints.material.opacity=.18+nightness*.75;const a=this.fireflyPoints.geometry.attributes.position;for(let i=0;i<a.count;i++)a.array[i*3+1]+=Math.sin(t*1.5+i)*.0008;a.needsUpdate=true}if(this.eyes.visible)this.eyes.scale.setScalar(.75+Math.sin(t*2.5)*.2)}
}
