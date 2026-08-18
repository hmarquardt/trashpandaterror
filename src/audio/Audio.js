export class AudioManager {
  constructor(){this.ctx=null;this.master=null;this.ambient=null;this.last={}}
  unlock(){if(this.ctx)return;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;this.ctx=new Ctx();this.master=this.ctx.createGain();this.master.gain.value=.13;this.master.connect(this.ctx.destination)}
  tone(freq,duration,type='sine',volume=.1,slide=0){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.linearRampToValueAtTime(freq+slide,now+duration);g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(volume,now+.015);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g).connect(this.master);o.start();o.stop(now+duration)}
  chime(...notes){for(const [f,d,t,v,s] of notes)setTimeout(()=>this.tone(f,d,t,v,s),40);this.tone(notes[0][0],notes[0][1],notes[0][2],notes[0][3],notes[0][4])}
  play(name){const now=performance.now();if(now-(this.last[name]||0)<220)return;this.last[name]=now;
    if(name==='rustle'){this.tone(120,.35,'sawtooth',.05,-55);this.tone(170,.22,'triangle',.04,-70)}
    if(name==='spray')this.tone(950,.18,'sawtooth',.035,-700);
    if(name==='munch')this.tone(180,.09,'square',.03,-30);
    if(name==='cat')this.tone(520,.16,'triangle',.06,180);
    if(name==='bowl')this.tone(720,.08,'square',.035,-240);
    if(name==='bump')this.tone(140,.12,'sawtooth',.06,-60);
    if(name==='climb')this.tone(300,.22,'triangle',.05,60);
    if(name==='light')this.tone(1240,.18,'sine',.04,-600);
    if(name==='deter')this.tone(880,.26,'sawtooth',.06,-440);
    if(name==='dawn'){this.tone(392,.5,'sine',.06,393);this.tone(523,.6,'triangle',.05,260)}
    if(name==='chow'){this.chime([392,.12,'square',.05,0],[523,.12,'square',.05,0],[659,.2,'square',.05,0])}
  }
  startAmbient(){this.unlock();if(!this.ctx||this.ambient)return;const gain=this.ctx.createGain();gain.gain.value=.001;gain.connect(this.master);const a=this.ctx.createOscillator(),b=this.ctx.createOscillator();a.frequency.value=4300;b.frequency.value=3950;a.connect(gain);b.connect(gain);a.start();b.start();this.ambient={gain,a,b};const pulse=()=>{if(!this.ambient)return;const t=this.ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.018,t+.025);gain.gain.exponentialRampToValueAtTime(.001,t+.12);this.ambient.timer=setTimeout(pulse,650+Math.random()*1250)};pulse()}
  stop(){if(!this.ambient)return;clearTimeout(this.ambient.timer);this.ambient.a.stop();this.ambient.b.stop();this.ambient=null}
}
