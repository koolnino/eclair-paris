const SUPABASE_URL = "https://okqshfosuzirajqbezar.supabase.co";
const SUPABASE_KEY = "sb_publishable_yyxTSUP7k7KVz3gBvlSeWQ_FguXuKYh";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let bakeries = [];
let rankings = [];
let map, markers = [];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const arrText = v => v ? String(v).replace(/\D/g,"") : "";
const price = v => v == null ? "Prix à confirmer" : new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(v);

function setupArrondissements(){
  for(const id of ["arrFilter","rankingArr"]){
    const s=document.getElementById(id);
    for(let i=1;i<=20;i++){ const o=document.createElement("option"); o.value=String(i); o.textContent=i===1?"1er":`${i}e`; s.appendChild(o); }
  }
}

async function loadData(){
  const [{data:b,error:be},{data:r,error:re}] = await Promise.all([
    sb.from("eclairs").select("id,name,price_eur,description,photo_url,availability_status,source_url,verified_at,bakeries(id,name,address,postal_code,arrondissement,latitude,longitude,phone,website) ").eq("active",true),
    sb.from("eclair_rankings").select("*")
  ]);
  if(be) throw be;
  bakeries=(b||[]).map(x=>({...x,...x.bakeries,bakery_id:x.bakeries?.id,eclair_id:x.id}));
  rankings=r||[];
  renderAll();
}

function rankingFor(eclairId){ return rankings.find(r=>r.eclair_id===eclairId)||{}; }
function scoreOf(x){ const r=rankingFor(x.eclair_id); return Number(r.average_score ?? r.avg_score ?? 0); }
function votesOf(x){ const r=rankingFor(x.eclair_id); return Number(r.vote_count ?? r.votes_count ?? 0); }

function filtered(){
  const q=document.getElementById("searchInput").value.trim().toLowerCase();
  const a=document.getElementById("arrFilter").value;
  const s=document.getElementById("statusFilter").value;
  return bakeries.filter(x =>
    (!q || [x.name,x.address,x.postal_code].some(v=>String(v||"").toLowerCase().includes(q))) &&
    (!a || arrText(x.arrondissement)===a) &&
    (!s || x.availability_status===s)
  );
}

function initMap(){
  map=L.map("map",{zoomControl:false}).setView([48.8566,2.3522],12);
  L.control.zoom({position:"bottomright"}).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{
    attribution:'&copy; OpenStreetMap &copy; CARTO',
    subdomains:"abcd",
    maxZoom:20
  }).addTo(map);
}

function renderMap(){
  markers.forEach(m=>m.remove()); markers=[];
  const list=filtered();
  for(const x of list){
    if(!Number.isFinite(Number(x.latitude))||!Number.isFinite(Number(x.longitude))) continue;
    const verified=x.availability_status==="verified";
    const icon=L.divIcon({className:"",html:`<div style="width:18px;height:18px;border-radius:50%;background:${verified?"#2b1b17":"#a68d82"};border:3px solid white;box-shadow:0 2px 6px #0004"></div>`,iconSize:[18,18]});
    const m=L.marker([x.latitude,x.longitude],{icon}).addTo(map);
    m.bindPopup(`<strong>${esc(x.name)}</strong><br>${esc(x.address)}<br>${verified?"✓ Éclair vérifié":"À vérifier"}`);
    m.on("click",()=>showDetail(x));
    markers.push(m);
  }
  document.getElementById("mapCount").textContent=`${list.length} établissement${list.length>1?"s":""}`;
}

function card(x,withScore=false){
  const sc=scoreOf(x), vc=votesOf(x), verified=x.availability_status==="verified";
  return `<button class="card" data-id="${esc(x.eclair_id)}">
    <div class="row"><div><h3>${esc(x.name)}</h3><div class="meta">${esc(x.address)}</div></div>${withScore&&vc? `<div><div class="score">${sc.toFixed(1)}</div><div class="meta">${vc} vote${vc>1?"s":""}</div></div>`:""}</div>
    <div class="row"><span class="badge ${verified?"":"unknown"}">${verified?"Éclair vérifié":"À vérifier"}</span><span class="price">${price(x.price_eur)}</span></div>
  </button>`;
}
function bindCards(root){
  root.querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>{const x=bakeries.find(b=>b.eclair_id===el.dataset.id); if(x) showDetail(x);});
}
function renderRanking(){
  const a=document.getElementById("rankingArr").value;
  const list=bakeries.filter(x=>(!a||arrText(x.arrondissement)===a)&&votesOf(x)>0).sort((x,y)=>scoreOf(y)-scoreOf(x));
  const root=document.getElementById("rankingList");
  root.innerHTML=list.length?list.map(x=>card(x,true)).join(""):'<div class="empty">Aucun vote pour le moment. Le classement apparaîtra dès les premières dégustations.</div>';
  bindCards(root);
}
function renderVerified(){
  const list=bakeries.filter(x=>x.availability_status==="verified");
  const root=document.getElementById("verifiedList");
  root.innerHTML=list.length?list.map(x=>card(x,false)).join(""):'<div class="empty">Aucun éclair vérifié.</div>';
  bindCards(root);
}
function renderAll(){renderMap();renderRanking();renderVerified();}

function showDetail(x){
  const verified=x.availability_status==="verified";
  const sc=scoreOf(x), vc=votesOf(x);
  document.getElementById("detailContent").innerHTML=`
    <div class="eyebrow">${verified?"ÉCLAIR VÉRIFIÉ":"INFORMATION À VÉRIFIER"}</div>
    <h2>${esc(x.name)}</h2>
    <p>${esc(x.address)}</p>
    <p><strong>${price(x.price_eur)}</strong></p>
    ${vc?`<p><span class="score">${sc.toFixed(1)}/100</span> · ${vc} vote${vc>1?"s":""}</p>`:"<p>Aucun vote pour le moment.</p>"}
    ${x.description?`<p>${esc(x.description)}</p>`:""}
    <div class="actions">
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.latitude+","+x.longitude)}" target="_blank" rel="noopener">Itinéraire</a>
      ${x.website?`<a href="${esc(x.website)}" target="_blank" rel="noopener">Site</a>`:""}
      ${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">Source</a>`:""}
    </div>`;
  document.getElementById("detailDialog").showModal();
}

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(t.dataset.view+"View").classList.add("active");
  if(t.dataset.view==="map") setTimeout(()=>map.invalidateSize(),50);
});
["searchInput","arrFilter","statusFilter"].forEach(id=>document.getElementById(id).addEventListener("input",renderMap));
document.getElementById("rankingArr").addEventListener("input",renderRanking);
document.getElementById("closeDialog").onclick=()=>document.getElementById("detailDialog").close();
document.getElementById("locateBtn").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],15));

setupArrondissements();
initMap();
loadData().catch(err=>{
  console.error(err);
  document.getElementById("rankingList").innerHTML='<div class="empty">Impossible de charger les données.</div>';
});
