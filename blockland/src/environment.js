(function(root){'use strict';
// Keep the saved 0..1200 clock: sunrise=0, sunset=600, noon=300.
// Convert to elapsed seconds before advancing so crossing a boundary is exact.
const DAY_SECONDS=17*60,NIGHT_SECONDS=4*60,CYCLE_SECONDS=DAY_SECONDS+NIGHT_SECONDS;
const normalizeTime=t=>{if(!Number.isFinite(t))return 260;return t>=0&&t<1200?t:(t%1200+1200)%1200;};
const elapsedAt=t=>{t=normalizeTime(t);return t<600?t/600*DAY_SECONDS:DAY_SECONDS+(t-600)/600*NIGHT_SECONDS;};
function advanceTime(time,dt){if(!Number.isFinite(dt)||dt<=0)return normalizeTime(time);const elapsed=(elapsedAt(time)+Math.max(0,Number.isFinite(dt)?dt:0))%CYCLE_SECONDS;return elapsed<DAY_SECONDS?elapsed/DAY_SECONDS*600:600+(elapsed-DAY_SECONDS)/NIGHT_SECONDS*600;}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Same ambient depth factor used by voxel faces and monster spawning.
const terrainShade=(height,y)=>Math.max(.22,1-Math.max(0,height-y-3)*.09);
class Environment {
 constructor(time=260){this.time=normalizeTime(time);this.audio=null;this.enabled=true;this.birdAt=0;this.lastBiome='';this.update(0,'plains',false);}
 update(dt,biome,water){this.time=advanceTime(this.time,dt);const angle=this.time/1200*Math.PI*2,sun=Math.sin(angle),day=sun>=0?.4+.6*smooth(0,.18,sun):.16+.24*smooth(-.12,0,sun),dawn=(1-smooth(0,.23,Math.abs(sun)))*.75;this.day=day;this.angle=angle;const base=[.025+day*.525,.045+day*.735,.10+day*.88];this.sky=base.map((n,i)=>n*(1-dawn)+[.9,.42,.25][i]*dawn);this.fogFactor=water?.3:biome==='forest'?.82:biome==='snow'?.74:biome==='desert'?.93:1;this.fogColor=water?[.1,.3,.4].map(n=>n*day):this.sky.map((n,i)=>n*(biome==='forest'?(i===1?1:.93):1));const waterside=water||biome==='ocean'||biome==='river';if(this.audio&&this.audio.state==='running'){const t=this.audio.currentTime;this.wind.gain.setTargetAtTime(this.enabled?(biome==='forest'?.035:waterside?.055:.018):0,t,.6);this.filter.frequency.setTargetAtTime(waterside?1400:biome==='forest'?700:400,t,1);if(this.enabled&&day>.4&&biome!=='desert'&&t>this.birdAt){this.birdAt=t+4+Math.random()*6;this.chirp();}}}
 lightAt(world,x,y,z){return this.day*terrainShade(world.info(x,z).h,y);}
 get phase(){return this.time<600?'day':'night';}
 start(enabled=true){this.enabled=enabled;try{if(!this.audio){const A=globalThis.AudioContext||globalThis.webkitAudioContext;if(!A)return;this.audio=new A();const ctx=this.audio,buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=buffer.getChannelData(0);let v=0;for(let i=0;i<data.length;i++){v=(v+(Math.random()*2-1)*.04)*.985;data[i]=v;}const node=ctx.createBufferSource();node.buffer=buffer;node.loop=true;this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=500;this.wind=ctx.createGain();this.wind.gain.value=0;node.connect(this.filter).connect(this.wind).connect(ctx.destination);node.start();}if(enabled)this.audio.resume().catch(()=>{});else this.audio.suspend().catch(()=>{});}catch(e){this.enabled=false;}}
 pause(){this.audio?.suspend().catch(()=>{});}
 chirp(){if(!this.audio||!this.enabled)return;const ctx=this.audio,t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(1900,t);o.frequency.exponentialRampToValueAtTime(3300,t+.08);o.frequency.exponentialRampToValueAtTime(1700,t+.2);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.012,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.25);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.27);o.onended=()=>{o.disconnect();g.disconnect();};}
}
const api={Environment,DAY_SECONDS,NIGHT_SECONDS,CYCLE_SECONDS,normalizeTime,advanceTime,terrainShade};
root.BlocklandEnvironment=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
