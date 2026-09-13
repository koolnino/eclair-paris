const SUPABASE_URL = "https://okqshfosuzirajqbezar.supabase.co";
const SUPABASE_KEY = "sb_publishable_yyxTSUP7k7KVz3gBvlSeWQ_FguXuKYh";
const sb = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let bakeries=[], catalog=[], rankings=[], reportSummary=[], favorites=[], currentUser=null, currentEclair=null, map, markers=[], isAdmin=false, adminReports=[];
const criteria=[
  ["chocolate_taste","Goût du chocolat",30],
  ["filling","Crème / garniture",20],
  ["choux_pastry","Pâte à choux",20],
  ["glaze","Glaçage",10],
  ["texture_balance","Texture / équilibre",10],
  ["value_for_money","Rapport qualité-prix",10]
];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const arrText=v=>v?String(v).replace(/\D/g,""):"";
const price=v=>v==null?"Prix à confirmer":new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(v);

function setupArrondissements(){
  for(const id of ["arrFilter","rankingArr"]){const s=document.getElementById(id);for(let i=1;i<=20;i++){const o=document.createElement("option");o.value=String(i);o.textContent=i===1?"1er":i+"e";s.appendChild(o)}}
}
async function loadData(){
  const eclairPromise=sb?sb.from("eclairs").select("id,name,price_eur,description,photo_url,availability_status,source_url,verified_at,bakeries(id,catalog_id,name,address,postal_code,arrondissement,latitude,longitude,phone,website)").eq("active",true):Promise.resolve({data:[],error:null});
  const rankingPromise=sb?sb.from("eclair_rankings").select("*"):Promise.resolve({data:[]});
  const reportPromise=sb?sb.from("eclair_report_summary").select("*"):Promise.resolve({data:[]});
  const [{data:b,error:be},{data:r},{data:rs},catalogData] = await Promise.all([
    eclairPromise,
    rankingPromise,
    reportPromise,
    fetch("./data/paris_shops.json",{cache:"no-store"}).then(res=>res.ok?res.json():null).catch(()=>null)
  ]);
  if(be) console.warn("Supabase indisponible, affichage du catalogue public uniquement.",be);
  bakeries=(b||[]).map(x=>({...x,...x.bakeries,bakery_id:x.bakeries?.id,eclair_id:x.id}));
  reportSummary=rs||[];
  const reportByCatalog=new Map(reportSummary.map(x=>[x.catalog_id,x]));
  const verifiedCatalogIds=new Set(bakeries.map(x=>x.catalog_id).filter(Boolean));
  catalog=(catalogData?.establishments||[]).filter(x=>!verifiedCatalogIds.has(x.catalog_id)).map(x=>{
    const report=reportByCatalog.get(x.catalog_id);
    return {
      ...x,
      eclair_id:null,
      price_eur:null,
      description:null,
      verified_at:null,
      report_count:Number(report?.report_count||0),
      avg_reported_price:report?.avg_reported_price==null?null:Number(report.avg_reported_price),
      last_report_at:report?.last_report_at||null,
      availability_status:report?"reported":"catalog"
    };
  });
  rankings=r||[];
  await loadFavorites();
  renderAll();
}
async function loadFavorites(){
  if(!currentUser||!sb){favorites=[];return;}
  const {data}=await sb.from("favorites").select("eclair_id,status").eq("user_id",currentUser.id);
  favorites=data||[];
}
function rankingFor(id){return rankings.find(r=>r.eclair_id===id)||{}}
function scoreOf(x){const r=rankingFor(x.eclair_id);return Number(r.average_score??r.avg_score??0)}
function votesOf(x){const r=rankingFor(x.eclair_id);return Number(r.vote_count??r.votes_count??0)}
function isFavorite(id){return favorites.some(f=>f.eclair_id===id)}
function filtered(){
  const q=document.getElementById("searchInput").value.trim().toLowerCase(),a=document.getElementById("arrFilter").value,s=document.getElementById("statusFilter").value;
  return [...catalog,...bakeries].filter(x=>(!q||[x.name,x.address,x.postal_code].some(v=>String(v||"").toLowerCase().includes(q)))&&(!a||arrText(x.arrondissement)===a)&&(!s||x.availability_status===s));
}
function initMap(){
  const parisBounds=L.latLngBounds([48.8156,2.2241],[48.9022,2.4699]);
  map=L.map("map",{zoomControl:false,maxBounds:parisBounds,maxBoundsViscosity:1.0,minZoom:12}).setView([48.8566,2.3522],12);
  L.control.zoom({position:"bottomright"}).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:19}).addTo(map);
  map.on("zoomend moveend",()=>{if(catalog.length||bakeries.length)renderMap()});
  loadParisBoundary();
}
async function loadParisBoundary(){
  try{
    const res=await fetch("./data/paris_boundary.geojson",{cache:"no-store"});
    if(!res.ok) return;
    const geo=await res.json();
    const layer=L.geoJSON(geo,{style:{color:"#2b1b17",weight:2,fill:false,interactive:false}}).addTo(map);
    const ring=geo?.features?.[0]?.geometry?.coordinates?.[0];
    if(Array.isArray(ring)&&ring.length){
      const hole=ring.map(([lng,lat])=>[lat,lng]);
      const outer=[[48.74,2.08],[48.74,2.62],[48.98,2.62],[48.98,2.08]];
      L.polygon([outer,hole],{
        stroke:false,
        fillColor:"#fbf7f2",
        fillOpacity:0.78,
        fillRule:"evenodd",
        interactive:false
      }).addTo(map).bringToBack();
      map.setMaxBounds(layer.getBounds().pad(0.03));
      map.fitBounds(layer.getBounds(),{padding:[8,8]});
    }
  }catch(err){console.warn("Contour de Paris indisponible",err);}
}
function addSingleMarker(x){
  const verified=x.availability_status==="verified";
  const reported=x.availability_status==="reported";
  const unavailable=x.availability_status==="unavailable";
  const fav=isFavorite(x.eclair_id);
  const markerColor=verified?"#4f8d47":reported?"#d9902f":unavailable?"#b9aaa2":"#9b8f88";
  const size=verified||reported?20:15;
  const border=verified||reported?3:2;
  const statusLabel=verified?"✓ Éclair vérifié":reported?`Signalé par la communauté · ${x.report_count||1} signalement${Number(x.report_count||1)>1?"s":""}`:unavailable?"Indisponible":"Adresse recensée";
  const icon=L.divIcon({
    className:"",
    html:`<div class="map-pin-dot ${verified?"verified":reported?"reported":"catalog"}" style="width:${size}px;height:${size}px;background:${markerColor};border:${border}px solid ${fav?"#e5b642":"white"}"></div>`,
    iconSize:[size,size],
    iconAnchor:[size/2,size/2]
  });
  const m=L.marker([x.latitude,x.longitude],{icon,zIndexOffset:verified?800:reported?600:0}).addTo(map);
  m.bindPopup(`<strong>${esc(x.name)}</strong><br>${esc(x.address)}<br>${statusLabel}`);
  m.on("click",()=>showDetail(x));
  markers.push(m);
}

