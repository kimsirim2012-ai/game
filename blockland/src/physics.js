/* Blockland physics. Feet coordinates, blocks/metres, seconds. No DOM or renderer dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BlocklandPhysics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const EPS=1e-7;
const CONFIG=Object.freeze({fixedDt:1/120,width:.6,height:1.8,crouchHeight:1.5,eye:1.62,crouchEye:1.27,walk:4.317,sprint:5.612,crouch:1.295,swim:2.2,fly:8.1,gravity:32,jump:9.05,terminal:78,groundAcceleration:55,groundBrake:36,airAcceleration:7});
const approach=(a,b,d)=>a<b?Math.min(a+d,b):Math.max(a-d,b);
class Player {
 constructor(world,feet,config={}){this.world=world;this.config={...CONFIG,...config};this.position={...feet};this.previous={...feet};this.velocity={x:0,y:0,z:0};this.grounded=false;this.crouched=false;this.sprinting=false;this.flying=false;this.inWater=false;this.headUnderwater=false;this.accumulator=0;this.ticks=0;this.simulatedTime=0;this.discardedTime=0;this.landingSpeed=0;}
 get height(){return this.crouched?this.config.crouchHeight:this.config.height;}
 get eyeHeight(){return this.crouched?this.config.crouchEye:this.config.eye;}
 bounds(p=this.position,height=this.height){const r=this.config.width/2;return{min:{x:p.x-r,y:p.y,z:p.z-r},max:{x:p.x+r,y:p.y+height,z:p.z+r}};}
 intersectsBlock(x,y,z){const b=this.bounds();return b.max.x>x+EPS&&b.min.x<x+1-EPS&&b.max.y>y+EPS&&b.min.y<y+1-EPS&&b.max.z>z+EPS&&b.min.z<z+1-EPS;}
 collides(p=this.position,height=this.height){const b=this.bounds(p,height);for(let x=Math.floor(b.min.x+EPS);x<=Math.floor(b.max.x-EPS);x++)for(let y=Math.floor(b.min.y+EPS);y<=Math.floor(b.max.y-EPS);y++)for(let z=Math.floor(b.min.z+EPS);z<=Math.floor(b.max.z-EPS);z++)if(this.world.solid(x,y,z))return true;return false;}
 supported(p=this.position){const r=this.config.width/2;const y=Math.floor(p.y-.06);for(let x=Math.floor(p.x-r+EPS);x<=Math.floor(p.x+r-EPS);x++)for(let z=Math.floor(p.z-r+EPS);z<=Math.floor(p.z+r-EPS);z++)if(this.world.solid(x,y,z)&&p.y>=y+1-EPS&&p.y<y+1+.061)return true;return false;}
 reset(feet){this.position={...feet};this.previous={...feet};this.velocity={x:0,y:0,z:0};this.accumulator=0;this.crouched=false;this.sprinting=false;this.grounded=this.supported();}
 ensureSafe(){if(!this.collides())return false;const p={...this.position};for(let y=Math.floor(p.y)+1;y<=(this.world.maxY||128)+2;y++){p.y=y;if(!this.collides(p)){this.reset(p);return true;}}return false;}
 moveAxis(axis,delta){if(Math.abs(delta)<EPS)return 0;const b=this.bounds(),swept={min:{...b.min},max:{...b.max}};swept.min[axis]+=Math.min(0,delta);swept.max[axis]+=Math.max(0,delta);let allowed=delta;const others=['x','y','z'].filter(k=>k!==axis);
  for(let x=Math.floor(swept.min.x+EPS);x<=Math.floor(swept.max.x-EPS);x++)for(let y=Math.floor(swept.min.y+EPS);y<=Math.floor(swept.max.y-EPS);y++)for(let z=Math.floor(swept.min.z+EPS);z<=Math.floor(swept.max.z-EPS);z++){
   if(!this.world.solid(x,y,z))continue;const cell={x,y,z};if(!others.every(k=>b.max[k]>cell[k]+EPS&&b.min[k]<cell[k]+1-EPS))continue;
   if(delta>0&&b.max[axis]<=cell[axis]+EPS)allowed=Math.min(allowed,Math.max(0,cell[axis]-b.max[axis]));
   if(delta<0&&b.min[axis]>=cell[axis]+1-EPS)allowed=Math.max(allowed,Math.min(0,cell[axis]+1-b.min[axis]));
  }
  const bounds=this.world.bounds;if(bounds&&axis!=='y')allowed=Math.max(bounds.min[axis]+this.config.width/2-this.position[axis],Math.min(bounds.max[axis]-this.config.width/2-this.position[axis],allowed));
  this.position[axis]+=allowed;if(Math.abs(allowed-delta)>EPS)this.velocity[axis]=0;return allowed;
 }
 updateWater(){const p=this.position;this.inWater=!!this.world.fluid?.(Math.floor(p.x),Math.floor(p.y+.4),Math.floor(p.z));this.headUnderwater=!!this.world.fluid?.(Math.floor(p.x),Math.floor(p.y+this.eyeHeight),Math.floor(p.z));}
 tick(dt,input){this.previous={...this.position};const c=this.config;this.landingSpeed=0;this.flying=!!input.flying;this.updateWater();
  if(input.crouch&&!this.flying&&!this.inWater)this.crouched=true;else if(!this.collides(this.position,c.height))this.crouched=false;
  const forward=(input.forward||0),strafe=(input.strafe||0),length=Math.hypot(forward,strafe)||1,yaw=input.yaw||0;
  this.sprinting=!!input.sprint&&forward>0&&!this.crouched&&!this.inWater;
  const speed=this.flying?c.fly*(input.sprint?1.3:1):this.inWater?c.swim:this.crouched?c.crouch:this.sprinting?c.sprint:c.walk;
  const dx=(strafe/length*Math.cos(yaw)+forward/length*Math.sin(yaw))*Math.min(1,length),dz=(strafe/length*Math.sin(yaw)-forward/length*Math.cos(yaw))*Math.min(1,length);
  const moving=!!(forward||strafe),accel=this.flying?30:this.inWater?10:this.grounded?(moving?c.groundAcceleration:c.groundBrake):c.airAcceleration;
  // Vector acceleration avoids faster diagonal starts and stops.
  let ax=dx*speed-this.velocity.x,az=dz*speed-this.velocity.z;const change=Math.hypot(ax,az),amount=Math.min(1,accel*dt/(change||1));this.velocity.x+=ax*amount;this.velocity.z+=az*amount;
  if(this.flying){this.grounded=false;this.velocity.y=approach(this.velocity.y,((input.jump?1:0)-(input.descend?1:0))*speed,30*dt);}
  else if(this.inWater){this.grounded=false;this.velocity.y+=(input.jump?12:input.crouch?-10:-4)*dt;this.velocity.y*=Math.exp(-2*dt);this.velocity.y=Math.max(-3,Math.min(3.5,this.velocity.y));}
  else{if(this.grounded&&input.jump){this.velocity.y=c.jump;this.grounded=false;}this.velocity.y=Math.max(-c.terminal,this.velocity.y-c.gravity*dt);}
  let mx=this.velocity.x*dt,mz=this.velocity.z*dt;
  if(this.crouched&&this.grounded&&!this.flying&&!this.inWater){const test=(x,z)=>this.supported({...this.position,x:this.position.x+x,z:this.position.z+z});const reduce=n=>approach(n,0,.025);while(Math.abs(mx)>EPS&&!test(mx,0))mx=reduce(mx);while(Math.abs(mz)>EPS&&!test(0,mz))mz=reduce(mz);while((Math.abs(mx)>EPS||Math.abs(mz)>EPS)&&!test(mx,mz)){mx=reduce(mx);mz=reduce(mz);}}
  const oldVy=this.velocity.y,my=oldVy*dt;this.moveAxis('y',my);this.grounded=!this.flying&&my<0&&this.velocity.y===0;if(this.grounded)this.landingSpeed=-oldVy;
  this.moveAxis('x',mx);this.moveAxis('z',mz);
  if(this.world.ceiling!==undefined&&this.position.y>this.world.ceiling){this.position.y=this.world.ceiling;this.velocity.y=0;}
  this.ticks++;this.simulatedTime+=dt;
 }
 advance(elapsed,input){if(!Number.isFinite(elapsed)||elapsed<0)return 0;/* A hidden/suspended tab never simulates minutes of catch-up. */
  const bounded=Math.min(elapsed,.25);this.discardedTime+=Math.max(0,elapsed-bounded);this.accumulator+=bounded;let count=0;while(this.accumulator+EPS>=this.config.fixedDt){this.tick(this.config.fixedDt,input);this.accumulator-=this.config.fixedDt;count++;}this.accumulator=Math.max(0,this.accumulator);return count;
 }
 interpolated(){const a=Math.min(1,this.accumulator/this.config.fixedDt);return{x:this.previous.x+(this.position.x-this.previous.x)*a,y:this.previous.y+(this.position.y-this.previous.y)*a,z:this.previous.z+(this.position.z-this.previous.z)*a};}
}
return{Player,CONFIG};
});
