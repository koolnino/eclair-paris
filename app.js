const SUPABASE_URL = "https://okqshfosuzirajqbezar.supabase.co";
const SUPABASE_KEY = "sb_publishable_yyxTSUP7k7KVz3gBvlSeWQ_FguXuKYh";
const sb = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let bakeries=[], catalog=[], rankings=[], favorites=[], currentUser=null, currentEclair=null, map, markers=[];
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
  const eclairPromise=sb?sb.from("eclairs").select("id,name,price_eur,description,photo_url,availability_status,source_url,verified_at,bakeries(id,name,address,postal_code,arrondissement,latitude,longitude,phone,website)").eq("active",true):Promise.resolve({data:[],error:null});
  const rankingPromise=sb?sb.from("eclair_rankings").select("*"):Promise.resolve({data:[]});
  const [{data:b,error:be},{data:r},catalogData] = await Promise.all([
    eclairPromise,
    rankingPromise,
    fetch("./data/paris_shops.json",{cache:"no-store"}).then(res=>res.ok?res.json():null).catch(()=>null)
  ]);
  if(be) console.warn("Supabase indisponible, affichage du catalogue public uniquement.",be);
  bakeries=(b||[]).map(x=>({...x,...x.bakeries,bakery_id:x.bakeries?.id,eclair_id:x.id}));
  catalog=(catalogData?.establishments||[]).map(x=>({...x,eclair_id:null,price_eur:null,description:null,verified_at:null}));
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
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"&copy; OpenStreetMap &copy; CARTO",subdomains:"abcd",maxZoom:20}).addTo(map);
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
function renderMap(){
  markers.forEach(m=>m.remove());markers=[];
  const list=filtered();
  for(const x of list){
    if(!Number.isFinite(Number(x.latitude))||!Number.isFinite(Number(x.longitude)))continue;
    const verified=x.availability_status==="verified", fav=isFavorite(x.eclair_id);
    const icon=L.divIcon({className:"",html:`<div style="width:18px;height:18px;border-radius:50%;background:${verified?"#2b1b17":"#a68d82"};border:3px solid ${fav?"#e5b642":"white"};box-shadow:0 2px 6px #0004"></div>`,iconSize:[18,18]});
    const m=L.marker([x.latitude,x.longitude],{icon}).addTo(map);
    m.bindPopup(`<strong>${esc(x.name)}</strong><br>${esc(x.address)}<br>${verified?"✓ Éclair vérifié":"À vérifier"}`);
    m.on("click",()=>showDetail(x));markers.push(m);
  }
  document.getElementById("mapCount").textContent=`${list.length} établissement${list.length>1?"s":""}`;
}
function card(x,withScore=false){
  const sc=scoreOf(x),vc=votesOf(x),verified=x.availability_status==="verified";
  return `<button class="card" data-id="${esc(x.eclair_id)}"><div class="row"><div><h3>${esc(x.name)}</h3><div class="meta">${esc(x.address)}</div></div>${withScore&&vc?`<div><div class="score">${sc.toFixed(1)}</div><div class="meta">${vc} vote${vc>1?"s":""}</div></div>`:""}</div><div class="row"><span class="badge ${verified?"":"unknown"}">${verified?"Éclair vérifié":"À vérifier"}</span><span class="price">${price(x.price_eur)}</span></div></button>`;
}
function bindCards(root){root.querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>{const x=bakeries.find(b=>b.eclair_id===el.dataset.id);if(x)showDetail(x)})}
function renderRanking(){
  const a=document.getElementById("rankingArr").value;
  const list=bakeries.filter(x=>(!a||arrText(x.arrondissement)===a)&&votesOf(x)>0).sort((x,y)=>scoreOf(y)-scoreOf(x));
  const root=document.getElementById("rankingList");root.innerHTML=list.length?list.map(x=>card(x,true)).join(""):'<div class="empty">Aucun vote pour le moment.</div>';bindCards(root);
}
function renderFavorites(){
  const root=document.getElementById("favoriteList");
  if(!currentUser){root.innerHTML='<div class="empty">Connecte-toi pour créer ta liste « À tester ».</div>';return;}
  const ids=new Set(favorites.map(f=>f.eclair_id)),list=bakeries.filter(x=>ids.has(x.eclair_id));
  root.innerHTML=list.length?list.map(x=>card(x,false)).join(""):'<div class="empty">Ta liste est vide. Ajoute un éclair depuis sa fiche.</div>';bindCards(root);
}
function renderAll(){renderMap();renderRanking();renderFavorites();updateAuthButton()}

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
  const sc=scoreOf(x),vc=votesOf(x),fav=isFavorite(x.eclair_id),canRate=!!x.eclair_id;
  document.getElementById("detailContent").innerHTML=`
    <div class="eyebrow">${verified?"ÉCLAIR VÉRIFIÉ":"ÉTABLISSEMENT RECENSÉ"}</div>
    <h2>${esc(x.name)}</h2>
    <p>${esc(x.address)}</p>
    ${verified?`<p><strong>${price(x.price_eur)}</strong></p>`:'<div class="source-note">Cette adresse est recensée. La présence d’un éclair au chocolat n’est pas encore vérifiée.</div>'}
    ${vc?`<p><span class="score">${sc.toFixed(1)}/100</span> · ${vc} vote${vc>1?"s":""}</p>`:canRate?"<p>Aucun vote pour le moment.</p>":""}
    ${x.description?`<p>${esc(x.description)}</p>`:""}
    <div class="actions">
      ${canRate?`<button id="favBtn" class="secondary">${fav?"★ Retirer de ma liste":"☆ À tester"}</button><button id="rateBtn" class="primary">Noter cet éclair</button>`:""}
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.latitude+","+x.longitude)}" target="_blank" rel="noopener">Itinéraire</a>
      ${x.website?`<a href="${esc(x.website)}" target="_blank" rel="noopener">Site</a>`:""}
      ${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">Source</a>`:""}
    </div>
    ${!canRate?'<div class="catalog-cta"><strong>Tu as vu un éclair au chocolat ici ?</strong><span class="meta">Tu peux le signaler sans qu’il soit considéré comme vérifié.</span><div class="actions"><button id="reportBtn" class="primary">Signaler un éclair</button></div></div>':""}
  `;
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

async function initAuth(){
  if(!sb){currentUser=null;updateAuthButton();renderFavorites();return;}
  const {data:{session}}=await sb.auth.getSession();currentUser=session?.user||null;updateAuthButton();await loadFavorites();renderFavorites();
  sb.auth.onAuthStateChange(async(_,session)=>{currentUser=session?.user||null;await loadFavorites();renderAll()});
}

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(t.dataset.view+"View").classList.add("active");if(t.dataset.view==="map")setTimeout(()=>map.invalidateSize(),50)});
["searchInput","arrFilter","statusFilter"].forEach(id=>document.getElementById(id).addEventListener("input",renderMap));
document.getElementById("rankingArr").addEventListener("input",renderRanking);
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

setupArrondissements();
if(window.L){
  initMap();
  loadData().catch(err=>{console.error(err);document.getElementById("rankingList").innerHTML='<div class="empty">Impossible de charger certaines données.</div>'});
  initAuth();
}else{
  document.getElementById("map").innerHTML='<div class="empty">La bibliothèque cartographique n’a pas pu être chargée. Recharge la page.</div>';
}
