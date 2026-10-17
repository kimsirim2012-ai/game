/* Item catalog, finite inventory and atomic crafting. Independent of DOM/WebGL. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BlocklandItems=api;})(globalThis,function(){
'use strict';
const ITEMS={};
const add=(id,name,props={})=>ITEMS[id]={id,name,max:64,tile:58,...props};
const blocks={1:['grass','잔디',0],2:['dirt','흙',1],3:['stone','돌',2],4:['log','통나무',3],5:['leaves','나뭇잎',4],6:['sand','모래',5],7:['brick','벽돌',6],8:['planks','판자',7],10:['snow','눈',11],11:['glass','유리',12],12:['cactus','선인장',13],13:['birch_log','자작 통나무',14],14:['birch_leaves','자작잎',15],15:['pine_log','침엽수 통나무',16],16:['pine_leaves','침엽수 잎',17],17:['gravel','자갈',18],18:['path','길',19],22:['workbench','제작대',21],23:['cobblestone','조약돌',20],24:['furnace','화로',22],25:['coal_ore','석탄 광석',23],26:['iron_ore','철 광석',24],27:['diamond_ore','다이아몬드 광석',25],28:['farmland','경작지',26]};
const BLOCK_ITEM={};for(const [n,[id,name,tile]]of Object.entries(blocks)){add(id,name,{block:+n,tile});BLOCK_ITEM[n]=id;}
const plantNames=['민들레','양귀비','데이지','튤립','해바라기','장미 덤불','키 큰 풀','작은 풀','양치식물','버섯'];for(let i=0;i<10;i++){const id='plant_'+(32+i);add(id,plantNames[i],{block:32+i,tile:32+i});BLOCK_ITEM[32+i]=id;}
for(const[id,name,tile]of [['stick','막대기',57],['coal','석탄',63],['raw_iron','철 원석',57],['iron','철괴',49],['diamond','다이아몬드',56],['flint','부싯돌',49],['feather','깃털',48],['string','실',48],['leather','가죽',57],['wool','양털',48],['beef','생소고기',54],['pork','생돼지고기',53],['mutton','생양고기',54],['chicken','생닭고기',53],['rabbit','생토끼고기',53],['fish','생선',56],['bone','뼈',48],['rotten_flesh','썩은 살점',57],['gunpowder','화약',49],['arrow','화살',58]])add(id,name,{tile});
const MATERIALS={wood:{name:'나무',tier:1,speed:3,durability:59,tile:57,material:'planks'},stone:{name:'돌',tier:2,speed:5,durability:131,tile:49,material:'cobblestone'},iron:{name:'철',tier:3,speed:7,durability:250,tile:48,material:'iron'},diamond:{name:'다이아몬드',tier:4,speed:9,durability:1561,tile:56,material:'diamond'}};
const toolNames={pickaxe:'곡괭이',axe:'도끼',shovel:'삽',hoe:'괭이',sword:'검'};
for(const [mat,m]of Object.entries(MATERIALS))for(const [kind,name]of Object.entries(toolNames))add(mat+'_'+kind,m.name+' '+name,{max:1,kind,material:mat,tier:m.tier,speed:m.speed,durability:m.durability,tile:m.tile,damage:kind==='sword'?3+m.tier:kind==='axe'?6+m.tier:2+m.tier,attackSpeed:kind==='sword'?1.6:kind==='axe'?.8+(m.tier-1)*.08:1.2});
add('bow','활',{max:1,kind:'bow',durability:384,tile:57,damage:7,attackSpeed:1});add('shield','방패',{max:1,kind:'shield',durability:336,tile:57,damage:1,attackSpeed:2});add('shears','가위',{max:1,kind:'shears',durability:238,tile:49,speed:12,tier:3,damage:2,attackSpeed:2});add('fishing_rod','낚싯대',{max:1,kind:'rod',durability:64,tile:57,damage:1,attackSpeed:2});
function stack(id,count=1,durability){const def=ITEMS[id];if(!def)throw Error('Unknown item '+id);return{id,count:Math.max(1,Math.min(def.max,count|0)),...(def.durability?{durability:durability===undefined?def.durability:durability}:{})};}
function validStack(s){if(s===null)return true;const d=s&&ITEMS[s.id];return!!d&&Number.isInteger(s.count)&&s.count>0&&s.count<=d.max&&(!d.durability||Number.isInteger(s.durability)&&s.durability>0&&s.durability<=d.durability);}
class Inventory {
 constructor(slots=null){this.slots=Array.from({length:36},(_,i)=>slots?.[i]?{...slots[i]}:null);this.revision=0;}
 count(id){return this.slots.reduce((n,s)=>n+(s?.id===id?s.count:0),0);}
 capacity(id){const d=ITEMS[id];if(!d)return 0;return this.slots.reduce((n,s)=>n+(!s?d.max:s.id===id&&!d.durability?d.max-s.count:0),0);}
 add(id,count=1,durability){if(!ITEMS[id]||count<=0)return count;const d=ITEMS[id];let left=count;if(!d.durability)for(const s of this.slots)if(s?.id===id&&s.count<d.max){const n=Math.min(left,d.max-s.count);s.count+=n;left-=n;if(!left)break;}
  for(let i=0;left>0&&i<36;i++)if(!this.slots[i]){const n=Math.min(left,d.max);this.slots[i]=stack(id,n,durability);left-=n;}if(left!==count)this.revision++;return left;
 }
 remove(id,count){if(!Number.isInteger(count)||count<0||this.count(id)<count)return false;let left=count;for(let i=0;i<36&&left;i++){const s=this.slots[i];if(s?.id!==id)continue;const n=Math.min(left,s.count);s.count-=n;left-=n;if(!s.count)this.slots[i]=null;}this.revision++;return true;}
 take(i,count=Infinity){const s=this.slots[i];if(!s)return null;const n=Math.min(s.count,count),result={...s,count:n};s.count-=n;if(!s.count)this.slots[i]=null;this.revision++;return result;}
 move(from,to,half=false){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=36||to>=36||from===to)return false;const a=this.slots[from],b=this.slots[to];if(!a)return false;if(!b){const n=half?Math.ceil(a.count/2):a.count;this.slots[to]=this.take(from,n);}
  else if(a.id===b.id&&!ITEMS[a.id].durability){const n=Math.min(half?Math.ceil(a.count/2):a.count,ITEMS[a.id].max-b.count);if(!n)return false;b.count+=n;a.count-=n;if(!a.count)this.slots[from]=null;}
  else{if(half)return false;[this.slots[from],this.slots[to]]=[b,a];}this.revision++;return true;
 }
 quickMove(i){const s=this.slots[i];if(!s)return false;const order=i<9?Array.from({length:27},(_,j)=>j+9):Array.from({length:9},(_,j)=>j);for(const j of order)if(this.slots[j]?.id===s.id&&!ITEMS[s.id].durability)this.move(i,j);for(const j of order)if(this.slots[i]&&!this.slots[j])this.move(i,j);return true;}
 wear(i,amount=1){const s=this.slots[i],d=s&&ITEMS[s.id];if(!d?.durability)return false;s.durability-=amount;if(s.durability<=0){this.slots[i]=null;this.revision++;return true;}this.revision++;return false;}
 export(){return this.slots.map(s=>s?{...s}:null);}
}
const RECIPES=[];
const recipe=(id,label,ingredients,output,count=1,station='hand')=>RECIPES.push({id,label,ingredients,output,count,station});
for(const id of ['log','birch_log','pine_log'])recipe('planks_'+id,ITEMS[id].name+' → 판자',{[id]:1},'planks',4);
recipe('sticks','막대기',{planks:2},'stick',4);recipe('workbench','제작대',{planks:4},'workbench');recipe('flint','부싯돌 다듬기',{cobblestone:1},'flint');
recipe('furnace','화로',{cobblestone:8},'furnace',1,'bench');
for(const [mat,m]of Object.entries(MATERIALS))for(const [kind,name]of Object.entries(toolNames)){const need=kind==='sword'?2:kind==='shovel'?1:kind==='hoe'?2:3,sticks=kind==='sword'?1:2;recipe(mat+'_'+kind,m.name+' '+name,{[m.material]:need,stick:sticks},mat+'_'+kind,1,'bench');}
recipe('bow','활',{stick:3,string:3},'bow',1,'bench');recipe('arrows','화살 4개',{stick:1,flint:1,feather:1},'arrow',4,'bench');recipe('shield','방패',{planks:6,iron:1},'shield',1,'bench');recipe('shears','가위',{iron:2},'shears');recipe('rod','낚싯대',{stick:3,string:2},'fishing_rod',1,'bench');
function craft(inv,id,bench=false){const r=RECIPES.find(r=>r.id===id);if(!r||r.station==='bench'&&!bench||!Object.entries(r.ingredients).every(([id,n])=>inv.count(id)>=n))return{ok:false,reason:'재료 또는 가까운 제작대가 필요합니다.'};
 const copy=new Inventory(inv.export());for(const [id,n]of Object.entries(r.ingredients))copy.remove(id,n);if(copy.add(r.output,r.count)>0)return{ok:false,reason:'인벤토리 공간이 부족합니다.'};inv.slots=copy.slots;inv.revision++;return{ok:true,recipe:r};
}
function miningInfo(block,held){const d=held&&ITEMS[held.id],leaves=[5,14,16].includes(block),wood=[4,8,13,15,22].includes(block),rock=[3,7,23,24,25,26,27].includes(block),soil=[1,2,6,10,17,18,28].includes(block),plant=block>=32&&block<=41;const kind=wood?'axe':rock?'pickaxe':leaves?'shears':soil?'shovel':null;const correct=d?.kind===kind||leaves&&d?.kind==='sword';let seconds=plant?.12:leaves?.4:wood?2.4:rock?4:soil?.65:block===11?.35:1;const required=block===27?3:block===26?2:rock?1:0,canDrop=!required||d?.kind==='pickaxe'&&d.tier>=required;if(correct)seconds/=d.speed||2;if(rock&&!correct)seconds*=1.7;
 let drop=block===1||block===28||block===18?'dirt':block===3?'cobblestone':block===25?'coal':block===26?'raw_iron':block===27?'diamond':BLOCK_ITEM[block];if(leaves&&d?.kind!=='shears')drop=null;if(block===11&&d?.kind!=='shears')drop=null;if(plant&&(block===38||block===39||block===40)&&d?.kind!=='shears')drop=null;
 return{seconds:Math.max(.08,seconds),correct,canDrop,drop:canDrop?drop:null};
}
return{ITEMS,BLOCK_ITEM,MATERIALS,RECIPES,Inventory,stack,validStack,craft,miningInfo};
});
