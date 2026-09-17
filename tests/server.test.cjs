'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const {createHandler}=require('../server/index.cjs');const {MARKETS}=require('../src/markets.cjs');
const token='a'.repeat(40),m=MARKETS.et;
async function fixture(options,fn){
  const calls=[];const server=http.createServer(createHandler({key:'fake-test-key',token,
    fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({})};},...options}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body,auth=token)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth}`},body:JSON.stringify(body)});
  try{await fn({base,post,calls});}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
}
test('missing server key fails closed, with no upstream request',()=>fixture({key:''},async({post,calls})=>{
  const r=await post('/v1/route',{market:'et'});assert.equal(r.status,503);assert.equal(calls.length,0);
}));
test('unauthorized requests cannot spend Google quota',()=>fixture({},async({post,calls})=>{
  const r=await post('/v1/route',{market:'et'},'wrong');assert.equal(r.status,401);assert.equal(calls.length,0);
}));
test('missing development token fails closed',()=>fixture({token:''},async({post})=>{
  assert.equal((await post('/v1/route',{market:'et'})).status,503);
}));
test('health does not expose credentials',()=>fixture({},async({base})=>{
  const r=await fetch(base+'/health');const text=await r.text();assert.equal(r.status,200);assert.ok(!text.includes('fake-test-key'));assert.ok(!text.includes(token));
}));
test('unsupported market fails before network',()=>fixture({},async({post,calls})=>{
  assert.equal((await post('/v1/route',{market:'xx'})).status,400);assert.equal(calls.length,0);
}));
test('cross-city route fails before network',()=>fixture({},async({post,calls})=>{
  const r=await post('/v1/route',{market:'et',pickup:m.pickup,destination:MARKETS.ug.pickup,travelMode:'DRIVE'});
  assert.equal(r.status,422);assert.equal(calls.length,0);
}));
test('unsupported transport mode is rejected',()=>fixture({},async({post,calls})=>{
  const r=await post('/v1/route',{market:'et',pickup:m.pickup,destination:m.destinations[0],travelMode:'FLY'});
  assert.equal(r.status,400);assert.equal(calls.length,0);
}));
test('autocomplete restricts country and uses the passed session token',async()=>{
  let request;await fixture({fetchImpl:async(url,init)=>{request={url,init};return {ok:true,json:async()=>({suggestions:[{placePrediction:{placeId:'ChIJ_TEST',text:{text:'Bole'},structuredFormat:{mainText:{text:'Bole'},secondaryText:{text:'Addis Ababa'}}}}]})};}},async({post})=>{
    const r=await post('/v1/places/autocomplete',{market:'et',input:'Bole',sessionToken:'my-session'});assert.equal(r.status,200);
    const data=await r.json();assert.equal(data.suggestions[0].placeId,'ChIJ_TEST');
    const body=JSON.parse(request.init.body);assert.deepEqual(body.includedRegionCodes,['et']);assert.equal(body.sessionToken,'my-session');
    assert.equal(request.init.headers['X-Goog-Api-Key'],'fake-test-key');
  });
});
test('place selection returns coordinates rather than a label alone',()=>fixture({fetchImpl:async()=>({ok:true,json:async()=>({id:'ChIJ_TEST',displayName:{text:'Bole'},location:m.destinations[0]})})},async({post})=>{
  const r=await post('/v1/places/details',{market:'et',placeId:'ChIJ_TEST',sessionToken:'same-session'});assert.equal(r.status,200);
  const data=await r.json();assert.equal(data.latitude,m.destinations[0].latitude);assert.equal(data.source,'google');
}));
test('place ID cannot inject an endpoint or query string',()=>fixture({},async({post,calls})=>{
  const r=await post('/v1/places/details',{market:'et',placeId:'../../secret?key=x',sessionToken:'test'});assert.equal(r.status,400);assert.equal(calls.length,0);
}));
test('Google road distance and duration are returned from response fields',async()=>{
  let request;await fixture({fetchImpl:async(url,init)=>{request={url,init};return {ok:true,json:async()=>({routes:[{distanceMeters:5600,duration:'620s',polyline:{encodedPolyline:'encoded-test'}}]})};}},async({post})=>{
    const r=await post('/v1/route',{market:'et',pickup:m.pickup,destination:m.destinations[0],travelMode:'DRIVE'});
    assert.equal(r.status,200);const data=await r.json();assert.equal(data.distanceMeters,5600);assert.equal(data.durationSeconds,620);
    const body=JSON.parse(request.init.body);assert.equal(body.origin.location.latLng.latitude,m.pickup.latitude);
    assert.equal(request.init.headers['X-Goog-FieldMask'],'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline');
  });
});
test('Google quota failure gives a useful, sanitized error',()=>fixture({fetchImpl:async()=>({ok:false,status:429})},async({post})=>{
  const r=await post('/v1/route',{market:'et',pickup:m.pickup,destination:m.destinations[0],travelMode:'DRIVE'});
  assert.equal(r.status,503);const data=await r.json();assert.match(data.error,/quota/);assert.ok(!data.error.includes('fake-test-key'));
}));
test('rate limiting stops excess upstream calls',()=>fixture({},async({post,calls})=>{
  let last;for(let i=0;i<61;i++)last=await post('/v1/places/autocomplete',{market:'et',input:'Bole',sessionToken:'x'});
  assert.equal(last.status,429);assert.equal(calls.length,60);
}));
test('unknown path does not proxy arbitrary URLs',()=>fixture({},async({post,calls})=>{
  assert.equal((await post('/https://example.com',{market:'et'})).status,404);assert.equal(calls.length,0);
}));