function addClusterMarker(group){
  const count=group.items.length;
  const avgLat=group.items.reduce((s,x)=>s+Number(x.latitude),0)/count;
  const avgLng=group.items.reduce((s,x)=>s+Number(x.longitude),0)/count;
  const size=count>=100?50:count>=50?46:count>=20?42:count>=10?38:34;
  const icon=L.divIcon({
    className:"",
    html:`<div class="catalog-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
    iconSize:[size,size],
    iconAnchor:[size/2,size/2]
  });
  const m=L.marker([avgLat,avgLng],{icon}).addTo(map);
  m.bindTooltip(`${count} adresses recensées`,{direction:"top",offset:[0,-8]});
  m.on("click",()=>{
    if(map.getZoom()<16) map.setView([avgLat,avgLng],Math.min(map.getZoom()+2,16));
  });
  markers.push(m);
}

function renderMap(){
  markers.forEach(m=>m.remove());markers=[];
  const list=filtered().filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude)));
  const zoom=map.getZoom();
  const priority=list.filter(x=>x.availability_status==="verified"||x.availability_status==="reported"||x.availability_status==="unavailable");
  const ordinary=list.filter(x=>!priority.includes(x));

  priority.forEach(addSingleMarker);

  if(zoom>=15){
    ordinary.forEach(addSingleMarker);
  }else{
    const cellSize=zoom<=12?78:zoom===13?68:58;
    const groups=new Map();
    for(const x of ordinary){
      const p=map.latLngToLayerPoint([x.latitude,x.longitude]);
      const key=`${Math.floor(p.x/cellSize)}:${Math.floor(p.y/cellSize)}`;
      if(!groups.has(key))groups.set(key,{items:[]});
      groups.get(key).items.push(x);
    }
    for(const group of groups.values()){
      if(group.items.length===1)addSingleMarker(group.items[0]);
      else addClusterMarker(group);
    }
  }
  document.getElementById("mapCount").textContent=`${list.length} établissement${list.length>1?"s":""}`;
}

function card(x,withScore=false){
  const sc=scoreOf(x),vc=votesOf(x),verified=x.availability_status==="verified";
  return `<button class="card" data-id="${esc(x.eclair_id)}"><div class="row"><div><h3>${esc(x.name)}</h3><div class="meta">${esc(x.address)}</div></div>${withScore&&vc?`<div><div class="score">${sc.toFixed(1)}</div><div class="meta">${vc} vote${vc>1?"s":""}</div></div>`:""}</div><div class="row"><span class="badge ${verified?"":"unknown"}">${verified?"Éclair vérifié":"À vérifier"}</span><span class="price">${price(x.price_eur)}</span></div></button>`;
}
function bindCards(root){root.querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>{const x=bakeries.find(b=>b.eclair_id===el.dataset.id);if(x)showDetail(x)})}
function valueScoreOf(x){
  const s=scoreOf(x),p=Number(x.price_eur);
  if(!votesOf(x)||!Number.isFinite(p)||p<=0)return -Infinity;
  return s/p;
}
function renderRanking(){
  const arr=document.getElementById("rankingArr").value;
  const mode=document.getElementById("rankingMode").value;
  const list=bakeries.filter(x=>(!arr||arrText(x.arrondissement)===arr)&&votesOf(x)>0);
  list.sort((x,y)=>{
    if(mode==="popular")return votesOf(y)-votesOf(x)||scoreOf(y)-scoreOf(x);
    if(mode==="value")return valueScoreOf(y)-valueScoreOf(x)||scoreOf(y)-scoreOf(x);
    return scoreOf(y)-scoreOf(x)||votesOf(y)-votesOf(x);
  });
  const hero=document.getElementById("rankingHero");
  const root=document.getElementById("rankingList");
  if(!list.length){
    hero.innerHTML="";
    root.innerHTML='<div class="empty">Aucun vote pour le moment.</div>';
    return;
  }
  const top=list[0];
  const label=mode==="popular"?"Le plus populaire":mode==="value"?"Meilleur rapport qualité-prix":"Meilleur éclair";
  const metric=mode==="popular"?`${votesOf(top)} vote${votesOf(top)>1?"s":""}`:mode==="value"?`${scoreOf(top).toFixed(1)}/100 · ${price(top.price_eur)}`:`${scoreOf(top).toFixed(1)}/100`;
  hero.innerHTML=`<button class="card ranking-winner" data-id="${esc(top.eclair_id)}"><div class="eyebrow">${label.toUpperCase()}${arr?" · "+arr+(arr==="1"?"ER":"E")+" ARR.":" · PARIS"}</div><h2>🥇 ${esc(top.name)}</h2><div class="meta">${esc(top.address)}</div><div class="score">${metric}</div></button>`;
  root.innerHTML=list.slice(1).map((x,idx)=>`<div class="rank-row"><div class="rank-number">${idx+2}</div>${card(x,true)}</div>`).join("");
  bindCards(hero);bindCards(root);
}
function renderFavorites(){
  const root=document.getElementById("favoriteList");
  if(!currentUser){root.innerHTML='<div class="empty">Connecte-toi pour créer ta liste « À tester ».</div>';return;}
  const ids=new Set(favorites.map(f=>f.eclair_id)),list=bakeries.filter(x=>ids.has(x.eclair_id));
  root.innerHTML=list.length?list.map(x=>card(x,false)).join(""):'<div class="empty">Ta liste est vide. Ajoute un éclair depuis sa fiche.</div>';bindCards(root);
}
function renderAll(){renderMap();renderRanking();renderFavorites();updateAuthButton();renderAdmin()}

async function toggleFavorite(x){
  if(!currentUser)return openAuth();
  if(isFavorite(x.eclair_id)){
    await sb.from("favorites").delete().eq("user_id",currentUser.id).eq("eclair_id",x.eclair_id);
  }else{
    await sb.from("favorites").insert({user_id:currentUser.id,eclair_id:x.eclair_id,status:"to_try"});
  }
  await loadFavorites();renderAll();showDetail(x);
}
function showDetail(x){
  currentEclair=x;
  const verified=x.availability_status==="verified";
  const reported=x.availability_status==="reported";
  const unavailable=x.availability_status==="unavailable";
  const sc=scoreOf(x),vc=votesOf(x),fav=isFavorite(x.eclair_id),canRate=!!x.eclair_id;
  const statusEyebrow=verified?"ÉCLAIR VÉRIFIÉ":reported?"SIGNALÉ PAR LA COMMUNAUTÉ":unavailable?"INDISPONIBLE":"ÉTABLISSEMENT RECENSÉ";
  const statusClass=verified?"verified":reported?"reported":unavailable?"unavailable":"catalog";
  const hero=x.photo_url?`<div class="detail-hero"><img src="${esc(x.photo_url)}" alt="Éclair au chocolat chez ${esc(x.name)}" loading="lazy" onerror="this.parentElement.remove()"></div>`:"";
  const priceBlock=verified&&x.price_eur!=null?`<div class="detail-stat"><span>Prix</span><strong>${price(x.price_eur)}</strong></div>`:reported&&x.avg_reported_price!=null?`<div class="detail-stat"><span>Prix signalé</span><strong>${price(x.avg_reported_price)}</strong></div>`:"";
  const scoreBlock=vc?`<div class="detail-stat"><span>Note</span><strong>${sc.toFixed(1)}<small>/100</small></strong><em>${vc} vote${vc>1?"s":""}</em></div>`:`<div class="detail-stat"><span>Note</span><strong>—</strong><em>Pas encore noté</em></div>`;
  document.getElementById("detailContent").innerHTML=`
    <article class="detail-sheet">
      ${hero}
      <div class="detail-body">
        <div class="detail-status ${statusClass}">${statusEyebrow}</div>
        <h2>${esc(x.name)}</h2>
        <div class="detail-address">${esc(x.address)}</div>
        <div class="detail-stats">${scoreBlock}${priceBlock}</div>
        ${reported?`<div class="detail-trust"><strong>${x.report_count||1} signalement${Number(x.report_count||1)>1?"s":""}</strong><span>Information communautaire encore à vérifier.</span></div>`:""}
        ${unavailable?`<div class="detail-trust unavailable"><strong>Indisponible</strong><span>Cet éclair est actuellement signalé comme indisponible.</span></div>`:""}
        ${!verified&&!reported&&!unavailable?`<div class="detail-trust catalog"><strong>Adresse recensée</strong><span>La présence d’un éclair au chocolat n’est pas encore vérifiée.</span></div>`:""}
        ${x.description?`<p class="detail-description">${esc(x.description)}</p>`:""}
        <div class="detail-primary-actions">
          ${canRate?`<button id="rateBtn" class="primary detail-main-action">Noter cet éclair</button><button id="favBtn" class="secondary detail-fav-action">${fav?"★ Dans ma liste":"☆ À tester"}</button>`:`<button id="reportBtn" class="primary detail-main-action">Signaler un éclair</button>`}
        </div>
        <div class="detail-links">
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.latitude+","+x.longitude)}" target="_blank" rel="noopener">⌖ Itinéraire</a>
          ${x.website?`<a href="${esc(x.website)}" target="_blank" rel="noopener">Site</a>`:""}
          ${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">Source</a>`:""}
        </div>
      </div>
    </article>`;
  document.getElementById("detailDialog").showModal();
  if(canRate){
    document.getElementById("favBtn").onclick=()=>toggleFavorite(x);
    document.getElementById("rateBtn").onclick=()=>openVote(x);
  }else{
    document.getElementById("reportBtn").onclick=()=>openReport(x);
  }
}

function openReport(x){
  if(!currentUser){document.getElementById("detailDialog").close();return openAuth();}
  currentEclair=x;
  document.getElementById("reportTitle").textContent="Signaler · "+x.name;
  document.getElementById("reportPrice").value="";
  document.getElementById("reportSource").value="";
  document.getElementById("reportComment").value="";
  document.getElementById("reportMessage").textContent="";
  document.getElementById("detailDialog").close();
  document.getElementById("reportDialog").showModal();
}

async function saveReport(e){
  e.preventDefault();
  const msg=document.getElementById("reportMessage");
  if(!sb){msg.textContent="Service de signalement momentanément indisponible.";return;}
  if(!currentUser||!currentEclair?.catalog_id)return;
  const raw=document.getElementById("reportPrice").value;
  const payload={
    user_id:currentUser.id,
    catalog_id:currentEclair.catalog_id,
    establishment_name:currentEclair.name,
    address:currentEclair.address||null,
    latitude:currentEclair.latitude||null,
    longitude:currentEclair.longitude||null,
    reported_price:raw===""?null:Number(raw),
    source_url:document.getElementById("reportSource").value.trim()||null,
    comment:document.getElementById("reportComment").value.trim()||null
  };
  const {error}=await sb.from("eclair_reports").upsert(payload,{onConflict:"user_id,catalog_id"});
  if(error){msg.textContent="Erreur : "+error.message;return;}
  msg.textContent="Merci. Le signalement a été enregistré comme information à vérifier.";
  setTimeout(()=>document.getElementById("reportDialog").close(),900);
}

function openAuth(){setAuthMode("signin");document.getElementById("authMessage").textContent="";document.getElementById("authDialog").showModal()}
function updateAuthButton(){document.getElementById("authBtn").textContent=currentUser?currentUser.email.split("@")[0]:"Connexion"}

async function openVote(x){
  if(!currentUser){document.getElementById("detailDialog").close();return openAuth();}
  currentEclair=x;document.getElementById("voteTitle").textContent="Noter · "+x.name;
  document.getElementById("voteSliders").innerHTML=criteria.map(([k,label])=>`<div class="slider-row"><label>${label}<input class="vote-slider" data-key="${k}" type="range" min="0" max="100" value="70"></label><output data-out="${k}">70</output></div>`).join("");
  document.querySelectorAll(".vote-slider").forEach(el=>el.oninput=()=>{document.querySelector('[data-out="'+el.dataset.key+'"]').textContent=el.value;updateScorePreview()});
  updateScorePreview();document.getElementById("detailDialog").close();document.getElementById("voteDialog").showModal();
}
function voteValues(){
  const v={};document.querySelectorAll(".vote-slider").forEach(el=>v[el.dataset.key]=Number(el.value));return v;
}
function calculatedScore(v){return criteria.reduce((sum,[k,,w])=>sum+(v[k]||0)*w/100,0)}
function updateScorePreview(){document.getElementById("scorePreview").textContent=calculatedScore(voteValues()).toFixed(1)+"/100"}

async function saveVote(e){
  e.preventDefault();if(!currentUser||!currentEclair)return;
  const vals=voteValues(),verified=document.getElementById("verifiedTasting").checked;
  let coords={latitude:null,longitude:null};
  if(verified&&navigator.geolocation){
    try{const p=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:7000}));coords={latitude:p.coords.latitude,longitude:p.coords.longitude}}catch{}
  }
  const payload={user_id:currentUser.id,eclair_id:currentEclair.eclair_id,...vals,comment:document.getElementById("voteComment").value.trim()||null,verified_tasting:verified&&coords.latitude!=null,tasting_latitude:coords.latitude,tasting_longitude:coords.longitude};
  const {error}=await sb.from("votes").upsert(payload,{onConflict:"user_id,eclair_id"});
  const msg=document.getElementById("voteMessage");
  if(error){msg.textContent="Erreur : "+error.message;return;}
  msg.textContent="Vote enregistré.";setTimeout(()=>document.getElementById("voteDialog").close(),500);await loadData();
}

async function refreshAdmin(){
  if(!sb||!currentUser||!isAdmin){adminReports=[];renderAdmin();return;}
  const {data,error}=await sb.from("eclair_reports")
    .select("id,catalog_id,establishment_name,address,latitude,longitude,reported_price,source_url,comment,status,created_at,updated_at")
    .eq("status","pending")
    .order("created_at",{ascending:true});
  if(error){console.error(error);adminReports=[];}else adminReports=data||[];
  renderAdmin();
}

function renderAdmin(){
  const tab=document.getElementById("adminTab");
  const root=document.getElementById("adminReportList");
  const stats=document.getElementById("adminStats");
  if(!tab||!root||!stats)return;
  tab.hidden=!isAdmin;
  document.querySelector(".tabs")?.classList.toggle("has-admin",isAdmin);
  if(!isAdmin){root.innerHTML="";stats.innerHTML="";return;}
  stats.innerHTML=`<div class="admin-stat"><strong>${adminReports.length}</strong><span>signalement${adminReports.length>1?"s":""} en attente</span></div>`;
  if(!adminReports.length){root.innerHTML='<div class="empty">Aucun signalement à traiter.</div>';return;}
  root.innerHTML=adminReports.map(r=>`
    <article class="card admin-report" data-report-id="${esc(r.id)}">
      <div class="admin-report-head">
        <div><div class="eyebrow">À VÉRIFIER</div><h3>${esc(r.establishment_name)}</h3><div class="meta">${esc(r.address||"Adresse non renseignée")}</div></div>
        <div class="admin-date">${new Date(r.created_at).toLocaleDateString("fr-FR")}</div>
      </div>
      <div class="admin-fields">
        <label>Prix (€)<input class="admin-price" type="number" min="0" step="0.10" value="${r.reported_price??""}"></label>
        <label>Source<input class="admin-source" type="url" value="${esc(r.source_url||"")}" placeholder="https://…"></label>
      </div>
      ${r.comment?`<div class="admin-comment">${esc(r.comment)}</div>`:""}
      <div class="admin-actions">
        <button class="secondary admin-map">Voir sur la carte</button>
        <button class="secondary admin-reject">Refuser</button>
        <button class="primary admin-approve">Valider l’éclair</button>
      </div>
      <div class="meta admin-message"></div>
    </article>`).join("");
  root.querySelectorAll(".admin-report").forEach(cardEl=>{
    const id=cardEl.dataset.reportId;
    const report=adminReports.find(r=>r.id===id);
    cardEl.querySelector(".admin-map").onclick=()=>{
      document.querySelector('[data-view="map"]').click();
      if(report?.latitude!=null&&report?.longitude!=null)map.setView([report.latitude,report.longitude],16);
    };
    cardEl.querySelector(".admin-reject").onclick=()=>moderateReport(cardEl,id,"rejected");
    cardEl.querySelector(".admin-approve").onclick=()=>approveReport(cardEl,id);
  });
}

async function moderateReport(cardEl,id,status){
  const msg=cardEl.querySelector(".admin-message");
  msg.textContent="Enregistrement…";
  const {error}=await sb.from("eclair_reports").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){msg.textContent="Erreur : "+error.message;return;}
  await refreshAdmin();
  await loadData();
}

async function approveReport(cardEl,id){
  const msg=cardEl.querySelector(".admin-message");
  const raw=cardEl.querySelector(".admin-price").value;
  const source=cardEl.querySelector(".admin-source").value.trim();
  msg.textContent="Validation…";
  const {error:updateError}=await sb.from("eclair_reports").update({
    reported_price:raw===""?null:Number(raw),
    source_url:source||null,
    updated_at:new Date().toISOString()
  }).eq("id",id);
  if(updateError){msg.textContent="Erreur : "+updateError.message;return;}
  const {error}=await sb.rpc("approve_eclair_report",{p_report_id:id});
  if(error){msg.textContent="Erreur : "+error.message;return;}
  await refreshAdmin();
  await loadData();
}

async function checkAdmin(){
  if(!sb||!currentUser){isAdmin=false;adminReports=[];renderAdmin();return;}
  const {data,error}=await sb.from("admins").select("user_id").eq("user_id",currentUser.id).maybeSingle();
  isAdmin=!error&&!!data;
  if(isAdmin)await refreshAdmin();else{adminReports=[];renderAdmin();}
}
async function initAuth(){
  if(!sb){currentUser=null;updateAuthButton();renderFavorites();return;}
  const {data:{session}}=await sb.auth.getSession();currentUser=session?.user||null;updateAuthButton();await loadFavorites();await checkAdmin();renderFavorites();
  sb.auth.onAuthStateChange(async(_,session)=>{currentUser=session?.user||null;await loadFavorites();await checkAdmin();renderAll()});
}

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(t.dataset.view+"View").classList.add("active");if(t.dataset.view==="map")setTimeout(()=>map.invalidateSize(),50)});
["searchInput","arrFilter","statusFilter"].forEach(id=>document.getElementById(id).addEventListener("input",renderMap));
document.getElementById("rankingArr").addEventListener("input",renderRanking);
document.getElementById("rankingMode").addEventListener("input",renderRanking);
document.getElementById("closeDialog").onclick=()=>document.getElementById("detailDialog").close();
document.getElementById("closeAuth").onclick=()=>document.getElementById("authDialog").close();
document.getElementById("closeVote").onclick=()=>document.getElementById("voteDialog").close();
document.getElementById("closeReport").onclick=()=>document.getElementById("reportDialog").close();
document.getElementById("authBtn").onclick=async()=>{if(currentUser){if(confirm("Se déconnecter ?"))await sb.auth.signOut()}else openAuth()};
document.getElementById("locateBtn").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>{
  const parisBounds=L.latLngBounds([48.8156,2.2241],[48.9022,2.4699]);
  const pos=L.latLng(p.coords.latitude,p.coords.longitude);
  if(parisBounds.contains(pos)) map.setView(pos,15);
  else alert("Votre position est en dehors de Paris intramuros.");
});
document.getElementById("authForm").onsubmit=async e=>{e.preventDefault();const email=document.getElementById("authEmail").value,password=document.getElementById("authPassword").value;const {error}=await sb.auth.signInWithPassword({email,password});document.getElementById("authMessage").textContent=error?error.message:"Connecté.";if(!error)setTimeout(()=>document.getElementById("authDialog").close(),400)};
document.getElementById("signupBtn").onclick=async()=>{const email=document.getElementById("authEmail").value,password=document.getElementById("authPassword").value;if(!email||password.length<6){document.getElementById("authMessage").textContent="Saisis un email et un mot de passe d'au moins 6 caractères.";return}const {error}=await sb.auth.signUp({email,password});document.getElementById("authMessage").textContent=error?error.message:"Compte créé. Vérifie ton email si demandé."};
document.getElementById("voteForm").onsubmit=saveVote;
document.getElementById("reportForm").onsubmit=saveReport;
document.getElementById("refreshAdminBtn").onclick=refreshAdmin;

setupArrondissements();
if(window.L){
  initMap();
  loadData().catch(err=>{console.error(err);document.getElementById("rankingList").innerHTML='<div class="empty">Impossible de charger certaines données.</div>'});
  initAuth();
}else{
  document.getElementById("map").innerHTML='<div class="empty">La bibliothèque cartographique n’a pas pu être chargée. Recharge la page.</div>';
}
