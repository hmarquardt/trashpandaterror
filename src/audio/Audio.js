export class AudioManager {
  constructor(){this.ctx=null;this.master=null;this.ambient=null;this.last={}}
  unlock(){if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return}const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;this.ctx=new Ctx();this.master=this.ctx.createGain();this.master.gain.value=.13;this.master.connect(this.ctx.destination)}
  // tone() may be routed left/right (-1..1) so an event can point at where it happened.
  tone(freq,duration,type='sine',volume=.1,slide=0,pan=0){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.linearRampToValueAtTime(freq+slide,now+duration);g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(volume,now+.015);g.gain.exponentialRampToValueAtTime(.001,now+duration);let node=g;if(this.ctx.createStereoPanner&&pan){const p=this.ctx.createStereoPanner();p.pan.value=pan;node.connect(p);node=p}o.connect(g);node.connect(this.master);o.start();o.stop(now+duration)}
  chime(...notes){for(const [f,d,t,v,s,p] of notes)setTimeout(()=>this.tone(f,d,t,v,s,p||0),40);this.tone(notes[0][0],notes[0][1],notes[0][2],notes[0][3],notes[0][4],notes[0][5]||0)}
  play(name,pan=0){const now=performance.now();if(now-(this.last[name]||0)<220)return;this.last[name]=now;
    if(name==='rustle'){this.tone(120,.35,'sawtooth',.05,-55,pan);this.tone(170,.22,'triangle',.04,-70,pan)}
    if(name==='step')this.tone(95,.045,'sine',.014,-18,pan);
    if(name==='spray')this.tone(950,.18,'sawtooth',.035,-700,pan);
    if(name==='munch')this.tone(180,.09,'square',.03,-30,pan);
    if(name==='munch2')this.tone(230,.07,'square',.024,-22,pan);
    if(name==='cat')this.tone(520,.16,'triangle',.06,180,pan);
    if(name==='bowl')this.tone(720,.08,'square',.035,-240,pan);
    if(name==='bump')this.tone(140,.12,'sawtooth',.06,-60,pan);this.last.bump=now;
    if(name==='climb')this.tone(300,.22,'triangle',.05,60,pan);
    if(name==='light')this.tone(1240,.18,'sine',.04,-600,pan);
    if(name==='deter')this.tone(880,.26,'sawtooth',.06,-440,pan);
    if(name==='splash'){this.tone(520,.1,'sawtooth',.05,-260,pan);this.tone(720,.16,'triangle',.04,-520,pan)}
    if(name==='safe'){this.tone(1250,.09,'sine',.025,-740,pan);this.tone(1500,.08,'sine',.018,-900,pan)}
    if(name==='tug')this.tone(118,.14,'sawtooth',.05,-26,pan);
    // A short suspense sting for the "Gary found the gap" beat.
    if(name==='sting'){this.tone(74,.6,'sawtooth',.085,-12,pan);setTimeout(()=>this.tone(150,.3,'square',.05,-110,pan),40);setTimeout(()=>this.tone(49,.7,'sine',.10,-6,pan),70)}
    if(name==='dawn'){this.tone(392,.5,'sine',.06,393);this.tone(523,.6,'triangle',.05,260)}
    if(name==='relay')this.tone(60,.05,'square',.05,-20,pan);
    if(name==='clap'){this.tone(900,.05,'triangle',.12,-600,pan||0);this.tone(400,.12,'triangle',.1,-260,pan||0)}
    if(name==='thunder')this.tone(50,.8,'sine',.12,-8,pan);
    if(name==='chow'){this.chime([392,.12,'square',.05,0,0],[523,.12,'square',.05,0,0],[659,.2,'square',.05,0,0])}
  }
  startAmbient(){this.unlock();if(!this.ctx||this.ambient)return;const gain=this.ctx.createGain();gain.gain.value=.001;gain.connect(this.master);const a=this.ctx.createOscillator(),b=this.ctx.createOscillator();a.frequency.value=4300;b.frequency.value=3950;a.connect(gain);b.connect(gain);a.start();b.start();this.ambient={gain,a,b};const pulse=()=>{if(!this.ambient)return;const t=this.ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.018,t+.025);gain.gain.exponentialRampToValueAtTime(.001,t+.12);this.ambient.timer=setTimeout(pulse,650+Math.random()*1250)};pulse();
    // Distant neighborhood texture: occasional isolated cricket chirp and sub thump, intentionally sparse.
    const neigh=()=>{if(!this.ambient)return;if(Math.random()<.5){this.tone(4400+Math.random()*400,.03,'sine',.008,0,Math.random()*1.6-0.8);this.tone(4600+Math.random()*300,.03,'triangle',.005,0,(Math.random()<.5?-1:1)*.7)}else{this.tone(48,.5,'sine',.05,-4,0)}this.neighTimer=setTimeout(neigh,2600+Math.random()*3800)};this.ambient.neighTimer=setTimeout(neigh,1800)}
  stop(){if(!this.ambient)return;clearTimeout(this.ambient.timer);clearTimeout(this.ambient.neighTimer);this.ambient.a.stop();this.ambient.b.stop();this.ambient=null}
}
