const CACHE_NAME="eclair-paris-runtime-v3";
const CORE=["./","./index.html","./manifest.webmanifest","./styles.css","./app.js","./data/paris_shops.json","./data/paris_boundary.geojson","./icons/apple-touch-icon.png","./assets/eclair-paris-splash.jpg"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE.map(url=>cache.add(new Request(url,{cache:"reload"}))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const fresh=await fetch(req,{cache:"no-store"});
      if(fresh&&fresh.ok)cache.put(req,fresh.clone());
      return fresh;
    }catch(err){
      const cached=await cache.match(req,{ignoreSearch:true});
      if(cached)return cached;
      if(req.mode==="navigate"){
        const fallback=await cache.match("./index.html");
        if(fallback)return fallback;
      }
      throw err;
    }
  })());
});
