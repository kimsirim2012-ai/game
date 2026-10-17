/* Deterministic streamed voxel terrain. Pure JS; shared by the game and Node tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BlocklandWorld=api;})(globalThis,function(){
'use strict';
const CHUNK=16,HEIGHT=112,SEA=30,MAX_COORD=1000000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const key=(x,z)=>`${x},${z}`,localIndex=(x,y,z)=>(x&15)+16*((z&15)+16*y);
const PLANTS={32:'민들레',33:'양귀비',34:'데이지',35:'튤립',36:'해바라기',37:'장미 덤불',38:'키 큰 풀',39:'작은 풀',40:'양치식물',41:'버섯'};
const BIOMES={plains:'평야',forest:'숲',desert:'사막',snow:'설산',mountain:'산악',ocean:'바다',river:'강',meadow:'꽃 초원'};
const isPlant=t=>t>=32&&t<=41,isSolid=t=>t>0&&t!==9&&!isPlant(t);
class Terrain {
 constructor(seed,legacy=false){this.seed=seed;this.legacy=legacy;this.columns=new Map();this.villages=new Map();}
 hash(x,z,s=0){let h=Math.imul((x|0)+this.seed+s,374761393)^Math.imul((z|0)+this.seed,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
 noise(x,z,s=0){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*fx*(fx*(fx*6-15)+10),v=fz*fz*fz*(fz*(fz*6-15)+10);return mix(mix(this.hash(ix,iz,s),this.hash(ix+1,iz,s),u),mix(this.hash(ix,iz+1,s),this.hash(ix+1,iz+1,s),u),v)*2-1;}
 fbm(x,z,s=0,n=4){let sum=0,a=.57;for(let i=0;i<n;i++){sum+=this.noise(x,z,s+i*317)*a;x=x*2.03+17;z=z*2.03-9;a*=.5;}return sum;}
 cave(x,y,z){if(y<3)return false;const n=this.noise(x/23+y*.047,z/23-y*.035,703),m=this.noise(x/11-y*.08,z/11+y*.06,997);return Math.abs(n)<.105&&Math.abs(m)<.28;}
 legacyHeight(x,z){return Math.floor(6+2.2*Math.sin((x+this.seed%100)*.11)+1.8*Math.cos((z-this.seed%73)*.13)+1.3*Math.sin((x+z)*.18));}
 raw(x,z){const continental=this.fbm(x/330,z/330,11,3),hills=this.fbm(x/68,z/68,139),ridge=1-Math.abs(this.fbm(x/105,z/105,91)),mount=smooth(-.02,.35,this.fbm(x/205,z/205,301));let h=34+continental*32+hills*10+Math.pow(ridge,3)*mount*53;
  const watercourse=Math.abs(this.noise(x/155,z/155,501)),river=1-smooth(.018,.075,watercourse),lake=1-smooth(-.68,-.48,this.noise(x/95,z/95,812));h=mix(h,SEA-3,river*.95);h=mix(h,SEA-4,lake);
  const temp=this.fbm(x/260,z/260,1701,3),wet=this.fbm(x/190,z/190,2101,3);let biome=h<SEA-2?'ocean':river>.55?'river':h>77?'snow':h>61?'mountain':temp>.08&&wet<-.05?'desert':temp<-.36?'snow':wet>.05?'forest':wet>-.2?'meadow':'plains';
  if(biome==='desert')h+=Math.sin(x*.12+z*.05)*1.2;
  return{h:clamp(Math.floor(h),3,HEIGHT-15),water:SEA,biome,temp,wet,river};
 }
 village(gx,gz){const k=key(gx,gz);if(this.villages.has(k))return this.villages.get(k);const starter=gx===0&&gz===0,x=starter?32:gx*192+40+Math.floor(this.hash(gx,gz,4001)*90),z=starter?88:gz*192+40+Math.floor(this.hash(gx,gz,4002)*90),raw=this.raw(x,z),eligible=starter||(this.hash(gx,gz,4003)>.38&&raw.h>SEA+1&&raw.h<62&&raw.biome!=='snow');const v=eligible?{id:k,x,z,y:Math.max(SEA+3,Math.min(60,raw.h)),name:starter?'바람꽃 마을':['솔바람 마을','해오름 마을','들꽃 마을','자작숲 마을'][Math.floor(this.hash(gx,gz,4004)*4)]}:null;this.villages.set(k,v);if(this.villages.size>256)this.villages.delete(this.villages.keys().next().value);return v;}
 nearbyVillage(x,z){const gx=Math.floor(x/192),gz=Math.floor(z/192);let nearest=null,dist=Infinity;for(let a=gx-1;a<=gx+1;a++)for(let b=gz-1;b<=gz+1;b++){const v=this.village(a,b);if(!v)continue;const d=Math.hypot(x-v.x,z-v.z);if(d<dist){nearest=v;dist=d;}}return nearest&&dist<38?nearest:null;}
 info(x,z){const k=key(x,z);let c=this.columns.get(k);if(c)return c;c=this.raw(x,z);let legacyDistance=Infinity;
  if(this.legacy){legacyDistance=Math.max(0,-x,x-63,-z,z-63);if(legacyDistance===0)c={h:this.legacyHeight(x,z),water:4,biome:'forest',legacy:true,temp:0,wet:0};else if(legacyDistance<48){const t=smooth(0,48,legacyDistance);c.h=Math.floor(mix(this.legacyHeight(x,z),c.h,t));c.water=Math.floor(mix(4,SEA,t));}}
  const v=this.nearbyVillage(x,z);if(v&&legacyDistance>0){const d=Math.max(Math.abs(x-v.x),Math.abs(z-v.z)),t=1-smooth(20,34,d);c.h=Math.round(mix(c.h,v.y,t));if(d<21){c.biome='meadow';c.water=SEA;}c.village=v;}
  c.top=c.legacy?(c.h<=4?6:1):c.biome==='desert'||c.h<=c.water+1?6:c.biome==='snow'?10:c.biome==='mountain'?3:1;this.columns.set(k,c);if(this.columns.size>18000){for(let i=0;i<3000;i++)this.columns.delete(this.columns.keys().next().value);}return c;
 }
 structure(x,y,z,c){const v=c.village;if(!v)return 0;const dx=x-v.x,dz=z-v.z;
  if(y===v.y&&((Math.abs(dx)<=1&&Math.abs(dz)<21)||(Math.abs(dz)<=1&&Math.abs(dx)<19)||((Math.abs(dz-7)<=1||Math.abs(dz+7)<=1)&&Math.abs(dx)<12)))return 18;
  for(const [hx,hz]of [[-11,-10],[11,-10],[-11,10],[11,10]]){const a=dx-hx,b=dz-hz;if(Math.abs(a)>3||Math.abs(b)>3)continue;const yy=y-v.y;if(yy===0)return 8;const edge=Math.abs(a)===3||Math.abs(b)===3;
   if(yy>=1&&yy<=3&&edge){const front=hz<0?b===3:b===-3;if(front&&a===0&&yy<3)return 0;if(yy===2&&((Math.abs(a)===3&&b===0)||(Math.abs(b)===3&&Math.abs(a)===2)))return 11;return Math.abs(a)===3&&Math.abs(b)===3?4:8;}
   const roof=4+Math.max(0,2-Math.abs(a));if(yy===roof)return 7;if(Math.abs(b)===3&&yy>=4&&yy<roof)return 8;
  }return 0;
 }
 base(x,y,z,c=this.info(x,z)){if(y<0||y>=HEIGHT)return 0;if(y===0&&!c.legacy)return 3;const structure=this.structure(x,y,z,c);if(structure)return structure;if(y>c.h)return y<=c.water?9:0;if(!c.legacy&&y>2&&y<c.h-4&&this.cave(x,y,z))return 0;const block=y===c.h?c.top:y>c.h-3?(c.top===6&&!c.legacy?6:2):3;if(block===3&&!c.legacy&&y<c.h-2){const ore=this.hash(Math.floor(x/3)+Math.floor(y/3)*31,Math.floor(z/3),9101);if(ore<.012&&y<17)return 27;if(ore<.06&&y<49)return 26;if(ore<.14&&y<75)return 25;}return block;}
 tree(x,z){const c=this.info(x,z);if((c.legacy?c.h<5:c.h<=c.water+1)||c.biome==='desert'||c.biome==='mountain'||c.village&&Math.hypot(x-c.village.x,z-c.village.z)<28)return null;if(c.legacy){if(x<3||z<3||x>=61||z>=61||this.hash(x,z)>.012||Math.hypot(x-32,z-44)<6)return null;return{x,z,y:c.h+1,height:4+Math.floor(this.hash(x,z,92)*2),kind:'oak',legacy:true};}
  if(x%5!==0||z%5!==0)return null;const chance=c.biome==='forest'?.62:c.biome==='snow'?.3:.07;if(this.hash(x,z,711)>chance)return null;return{x,z,y:c.h+1,height:4+Math.floor(this.hash(x,z,712)*4),kind:c.biome==='snow'?'pine':this.hash(x,z,713)>.55?'birch':'oak'};
 }
 plant(x,z,c){if(c.legacy||c.h<=c.water||c.village&&Math.hypot(x-c.village.x,z-c.village.z)<23)return 0;const r=this.hash(x,z,800),flower=this.hash(x,z,801);if(c.biome==='desert')return r<.007?12:0;if(c.biome==='snow'||c.biome==='mountain'||c.biome==='ocean'||c.biome==='river')return 0;if(c.biome==='forest')return r<.11?(flower<.15?41:flower<.55?40:38):0;if(c.biome==='meadow')return r<.24?(flower<.65?32+Math.floor(this.hash(x,z,802)*6):39):0;return r<.13?(flower<.22?32+Math.floor(this.hash(x,z,802)*4):flower<.5?38:39):0;}
 *chunk(cx,cz){const data=new Uint8Array(16*16*HEIGHT),plants=[];const set=(x,y,z,t)=>{if(x>=cx*16&&x<cx*16+16&&z>=cz*16&&z<cz*16+16&&y>=0&&y<HEIGHT)data[localIndex(x,y,z)]=t;};
  for(let z=cz*16;z<cz*16+16;z++){for(let x=cx*16;x<cx*16+16;x++){const c=this.info(x,z),max=Math.min(HEIGHT-1,Math.max(c.h,c.water,c.village?c.village.y+7:0));for(let y=0;y<=max;y++)set(x,y,z,this.base(x,y,z,c));const t=this.plant(x,z,c);if(t)set(x,c.h+1,z,t);}yield null;}
  for(let x=cx*16-3;x<cx*16+19;x++)for(let z=cz*16-3;z<cz*16+19;z++){const t=this.tree(x,z);if(!t)continue;const trunk=t.kind==='birch'?13:t.kind==='pine'?15:4,leaf=t.kind==='birch'?14:t.kind==='pine'?16:5;
   for(let y=t.y;y<t.y+t.height;y++)set(x,y,z,trunk);
   for(let dy=t.kind==='pine'?-4:-1;dy<=2;dy++){const r=t.kind==='pine'?Math.max(0,Math.ceil((2-dy)/2)):2;for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(Math.abs(dx)+Math.abs(dz)+(dy===2?1:0)>r+1)continue;const y=t.y+t.height-1+dy,xx=x+dx,zz=z+dz;if(dx===0&&dz===0&&y<t.y+t.height)continue;if(this.legacy&&!t.legacy&&xx>=0&&xx<64&&zz>=0&&zz<64)continue;const existing=xx>=cx*16&&xx<cx*16+16&&zz>=cz*16&&zz<cz*16+16&&y>=0&&y<HEIGHT?data[localIndex(xx,y,zz)]:0;if(!existing||isPlant(existing))set(xx,y,zz,leaf);}}
  }yield null;return{cx,cz,data,plants};
 }
}
class World {
 constructor(seed=73129,{legacy=false,radius=4,onLoad=()=>{},onUnload=()=>{}}={}){this.seed=seed;this.legacy=legacy;this.terrain=new Terrain(seed,legacy);this.radius=radius;this.chunks=new Map();this.edits=new Map();this.jobs=[];this.pending=new Set();this.onLoad=onLoad;this.onUnload=onUnload;this.center=null;this.generated=0;this.unloaded=0;this.collection={};}
 getChunk(cx,cz){return this.chunks.get(key(cx,cz));}
 info(x,z){return this.terrain.info(Math.floor(x),Math.floor(z));}
 get(x,y,z){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<0||y>=HEIGHT||Math.abs(x)>MAX_COORD||Math.abs(z)>MAX_COORD)return 0;const cx=Math.floor(x/16),cz=Math.floor(z/16),k=key(cx,cz),i=localIndex(x,y,z),c=this.chunks.get(k);if(c)return c.data[i];const edit=this.edits.get(k)?.get(i);return edit===undefined?this.terrain.base(x,y,z):edit;}
 solid(x,y,z){return isSolid(this.get(x,y,z));}
 set(x,y,z,t){if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||y<=0||y>=HEIGHT||Math.abs(x)>MAX_COORD||Math.abs(z)>MAX_COORD||!validType(t))return false;const cx=Math.floor(x/16),cz=Math.floor(z/16),k=key(cx,cz),i=localIndex(x,y,z);let changes=this.edits.get(k);if(!changes)this.edits.set(k,changes=new Map());changes.set(i,t);const c=this.chunks.get(k);if(c){c.blockCount+=(t>0)-(c.data[i]>0);c.data[i]=t;}return true;}
 finish(c){const k=key(c.cx,c.cz);for(const [i,t]of this.edits.get(k)||[])c.data[i]=t;c.key=k;c.blockCount=c.data.reduce((n,t)=>n+(t>0),0);this.chunks.set(k,c);this.pending.delete(k);this.generated++;this.onLoad(c);return c;}
 ensure(cx,cz){let c=this.getChunk(cx,cz);if(c)return c;const k=key(cx,cz);this.jobs=this.jobs.filter(j=>j.key!==k);this.pending.delete(k);const it=this.terrain.chunk(cx,cz);let n;do{n=it.next();}while(!n.done);return this.finish(n.value);}
 ensureNear(x,z,r=1){const cx=Math.floor(x/16),cz=Math.floor(z/16);for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)this.ensure(cx+dx,cz+dz);}
 request(cx,cz){const k=key(cx,cz);if(this.chunks.has(k)||this.pending.has(k))return;this.pending.add(k);this.jobs.push({key:k,cx,cz,it:this.terrain.chunk(cx,cz)});}
 updateCenter(x,z,radius=this.radius){const cx=Math.floor(x/16),cz=Math.floor(z/16),signature=`${cx},${cz},${radius}`;if(this.center===signature)return;this.center=signature;this.radius=radius;const retain=radius+1;
  for(const [k,c]of this.chunks)if(Math.abs(c.cx-cx)>retain||Math.abs(c.cz-cz)>retain){this.chunks.delete(k);this.onUnload(c);this.unloaded++;}
  this.jobs=this.jobs.filter(j=>{const keep=Math.abs(j.cx-cx)<=radius&&Math.abs(j.cz-cz)<=radius;if(!keep)this.pending.delete(j.key);return keep;});
  for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)if(Math.hypot(dx,dz)<=radius+.5)this.request(cx+dx,cz+dz);
  this.jobs.sort((a,b)=>(a.cx-cx)**2+(a.cz-cz)**2-((b.cx-cx)**2+(b.cz-cz)**2));
 }
 tick(x,z,radius=this.radius,budget=3){this.updateCenter(x,z,radius);const now=()=>typeof performance!=='undefined'?performance.now():Date.now(),start=now();let rows=0;while(this.jobs.length&&now()-start<budget&&rows++<32){const j=this.jobs[0],n=j.it.next();if(n.done){this.jobs.shift();this.finish(n.value);}}return rows;}
 exportEdits(){return[...this.edits].map(([k,v])=>[...k.split(',').map(Number),[...v]]);}
 importEdits(records){for(const [cx,cz,entries]of records)this.edits.set(key(cx,cz),new Map(entries));}
 importLegacy(edits){for(const [i,t]of Object.entries(edits)){const n=+i,x=n%64,z=Math.floor(n/64)%64,y=Math.floor(n/4096);this.set(x,y,z,t);}}
 stats(){let bytes=0,blocks=0;for(const c of this.chunks.values()){bytes+=c.data.byteLength;blocks+=c.blockCount;}return{loaded:this.chunks.size,queued:this.jobs.length,generated:this.generated,unloaded:this.unloaded,voxelBytes:bytes,blocks,columnCache:this.terrain.columns.size,editedChunks:this.edits.size};}
}
function validType(t){return Number.isInteger(t)&&(t>=0&&t<=18||t>=22&&t<=28||isPlant(t));}
return{World,Terrain,CHUNK,HEIGHT,SEA,MAX_COORD,PLANTS,BIOMES,isPlant,isSolid,validType,key,localIndex};
});
