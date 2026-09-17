'use strict';
// Unit-level hook logic only: React setters, Location and native dialogs are mocks.
// This does not validate native permissions, rendering or real GPS hardware.
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {createRequire}=require('node:module');const {MARKETS}=require('../src/markets.cjs');
function mount(location={}) {
  const file=path.resolve(__dirname,'../src/usePickup.js');
  const source=fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replace(/export function /g,'function ');
  const state=[],cleanup=[],alerts=[],switches=[];
  let stateIndex=0;
  const context={ module:{exports:{}},require:createRequire(file),setTimeout,clearTimeout,
    useState(initial){const index=stateIndex++;state[index]=initial;return [initial,value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},
    useRef(value){return {current:value};},useEffect(effect){cleanup.push(effect());},
    Alert:{alert:(...args)=>alerts.push(args)},Linking:{openSettings:async()=>{}},
    Location:{Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>({status:'granted',canAskAgain:true}),
      hasServicesEnabledAsync:async()=>true,getCurrentPositionAsync:async()=>({coords:{latitude:9.02,longitude:38.76,accuracy:12}}),
      getLastKnownPositionAsync:async()=>null,reverseGeocodeAsync:async()=>[],...location},
  };
  vm.runInNewContext(source+'\nmodule.exports={usePickup};',context,{filename:file});
  const hook=context.module.exports.usePickup(MARKETS.et,(...args)=>switches.push(args));
  return {hook,state,alerts,switches,cleanup};
}
test('denied GPS permission leaves the default pickup and explains manual fallback',async()=>{
  const {hook,state}=mount({requestForegroundPermissionsAsync:async()=>({status:'denied',canAskAgain:true})});
  await hook.locate();assert.equal(state[0].latitude,MARKETS.et.pickup.latitude);assert.match(state[1],/permission is off/);assert.equal(state[2],false);
});
test('GPS success updates actual pickup coordinates and measured accuracy',async()=>{
  const {hook,state}=mount();await hook.locate();assert.equal(state[0].latitude,9.02);assert.equal(state[0].longitude,38.76);
  assert.equal(state[0].source,'gps');assert.match(state[1],/12 m/);assert.equal(state[2],false);
});
test('late GPS response cannot overwrite a manually chosen pickup',async()=>{
  let finish;const fix=new Promise(resolve=>{finish=resolve;});const {hook,state}=mount({getCurrentPositionAsync:()=>fix});
  const pending=hook.locate();await new Promise(setImmediate);
  hook.choose({latitude:9.03,longitude:38.77});finish({coords:{latitude:9.02,longitude:38.76,accuracy:10}});await pending;
  assert.equal(state[0].latitude,9.03);assert.equal(state[0].longitude,38.77);assert.equal(state[0].source,'pin');
});
test('a GPS fix in Kampala asks before changing Addis market',async()=>{
  const {hook,state,alerts,switches}=mount({getCurrentPositionAsync:async()=>({coords:{...MARKETS.ug.pickup,accuracy:15}})});
  await hook.locate();assert.equal(state[0].latitude,MARKETS.et.pickup.latitude);assert.equal(switches.length,0);
  assert.match(alerts[0][0],/another service city/);alerts[0][2][1].onPress();assert.equal(switches[0][0],'ug');
});
test('city reset invalidates an in-flight GPS result',async()=>{
  let finish;const fix=new Promise(resolve=>{finish=resolve;});const {hook,state}=mount({getCurrentPositionAsync:()=>fix});
  const pending=hook.locate();await new Promise(setImmediate);hook.reset(MARKETS.ug);
  finish({coords:{latitude:9.02,longitude:38.76}});await pending;assert.equal(state[0].latitude,MARKETS.ug.pickup.latitude);
});
test('disabled device location reports a useful fallback instead of claiming live pickup',async()=>{
  const {hook,state}=mount({hasServicesEnabledAsync:async()=>false});await hook.locate();
  assert.match(state[1],/switched off/);assert.equal(state[0].source,'default');assert.equal(state[2],false);
});
