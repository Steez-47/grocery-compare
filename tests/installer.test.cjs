const test=require('node:test'),assert=require('node:assert/strict');
const pkg=require('../package.json'),lock=require('../package-lock.json');
test('release identity remains compatible with existing Windows installations',()=>{
 assert.equal(pkg.name,'grocery-compare');
 assert.equal(pkg.build.appId,'nz.grocerycompare.desktop');
 assert.equal(pkg.build.productName,'Grocery Compare');
 assert.equal(pkg.build.nsis.guid,undefined,'Keep the existing GUID derived from appId');
 assert.equal(pkg.build.nsis.perMachine,false);
 assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,false);
});
test('installer contains the runtime, app and browser companion with aligned release versions',()=>{
 assert.equal(pkg.version,lock.version);assert.equal(pkg.version,lock.packages[''].version);
 assert(pkg.build.win.target.some(t=>t.target==='nsis'&&t.arch.includes('x64')));
 for(const file of ['dist/**/*','electron/**/*','package.json'])assert(pkg.build.files.includes(file));
 assert(pkg.build.extraResources.some(r=>r.from==='browser-extension'&&r.to==='browser-extension'));
 assert(pkg.build.nsis.artifactName.includes('${version}'));
});
