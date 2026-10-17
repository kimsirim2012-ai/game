const{test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/environment.js');
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('day lasts 1020 seconds and night lasts 240 seconds on the legacy clock',()=>{
 assert.equal(E.DAY_SECONDS,1020);assert.equal(E.NIGHT_SECONDS,240);assert.equal(E.CYCLE_SECONDS,1260);
 near(E.advanceTime(0,1020),600);near(E.advanceTime(600,240),0);near(E.advanceTime(0,1260),0);
 near(E.advanceTime(300,17),310);near(E.advanceTime(900,4),910);
});
test('boundary crossing uses both actual rates, including multiple complete days',()=>{
 near(E.advanceTime(599,2.1),601);near(E.advanceTime(1199,2.1),1);
 near(E.advanceTime(260,1260*20+17),270);near(E.advanceTime(900,1260*3),900);
});
test('saved noon, midnight and other phases remain unchanged when paused',()=>{
 for(const t of [0,260,260.1234567890123,300,599,600,900,1199.9]){const e=new E.Environment(t);for(let i=0;i<100;i++)e.update(0,'forest',false);assert.equal(e.time,t);}
 assert.equal(E.normalizeTime(-300),900);assert.equal(E.normalizeTime(1500),300);
});
test('15/60/144 FPS and large increments give the same complete 21-minute day',()=>{
 for(const fps of [15,60,144]){const e=new E.Environment(0);for(let i=0;i<1260*fps;i++)e.update(1/fps,'plains',false);const error=Math.min(e.time,1200-e.time);near(error,0,1e-5);}
});
test('bright daylight, dark moonlight and warm continuous sunrise/sunset share the clock',()=>{
 const day=new E.Environment(300),night=new E.Environment(900);assert.equal(day.day,1);assert.equal(night.day,.16);
 assert.equal(day.phase,'day');assert.equal(night.phase,'night');assert.ok(day.sky[2]>.9);assert.ok(night.sky[2]<.3);
 near(Math.sin(day.angle),1);near(Math.sin(night.angle+Math.PI),1);
 for(const t of [0,600]){const before=new E.Environment(E.normalizeTime(t-.001)),after=new E.Environment(t+.001),at=new E.Environment(t);near(before.day,after.day,1e-6);at.sky.forEach((n,i)=>near(before.sky[i],after.sky[i],1e-5));assert.ok(at.sky[0]>at.sky[1]);near(at.day,.4);}
 assert.ok(new E.Environment(599).day>.4);assert.ok(new E.Environment(601).day<.4);
});
test('monster light sampling is the same ambient depth factor rendered by voxel faces',()=>{
 const e=new E.Environment(300),world={info:()=>({h:40})};near(e.lightAt(world,0,41,0),1);near(e.lightAt(world,0,20,0),.22);
 e.time=900;e.update(0,'plains',false);near(e.lightAt(world,0,41,0),.16);
});
