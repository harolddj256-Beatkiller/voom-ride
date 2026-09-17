'use strict';
/** Local development adapter only. Not a ride backend or a public paid-API proxy. */
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const { MARKETS }=require('../src/markets.cjs');
const { coordinates, inServiceArea, validateTrip }=require('../src/geo.cjs');
const MASK={
  autocomplete:'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
  details:'id,displayName,formattedAddress,location,attributions',
  route:'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
};
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
function requiredString(value,name,max=160) {
  if(typeof value!=='string' || !value.trim() || value.length>max || /[\x00-\x1f]/.test(value))
    throw new HttpError(400,`Invalid ${name}.`);
  return value.trim();
}
function getMarket(id) { const m=MARKETS[id];if(!m)throw new HttpError(400,'Unsupported market.');return m; }
function sessionToken(token) {
  if(typeof token!=='string' || !/^[a-zA-Z0-9_-]{1,36}$/.test(token))throw new HttpError(400,'Invalid search session token.');return token;
}
function loadLocalEnv() {
  const file=path.join(__dirname,'.env');if(!fs.existsSync(file))return;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const match=line.match(/^([A-Z_]+)=(.*)$/);if(!match)continue;
    if(!['GOOGLE_MAPS_SERVER_KEY','VOOM_DEV_TOKEN','VOOM_MAPS_HOST','VOOM_MAPS_PORT'].includes(match[1]))continue;
    let value=match[2].trim();if(/^(["']).*\1$/.test(value))value=value.slice(1,-1);
    if(process.env[match[1]]===undefined)process.env[match[1]]=value;
  }
}
function createHandler({ key='',token='',fetchImpl=global.fetch,now=Date.now }={}) {
  const buckets=new Map();let totalStart=now(),total=0;
  function limit(ip) {
    const time=now();if(time-totalStart>=60000){totalStart=time;total=0;}
    if(++total>300)throw new HttpError(429,'Local maps request limit reached. Wait a minute.');
    if(buckets.size>1000)buckets.clear();
    let bucket=buckets.get(ip);
    if(!bucket || time-bucket.start>=60000){bucket={start:time,count:0};buckets.set(ip,bucket);}
    if(++bucket.count>60)throw new HttpError(429,'Too many requests. Wait a minute.');
  }
  const send=(res,status,data) => {
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(data));
  };
  async function google(url,options,mask) {
    const controller=new AbortController();const timer=setTimeout(() => controller.abort(),10000);
    try {
      const response=await fetchImpl(url,{...options,headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':mask,'Content-Type':'application/json'},signal:controller.signal});
      if(!response.ok) {
        if(response.status===429)throw new HttpError(503,'Google quota was reached. Check the Cloud project limits.');
        if(response.status===403 || response.status===401)throw new HttpError(503,'Google configuration needs attention. Check enabled APIs and restricted keys.');
        throw new HttpError(502,'Google could not serve this request or travel mode. Retry, or continue with the straight-line estimate.');
      }
      return await response.json();
    } catch(e) {if(e.name==='AbortError')throw new HttpError(504,'Google request timed out.');throw e;}
    finally {clearTimeout(timer);}
  }
  return async (req,res) => {
    try {
      if(req.method==='GET' && req.url==='/health')return send(res,200,{status:'ok',mode:'local-development-only',googleConfigured:!!key});
      if(req.method!=='POST')throw new HttpError(405,'Only POST is accepted.');
      if(!['/v1/route','/v1/places/autocomplete','/v1/places/details'].includes(req.url))throw new HttpError(404,'Unknown endpoint.');
      if(token.length<32)throw new HttpError(503,'Set a local development access token before enabling maps.');
      const provided=req.headers.authorization || '';const expected=`Bearer ${token}`;
      if(Buffer.byteLength(provided)!==Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))
        throw new HttpError(401,'Maps development token was rejected.');
      if(!key)throw new HttpError(503,'Google maps credentials are not configured.');
      limit(req.socket.remoteAddress || 'unknown');
      if(!String(req.headers['content-type']).startsWith('application/json'))throw new HttpError(415,'Send application/json.');
      let body='',size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>8192)throw new HttpError(413,'Request body is too large.');body+=chunk;}
      let input;try{input=JSON.parse(body);}catch{throw new HttpError(400,'Invalid JSON.');}
      if(!input || Array.isArray(input) || typeof input!=='object')throw new HttpError(400,'Invalid request.');
      const market=getMarket(input.market);
      if(req.url==='/v1/places/autocomplete') {
        const query=requiredString(input.input,'search',128);if(query.length<3)return send(res,200,{suggestions:[]});
        const session=sessionToken(input.sessionToken);
        const data=await google('https://places.googleapis.com/v1/places:autocomplete',{
          method:'POST',body:JSON.stringify({input:query,sessionToken:session,includedRegionCodes:[market.id],
            locationBias:{circle:{center:{latitude:market.map.latitude,longitude:market.map.longitude},radius:50000}}}),
        },MASK.autocomplete);
        const suggestions=(data.suggestions || []).filter(s => s.placePrediction?.placeId).slice(0,5).map(s => {
          const p=s.placePrediction;return {placeId:p.placeId,label:p.structuredFormat?.mainText?.text || p.text?.text || 'Place',
            subtitle:p.structuredFormat?.secondaryText?.text || 'Google Maps'};
        });
        return send(res,200,{source:'google',suggestions});
      }
      if(req.url==='/v1/places/details') {
        const id=requiredString(input.placeId,'place ID',200);const session=sessionToken(input.sessionToken);
        if(!/^[A-Za-z0-9_-]+$/.test(id))throw new HttpError(400,'Invalid place ID.');
        const data=await google(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(session)}`,{method:'GET'},MASK.details);
        let point;try{point=coordinates(data.location);}catch{throw new HttpError(502,'The place has no usable coordinates.');}
        if(!inServiceArea(point,market))throw new HttpError(422,'This place is outside the selected service area.');
        return send(res,200,{...point,id:data.id,label:data.displayName?.text || data.formattedAddress || 'Selected place',
          subtitle:data.formattedAddress || '',source:'google',attributions:data.attributions || []});
      }
      let pickup,destination;
      try{pickup=coordinates(input.pickup);destination=coordinates(input.destination);}catch{throw new HttpError(400,'Invalid pickup or destination.');}
      const invalid=validateTrip(market,pickup,destination);if(invalid)throw new HttpError(422,invalid);
      if(!['DRIVE','TWO_WHEELER'].includes(input.travelMode))throw new HttpError(400,'Unsupported travel mode.');
      const bodyData={ origin:{location:{latLng:pickup}}, destination:{location:{latLng:destination}},
        travelMode:input.travelMode, routingPreference:'TRAFFIC_UNAWARE',computeAlternativeRoutes:false,
        polylineQuality:'OVERVIEW',polylineEncoding:'ENCODED_POLYLINE',units:'METRIC' };
      const data=await google('https://routes.googleapis.com/directions/v2:computeRoutes',{
        method:'POST',body:JSON.stringify(bodyData),
      },MASK.route);
      const route=data.routes?.[0];
      const seconds=Number(String(route?.duration || '').replace(/s$/,''));
      if(!route?.polyline?.encodedPolyline || !Number.isFinite(route.distanceMeters) || route.distanceMeters<=0 || !Number.isFinite(seconds) || seconds<=0)
        throw new HttpError(422,'No road route was returned for these pins and travel mode.');
      return send(res,200,{source:'google',distanceMeters:route.distanceMeters,durationSeconds:seconds,
        encodedPolyline:route.polyline.encodedPolyline});
    } catch(e) {
      if(!res.headersSent)send(res,e.status || 502,{error:e.status?e.message:'Maps request failed. Retry or continue with the straight-line estimate.'});
      else res.end();
    }
  };
}
if(require.main===module) {
  loadLocalEnv();
  if(process.env.NODE_ENV==='production') {
    console.error('This is a LOCAL DEVELOPMENT adapter. Add real user auth, quota controls and HTTPS before public deployment.');process.exit(1);
  }
  if((process.env.VOOM_DEV_TOKEN || '').length<32) {
    console.error('Set VOOM_DEV_TOKEN to at least 32 random characters in server/.env. See MAPS-SETUP.md.');process.exit(1);
  }
  const host=process.env.VOOM_MAPS_HOST || '127.0.0.1';const port=Number(process.env.VOOM_MAPS_PORT || 8787);
  if(!Number.isInteger(port) || port<1024 || port>65535)throw new Error('Invalid development port.');
  const server=http.createServer(createHandler({key:process.env.GOOGLE_MAPS_SERVER_KEY,token:process.env.VOOM_DEV_TOKEN}));
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  server.on('error',e => {console.error(`Maps adapter could not start: ${e.code || 'unknown error'}`);process.exitCode=1;});
  server.listen(port,host,() => console.log(`VOOM local maps adapter on ${host}:${port}. Do NOT expose this port to the internet.`));
}
module.exports={createHandler};
