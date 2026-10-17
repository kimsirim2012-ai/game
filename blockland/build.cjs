/* Rebuild the single offline HTML. Run: node build.cjs */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname;
const template=fs.readFileSync(path.join(root,'src/Blockland.template.html'),'utf8');
const scripts=['physics.js','world.js','storage.js','items.js','ecosystem.js','environment.js','adventure.js','adventure-view.js','game.js'].map(name=>{const code=fs.readFileSync(path.join(root,'src',name),'utf8');new vm.Script(code,{filename:name});return code;}).join('\n');
if(scripts.includes('</script'))throw Error('Source must not contain closing script tag');
fs.writeFileSync(path.join(root,'Blockland.html'),template.replace('/* BLOCKLAND_SCRIPTS */',scripts));
console.log('Built Blockland.html (offline, no runtime dependencies).');
