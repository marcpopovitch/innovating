'use strict';
const ICONS = {
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/>',
  'shield-check':'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8.5 11.5 2.5 2.5 4.5-5"/>',
  landmark:'<path d="m3 8 9-5 9 5H3Zm0 13h18M5 18V11m5 7v-7m4 7v-7m5 7v-7M3 18h18"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  book:'<path d="M12 5v16m0-16C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z"/>',
  scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 8h10M7 12h10M7 16h6"/>',
  radar:'<circle cx="12" cy="12" r="9"/><path d="m12 12 6-6M12 7a5 5 0 1 0 5 5"/><circle cx="12" cy="12" r="1"/>',
  chevrons:'<path d="m8 8 4-4 4 4m-8 8 4 4 4-4"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4m0 3h.01"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  scale:'<path d="M12 3v18m-6 0h12M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  'arrow-up':'<path d="m7 14 5-5 5 5M12 9v10"/>',
  file:'<path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8l-6-6Zm0 0v6h6M8 12h8M8 16h6"/>',
  warning:'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  gap:'<path d="M8 3H3v6m13-6h5v6M3 15v6h5m13-6v6h-5M9 12h6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  link:'<path d="m10 13 4-4m-7 6-2 2a3.5 3.5 0 0 0 5 5l5-5a3.5 3.5 0 0 0 0-5m2-3 2-2a3.5 3.5 0 0 0-5-5L9 6a3.5 3.5 0 0 0 0 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
Object.assign(ICONS, {
 sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
 sliders:'<path d="M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M5 12h3l2-4 3 8 2-4h4"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 3 13 3 18 0M12 11v5"/>',
 building:'<path d="M4 21V8l8-5 8 5v13M2 21h20M8 10h1m6 0h1m-8 4h1m6 0h1m-6 7v-4h4v4"/>'
});
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=globalThis.CiceroMock;
const $=selector=>document.querySelector(selector);
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const state={filters:M.defaults(),phase:'idle',step:0,lastQuery:'',results:[],sort:'severity',history:[],mode:'normal',completedMode:'normal',duration:0,treated:new Set(),runId:0,detailId:0,autoTyping:false,advanced:false,popover:null,activeIssue:null,followed:structuredClone(M.followedTexts||[]),currentFollowedId:null,trackingQuery:'',trackingFilter:'all'};
const severityNames={critical:'Critique',high:'Élevée',medium:'Modérée'};
const severityOrder={critical:0,high:1,medium:2};
const singular={conflict:'conflit',gap:'vide juridique',duplicate:'doublon',obsolete:'texte obsolète'};
const steps=[['Lecture du Journal officiel…','Recoupement du corpus national'],['Comparaison avec le droit européen…','Alignement des niveaux normatifs'],['Détection des contradictions…','Qualification des incohérences']];
const groupNames={domains:'Domaine juridique',norms:'Niveau de norme',period:'Période',types:'Type d’incohérence',territories:'Périmètre territorial',statuses:'Statut du texte',sources:'Sources'};
const mappings={domains:M.domains,norms:M.norms,types:Object.fromEntries(Object.entries(M.meta).map(([k,v])=>[k,v.label])),territories:M.territoryNames,statuses:M.statusNames,sources:M.sourceNames};
let toastTimer,placeholderStopped=false,placeholderTimer,returnFocus,animationFrame;
function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
function toast(message){$('#toast').innerHTML=icon('check')+`<span>${esc(message)}</span>`;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3600);}
function formatDate(value){return new Date(value+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});}
function ticker(el,target,duration=800){
  if(!el)return;
  if(reducedMotion()){el.textContent=target.toLocaleString('fr-FR');return;}
  const start=performance.now();
  function frame(now){if(!el.isConnected)return;const p=Math.min(1,(now-start)/duration);el.textContent=Math.round(target*(1-(1-p)**3)).toLocaleString('fr-FR');if(p<1)requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}
function updateLaunch(){const busy=state.phase==='loading'||state.autoTyping;$('#launch-button').disabled=busy||!$('#query').value.trim();$('#query').disabled=busy;document.querySelectorAll('[data-example]').forEach(el=>{el.disabled=busy;});}
function stopPlaceholder(){placeholderStopped=true;clearTimeout(placeholderTimer);$('#query').placeholder='Décrivez le texte ou la question juridique à examiner…';}
function startPlaceholder(){
  if(reducedMotion())return;
  const phrases=['Vérifier la conservation des dossiers médicaux dans un projet d’arrêté…','Comparer les règles de repos quotidien avec un nouveau décret…','Repérer une contradiction entre normes nationales et urbanisme local…'];
  let phrase=0,char=0,deleting=false;
  function tick(){
    if(placeholderStopped||$('#query').value||state.phase!=='idle')return;
    const text=phrases[phrase];$('#query').placeholder=text.slice(0,char);
    if(!deleting){char++;if(char>text.length){deleting=true;placeholderTimer=setTimeout(tick,2100);return;}}
    else{char-=2;if(char<=0){char=0;deleting=false;phrase=(phrase+1)%phrases.length;}}
    placeholderTimer=setTimeout(tick,deleting?14:32);
  }
  placeholderTimer=setTimeout(tick,900);
}
function countFilters(){return Object.entries(state.filters).reduce((sum,[key,value])=>sum+(['customFrom','customTo'].includes(key)?0:Array.isArray(value)?value.length:value&&value!=='all'?1:0),0);}
function groupCount(group){const value=state.filters[group];return Array.isArray(value)?value.length:value!=='all'?1:0;}
function renderFilterBar(){
  $('#filter-bar').innerHTML=[['domains','Domaine','landmark'],['norms','Niveau de norme','scale'],['period','Période','clock']].map(([group,label,symbol])=>{
    const count=groupCount(group);const periodLabel=group==='period'&&count?(state.filters.period==='custom'?'Personnalisé':`${state.filters.period} ans`):label;
    return `<button type="button" class="filter-trigger ${count?'selected':''}" data-popover="${group}" aria-expanded="${state.popover===group}" aria-controls="filter-popover">${icon(symbol)}${periodLabel}${count&&group!=='period'?`<span class="filter-count">(${count})</span>`:''}${icon('arrow').replace('class="icon"','class="icon chevron"')}</button>`;
  }).join('')+`<button type="button" class="filter-trigger more-trigger" id="more-options" aria-expanded="${state.advanced}" aria-controls="advanced-shell">${icon('sliders')}Plus d’options${countFilters()>0?`<span class="filter-count">${countFilters()}</span>`:''}</button>`;
}
function filterChips(group){return `<div class="chips">${Object.entries(mappings[group]).map(([value,label])=>`<button type="button" class="chip ${group==='types'?value:''}" data-group="${group}" data-value="${value}" aria-pressed="${state.filters[group].includes(value)}">${group==='types'?icon(M.meta[value].icon):''}${esc(label)}${state.filters[group].includes(value)?icon('check'):''}</button>`).join('')}</div>`;}
function renderAdvanced(){
  $('#advanced-shell').classList.toggle('open',state.advanced);
  $('#advanced-options').inert=!state.advanced;
  $('#advanced-options').innerHTML=`<div class="advanced-body"><div class="advanced-head"><h3>Un périmètre précis. Une analyse plus juste.</h3><button type="button" class="text-button" id="reset-filters">Réinitialiser</button></div><div class="advanced-grid">${['types','territories','statuses','sources'].map((group,i)=>`<section class="advanced-group" style="--delay:${i*40}ms"><h4>${groupNames[group]}</h4>${filterChips(group)}</section>`).join('')}</div><div class="keyword-fields"><div><label for="include-keywords">Mots-clés à inclure</label><input class="input" id="include-keywords" data-option="include" value="${esc(state.filters.include)}" placeholder="conservation, dossier"></div><div><label for="exclude-keywords">Mots-clés à exclure</label><input class="input" id="exclude-keywords" data-option="exclude" value="${esc(state.filters.exclude)}" placeholder="incident, publicité"></div></div><p class="keyword-note">Termes séparés par des virgules · filtres cumulés entre catégories.</p></div>`;
}
function renderFilters(){renderFilterBar();renderAdvanced();}
function popoverOptions(group,search=''){
  const labels=group==='period'?{'1':'Dernière année','5':'5 dernières années','10':'10 dernières années',custom:'Personnalisé',all:'Toutes périodes'}:mappings[group];
  const entries=Object.entries(labels).filter(([,label])=>M.normalize(label).includes(M.normalize(search)));
  const result=entries.map(([value,label],i)=>{
    const selected=Array.isArray(state.filters[group])?state.filters[group].includes(value):state.filters[group]===value;
    return `<button type="button" class="popover-option" ${group==='norms'?`style="--step-width:${52+i*8}%"`:''} data-group="${group}" data-value="${value}" aria-pressed="${selected}"><span>${esc(label)}</span>${selected?icon('check'):''}</button>`;
  }).join('');
  return `<div class="${group==='norms'?'pyramid-options':''}">${result||'<p class="popover-note">Aucun critère trouvé.</p>'}</div>`+(group==='norms'?'<p class="popover-note">Représentation simplifiée des niveaux comparés ; les rapports entre ordres juridiques dépendent du contexte.</p>':'')+(group==='period'&&state.filters.period==='custom'?`<div class="custom-dates"><label>Du<input type="date" data-option="customFrom" value="${esc(state.filters.customFrom)}" aria-label="Date de début"></label><label>Au<input type="date" data-option="customTo" value="${esc(state.filters.customTo)}" aria-label="Date de fin"></label></div>`:'');
}
function openPopover(group,anchor){
  const pop=$('#filter-popover');
  if(innerWidth<=760){openMobileOptions(group);return;}
  if(pop.matches(':popover-open')&&state.popover===group){pop.hidePopover();return;}
  state.popover=group;
  pop.innerHTML=`<div class="popover-top"><strong>${groupNames[group]}</strong><span>${group==='period'?'Sélection unique':'Choix multiples'}</span></div><label class="popover-search">${icon('search')}<input id="popover-search" placeholder="Rechercher…" aria-label="Rechercher un critère"></label><div id="popover-options">${popoverOptions(group)}</div>`;
  const box=anchor.getBoundingClientRect();
  pop.style.left=`${Math.max(12,Math.min(box.left,innerWidth-312))}px`;
  pop.style.maxHeight=`${Math.min(420,innerHeight-32)}px`;
  pop.style.top=`${Math.max(12,Math.min(box.bottom+10,innerHeight-Math.min(420,innerHeight-32)-16))}px`;
  if(!pop.matches(':popover-open'))pop.showPopover();
  renderFilterBar();$('#popover-search').focus();
}
function appliedCriteria(){
  const entries=[];
  Object.entries(mappings).forEach(([group,labels])=>state.filters[group].forEach(value=>entries.push({group,value,label:labels[value]})));
  if(state.filters.period!=='all')entries.push({group:'period',value:state.filters.period,label:state.filters.period==='custom'?`${state.filters.customFrom||'Début'} → ${state.filters.customTo||'Aujourd’hui'}`:`${state.filters.period} an${state.filters.period==='1'?'':'s'}`});
  for(const group of ['include','exclude'])if(state.filters[group].trim())entries.push({group,value:state.filters[group],label:`${group==='include'?'Inclure':'Exclure'} : ${state.filters[group]}`});
  return entries.length?`<div class="criteria-bar"><span>Critères appliqués</span>${entries.map(item=>`<button class="criterion" data-remove-group="${item.group}" data-remove-value="${esc(item.value)}" aria-label="Retirer ${esc(item.label)}">${esc(item.label)}${icon('x')}</button>`).join('')}</div>`:'';
}
function tag(type,label){return `<span class="badge ${type}">${icon(M.meta[type].icon)}${label||M.meta[type].label}</span>`;}
function excerpt(t){return `${esc(t.before)}<mark>${esc(t.highlight)}</mark>${esc(t.after)}`;}
function emptyState(title,description,button='',symbol='scan'){return `<div class="empty-state">${icon(symbol)}<h3>${title}</h3><p>${description}</p>${button}</div>`;}
function sortedResults(){return [...state.results].sort(state.sort==='date'?(a,b)=>b.date.localeCompare(a.date):(a,b)=>severityOrder[a.severity]-severityOrder[b.severity]);}
function reference(t,role=''){return `<span class="reference-pill">${role?`<small class="reference-role">${esc(role)}</small>`:''}${esc(t.reference)}<small>${M.norms[t.norm]} · ${formatDate(t.date)}</small></span>`;}
function resultCard(item,index){
  const treated=state.treated.has(item.id);
  return `<article class="result-card ${item.type} ${treated?'treated':''}" data-result-id="${item.id}" style="--delay:${index*70}ms"><div class="result-top"><div class="result-identity"><span class="type-icon">${icon(M.meta[item.type].icon)}</span>${tag(item.type)}</div><span class="severity ${item.severity}"><span class="severity-bars" aria-hidden="true"><i></i><i></i><i></i></span>${severityNames[item.severity]}</span></div><h3>${esc(item.title)}</h3><div class="text-references">${item.texts.map((t,index)=>reference(t,index===0?'Texte examiné':({conflict:'En conflit avec',gap:'À compléter au regard de',duplicate:'Fait doublon avec',obsolete:'Renvoie à un texte remplacé'})[item.type])).join('')}</div><blockquote class="card-excerpt">« ${excerpt(item.texts[0])} »</blockquote><p class="related-explanation">${esc(item.explanation)}</p><div class="result-bottom"><span class="${treated?'treated-label':''}">${icon(treated?'check':'link')}${treated?'Traité dans cette session':'Deux textes comparés · références fictives'}</span><button class="detail-button" data-detail="${item.id}">Voir le détail ${icon('arrow')}</button></div></article>`;
}
function animateLayout(before){
  if(reducedMotion())return;
  document.querySelectorAll('[data-result-id]').forEach(el=>{
    const old=before.get(el.dataset.resultId);if(!old)return;
    const box=el.getBoundingClientRect(),dy=old.top-box.top;
    if(Math.abs(dy)>1)el.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});
  });
}
function renderResults(animateCount=false){
  const before=new Map([...document.querySelectorAll('[data-result-id]')].map(el=>[el.dataset.resultId,el.getBoundingClientRect()]));
  renderDiagnosticContext();document.title=diagnosticProject().title+' — Cicero';history.replaceState(null,'',state.currentFollowedId?'#diagnostic/'+encodeURIComponent(state.currentFollowedId):'#diagnostic');
  $('#result-query').textContent=state.lastQuery;$('#analysis-duration').textContent=`${(state.duration/1000).toFixed(1).replace('.',',')} s · simulation`;
  const container=$('#results-content');
  if(state.phase==='error'){container.innerHTML=emptyState('L’analyse a échoué.','Une interruption a été simulée pour la démonstration. Réessayez : votre demande et vos critères sont conservés.',`<button class="primary-button" id="retry-analysis">${icon('refresh')}Réessayer</button>`,'warning');return;}
  if(!state.results.length){container.innerHTML=`<h2 id="results-title" class="sr-only">Résultat de l’analyse</h2>${appliedCriteria()}${emptyState('Aucune contradiction trouvée avec ces critères.','Aucun scénario fictif ne correspond aux critères sélectionnés. Cela ne constitue pas une validation juridique.',`<button class="secondary-button" id="widen-filters">${icon('sliders')}Élargir les filtres</button>`,'shield-check')}`;return;}
  const counts=Object.entries(M.meta).map(([type,meta])=>{const count=state.results.filter(i=>i.type===type).length;return {type,count,label:count===1?singular[type]:meta.plural};}).filter(x=>x.count);
  container.innerHTML=`<div class="results-summary"><div class="results-heading"><span>Le diagnostic est prêt</span><h2 id="results-title"><strong id="result-total">${state.results.length}</strong> incohérence${state.results.length>1?'s':''} détectée${state.results.length>1?'s':''}</h2><p>Les dispositions à examiner, avant publication.</p><div class="summary-badges">${counts.map((c,i)=>`<span style="--badge-index:${i}">${tag(c.type,`${c.count} ${c.label}`)}</span>`).join('')}</div></div><div class="summary-symbol">${icon('shield-check')}</div></div>${appliedCriteria()}<div class="results-toolbar"><span>Détections à examiner · corpus de démonstration</span><label class="sr-only" for="sort-results">Trier les résultats</label><select id="sort-results"><option value="severity" ${state.sort==='severity'?'selected':''}>Gravité décroissante</option><option value="date" ${state.sort==='date'?'selected':''}>Les plus récentes</option></select></div><div class="results-list">${sortedResults().map(resultCard).join('')}</div>`;
  if(animateCount)ticker($('#result-total'),state.results.length);
  else animateLayout(before);
}
function applyFilters(){
  renderFilterBar();
  if(state.phase==='complete'){state.results=state.completedMode==='empty'?[]:currentFindings();renderResults();}
}
function showHome(){
  state.runId++;cancelAnimationFrame(animationFrame);state.phase='idle';state.autoTyping=false;
  $('#tracking-screen').hidden=true;state.currentFollowedId=null;updateNavigation('analysis');document.title='Cicero — La clarté du droit';history.replaceState(null,'','#analyse');
  $('#home-screen').hidden=false;$('#home-screen').classList.remove('leaving');$('#analysis-screen').hidden=true;$('#results-screen').hidden=true;
  updateLaunch();renderFilters();window.scrollTo({top:0,behavior:'instant'});
}
async function setExample(id){
  if(state.autoTyping||state.phase==='loading')return;
  const example=M.examples.find(e=>e.id===id);if(!example)return;
  stopPlaceholder();state.autoTyping=true;const runId=++state.runId;
  state.currentFollowedId=null;state.filters=M.defaults();$('#query').value='';$('#query-error').hidden=true;updateLaunch();renderFilters();
  if(reducedMotion())$('#query').value=example.text;
  else for(let i=0;i<example.text.length;i+=9){if(runId!==state.runId)return;$('#query').value=example.text.slice(0,i+9);await wait(20);}
  for(const [key,value]of Object.entries(example.filters)){if(runId!==state.runId)return;state.filters[key]=structuredClone(value);renderFilterBar();if(!reducedMotion())await wait(120);}
  state.autoTyping=false;state.mode='normal';$('#demo-state').value='normal';updateLaunch();runAnalysis();
}
function renderAnalysisScene(){
  const match=M.filterIssues(state.lastQuery,state.filters)[0];
  const norms=match?match.texts.map(t=>M.norms[t.norm]):['Projet de texte','Corpus juridique'];
  $('#analysis-scene').innerHTML=`<div class="analysis-title"><span class="eyebrow">Analyse de cohérence</span><h2>Un texte ne se lit jamais seul.</h2><p>Votre projet est confronté aux dispositions du corpus.</p></div><div class="analysis-comparison"><article class="analysis-document"><span class="document-kicker">Votre projet</span><h3>${esc(norms[0])}</h3><div class="document-lines"><i></i><i></i><i></i></div></article><div class="analysis-connector"><span class="detection-signal"></span><span class="analysis-caption">Contradiction repérée</span></div><article class="analysis-document"><span class="document-kicker">Corpus juridique</span><h3>${esc(norms[1])}</h3><div class="document-lines"><i></i><i></i><i></i></div></article></div><div class="analysis-status-grid"><div class="agent-steps" id="agent-steps"></div><div class="network-counter"><strong id="texts-counter">0</strong><p>textes analysés<br>simulation</p></div></div><div class="progress-footer"><div class="progress-track" role="progressbar" aria-label="Avancement de l’analyse" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-fill" id="progress-fill"></div></div><div class="progress-meta"><span>Comparaison du corpus juridique</span><span id="progress-percent">0 %</span></div><button class="skip-animation" id="skip-animation">Passer l’animation</button></div><div class="skeleton-row" aria-hidden="true"><div class="skeleton"><i></i><i></i><i></i></div><div class="skeleton"><i></i><i></i><i></i></div></div>`;
  updateSteps(0);
}
function updateSteps(step){
  state.step=step;
  $('#agent-steps').innerHTML=steps.map(([label,subtitle],index)=>`<div class="agent-step ${index<step?'done':index===step?'active':''}"><span class="step-node">${index<step?icon('check'):index===step?'<i class="step-spinner"></i>':index+1}</span><div><span class="step-label">${label}</span><small>${index<step?'Comparaison terminée':index===step?subtitle:'En attente'}</small></div></div>`).join('');
  $('.analysis-comparison').classList.toggle('contradiction-found',step>=2&&state.completedMode==='normal'&&currentFindings().length>0);
}
async function finishAnalysis(runId){
  if(state.phase!=='loading'||runId!==state.runId)return;
  state.phase='finishing';cancelAnimationFrame(animationFrame);updateSteps(3);
  $('#texts-counter').textContent='1 248';$('#progress-fill').style.transform='scaleX(1)';$('#progress-percent').textContent='100 %';$('.progress-track').setAttribute('aria-valuenow','100');
  state.duration=performance.now()-state.startedAt;
  if(!reducedMotion()){$('#analysis-screen').classList.add('finished');await wait(180);}
  if(runId!==state.runId)return;
  state.phase=state.completedMode==='error'?'error':'complete';
  state.results=state.completedMode==='empty'?[]:currentFindings();
  if(state.phase==='complete'){syncTrackedAnalysis();state.history.unshift({query:state.lastQuery,filters:structuredClone(state.filters),count:state.results.length,time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})});state.history=state.history.slice(0,8);$('#history-count').textContent=state.history.length;}
  $('#tracking-screen').hidden=true;updateNavigation('analysis');$('#analysis-screen').hidden=true;$('#results-screen').hidden=false;renderResults(true);updateLaunch();window.scrollTo({top:0,behavior:'instant'});
}
async function runAnalysis(){
  if(state.phase==='loading'||state.phase==='finishing'||state.autoTyping)return;
  const query=$('#query').value.trim();
  if(query.length<10){$('#query-error').textContent='Précisez votre demande en au moins 10 caractères.';$('#query-error').hidden=false;$('#query').focus();return;}
  const included=M.normalize(state.filters.include).split(',').map(x=>x.trim()).filter(Boolean),excluded=M.normalize(state.filters.exclude).split(',').map(x=>x.trim()).filter(Boolean);
  if(included.some(x=>excluded.includes(x))){$('#query-error').textContent='Un mot-clé ne peut pas être inclus et exclu à la fois.';$('#query-error').hidden=false;return;}
  if(state.filters.period==='custom'&&(!state.filters.customFrom&&!state.filters.customTo||state.filters.customFrom&&state.filters.customTo&&state.filters.customFrom>state.filters.customTo)){$('#query-error').textContent='Renseignez une période personnalisée valide.';$('#query-error').hidden=false;return;}
  if($('#filter-popover').matches(':popover-open'))$('#filter-popover').hidePopover();
  stopPlaceholder();const runId=++state.runId;state.phase='loading';state.lastQuery=query;state.completedMode=state.mode;updateLaunch();$('#query-error').hidden=true;
  if(!reducedMotion()){$('#home-screen').classList.add('leaving');await wait(200);}
  if(runId!==state.runId)return;
  $('#home-screen').hidden=true;$('#results-screen').hidden=true;$('#analysis-screen').hidden=false;$('#analysis-screen').classList.remove('finished');$('#running-query').textContent=query;
  renderAnalysisScene();window.scrollTo({top:0,behavior:'instant'});state.startedAt=performance.now();
  function frame(now){
    if(runId!==state.runId||state.phase!=='loading')return;
    const elapsed=now-state.startedAt,p=Math.min(1,elapsed/3200),step=elapsed<1100?0:elapsed<2200?1:2;
    if(step!==state.step)updateSteps(step);
    $('#texts-counter').textContent=Math.round(1248*(1-(1-p)**1.8)).toLocaleString('fr-FR');$('#progress-fill').style.transform=`scaleX(${p})`;$('#progress-percent').textContent=`${Math.round(p*100)} %`;$('.progress-track').setAttribute('aria-valuenow',String(Math.round(p*100)));
    if(p>=1)finishAnalysis(runId);else animationFrame=requestAnimationFrame(frame);
  }
  animationFrame=requestAnimationFrame(frame);
}
function openDrawer(content){returnFocus=document.activeElement;state.detailId++;$('#detail-content').innerHTML=content;$('#detail-drawer').showModal();}
function drawerHeader(title,meta=''){return `<header class="drawer-header"><div><span class="eyebrow">Cicero · Diagnostic de cohérence</span><h2 id="detail-title">${esc(title)}</h2>${meta}</div><button class="icon-button" data-close-dialog aria-label="Fermer le panneau">${icon('x')}</button></header>`;}
async function streamExplanation(item,detailId){
  const el=$('#ai-stream');if(!el)return;
  if(!reducedMotion()){
    await wait(1100);if(detailId!==state.detailId||!el.isConnected)return;
    el.classList.add('streaming');
    for(let i=0;i<item.explanation.length;i++){if(detailId!==state.detailId||!el.isConnected)return;el.textContent=item.explanation.slice(0,i+1);await wait(10);}
    el.classList.remove('streaming');
  }else el.textContent=item.explanation;
  if(detailId!==state.detailId)return;
  $('#correction-section')?.classList.remove('reveal-pending');
}
function showDetail(id){
  const item=M.issues.find(i=>i.id===id);if(!item)return;state.activeIssue=id;
  const treated=state.treated.has(id);
  openDrawer(`${drawerHeader(item.title,`<div class="drawer-meta">${tag(item.type)}<span>${item.id} · Gravité ${severityNames[item.severity].toLowerCase()}</span></div>`)}<div class="drawer-content ${item.type}"><p class="fiction-note">${icon('info')}Démonstration : références et extraits fictifs. Ils illustrent la méthode d’analyse.</p><div class="comparison-title"><h3>Deux textes. Un point de friction.</h3><span>Passages à examiner</span></div><div class="comparison-wrap"><div class="comparison">${item.texts.map((t,index)=>`<article class="law-text"><header><span class="tag">${esc(t.role||(index===0?'Texte de référence':'Texte à examiner'))} · ${M.norms[t.norm]}</span><h4>${esc(t.title)}</h4><span class="reference-pill">${esc(t.reference)}</span><p>${formatDate(t.date)}</p></header><blockquote class="law-excerpt">« ${excerpt(t)} »</blockquote><footer>${icon('book')}${M.sourceNames[t.source]} · Extrait fictif</footer></article>`).join('')}</div><span class="versus">contre</span><svg class="contradiction-link" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><path/></svg></div><section class="ai-explanation"><h3>${icon('sparkles')}Analyse <span class="tag">Simulation</span></h3><p id="ai-stream" aria-label="${esc(item.explanation)}"></p></section><section class="ai-explanation correction ${reducedMotion()?'':'reveal-pending'}" id="correction-section"><h3>${icon('shield-check')}Suggestion de correction</h3><div class="mini-diff"><div class="diff-line diff-old"><span>−</span><del>${esc(item.removed||item.texts[1].highlight)}</del></div><div class="diff-line diff-new"><span>+</span><span>${esc(item.correction)}</span></div></div><p>${esc(item.suggestion)}</p></section><div class="detail-actions"><button class="text-button" data-export="${id}">${icon('download')}Exporter</button><button class="secondary-button" data-copy="${id}">${icon('copy')}Copier la correction</button><button class="secondary-button treated-button ${treated?'is-treated':''}" data-treat="${id}" aria-pressed="${treated}">${icon('check')}${treated?'Marqué comme traité':'Marquer comme traité'}</button></div><p class="detail-disclaimer">Suggestion fictive à faire valider par un juriste. Le traitement est conservé uniquement pour cette session.</p></div>`);
  streamExplanation(item,state.detailId);
  connectHighlights(state.detailId);
}
function showHistory(){
  openDrawer(`${drawerHeader('Vos analyses de session')}<div class="drawer-content"><p class="fiction-note">${icon('clock')}Historique de démonstration. Une actualisation réinitialise la session.</p>${state.history.length?state.history.map((entry,index)=>`<article class="history-entry"><span class="tag">${entry.count} détection${entry.count>1?'s':''}</span><h3>${esc(entry.query)}</h3><footer><span>${entry.time}</span><button class="text-button" data-restore="${index}">Reprendre le cadrage ${icon('arrow')}</button></footer></article>`).join(''):emptyState('La première analyse vous attend.','Choisissez un exemple pour lancer les agents.','','clock')}</div>`);
}
function exportIssue(id){
  const item=M.issues.find(i=>i.id===id);if(!item)return;
  const content=`# Cicero — ${item.title}\n\nDÉMONSTRATION — Textes et références fictifs.\n\n${item.id} · ${M.meta[item.type].label}\n\n${item.texts.map(t=>`## ${t.title}\n${t.reference} · ${formatDate(t.date)}\n\n${t.before}${t.highlight}${t.after}`).join('\n\n')}\n\n## Analyse\n${item.explanation}\n\n## Correction proposée\n${item.correction}\n\n${item.suggestion}\n\nValidation juridique requise.\n`;
  const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`Cicero-${id}-DEMO.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Diagnostic téléchargé.');
}
async function copyCorrection(id){
  const item=M.issues.find(i=>i.id===id);if(!item)return;
  try{await navigator.clipboard.writeText(item.correction);toast('Correction copiée.');}
  catch{toast('Copie indisponible : utilisez l’export du diagnostic.');}
}
function treatIssue(id){
  if(state.treated.has(id))state.treated.delete(id);else state.treated.add(id);
  const treated=state.treated.has(id),button=document.querySelector(`[data-treat="${id}"]`);
  button.classList.toggle('is-treated',treated);button.setAttribute('aria-pressed',String(treated));button.innerHTML=icon('check')+(treated?'Marqué comme traité':'Marquer comme traité');
  const card=document.querySelector(`[data-result-id="${id}"]`);
  if(card){card.classList.toggle('treated',treated);const label=card.querySelector('.result-bottom>span');label.classList.toggle('treated-label',treated);label.innerHTML=icon(treated?'check':'link')+(treated?'Traité dans cette session':'Deux textes comparés · références fictives');}
  updateNavigation();
  toast(treated?'Incohérence marquée comme traitée.':'Incohérence rouverte.');
}
async function removeCriterion(button){
  button.classList.add('removing');if(!reducedMotion())await wait(140);
  const group=button.dataset.removeGroup,value=button.dataset.removeValue;
  state.filters[group]=Array.isArray(state.filters[group])?state.filters[group].filter(x=>x!==value):['include','exclude'].includes(group)?'':'all';
  if(group==='period'){state.filters.customFrom='';state.filters.customTo='';}
  applyFilters();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.popover)openPopover(button.dataset.popover,button);
  if(button.id==='more-options'){if(innerWidth<=760)openMobileOptions();else{state.advanced=!state.advanced;renderFilters();}}
  if(button.dataset.group){
    const {group,value}=button.dataset,current=state.filters[group];
    state.filters[group]=Array.isArray(current)?current.includes(value)?current.filter(x=>x!==value):[...current,value]:value;
    applyFilters();
    if($('#options-drawer').open){renderMobileOptions();document.querySelector(`#mobile-options-content [data-group="${group}"][data-value="${CSS.escape(value)}"]`)?.focus({preventScroll:true});}
    else if($('#filter-popover').matches(':popover-open')){
      const search=$('#popover-search').value;$('#popover-options').innerHTML=popoverOptions(group,search);
      document.querySelector(`#popover-options [data-value="${CSS.escape(value)}"]`)?.focus({preventScroll:true});
    }else{renderAdvanced();document.querySelector(`#advanced-options [data-group="${group}"][data-value="${CSS.escape(value)}"]`)?.focus({preventScroll:true});}
  }
  if(button.dataset.example)setExample(button.dataset.example);
  if(button.dataset.detail)showDetail(button.dataset.detail);
  if(button.dataset.copy)copyCorrection(button.dataset.copy);
  if(button.dataset.treat)treatIssue(button.dataset.treat);
  if(button.dataset.export)exportIssue(button.dataset.export);
  if(button.dataset.removeGroup)removeCriterion(button);
  if(button.id==='skip-animation')finishAnalysis(state.runId);
  if(button.id==='new-analysis'||button.id==='edit-filters'){const tracked=state.currentFollowedId;showHome();if(button.id==='edit-filters'){state.currentFollowedId=tracked;state.advanced=true;renderFilters();}$('#query').focus();}
  if(button.id==='reset-filters'||button.id==='widen-filters'){state.filters=M.defaults();state.completedMode='normal';renderFilters();applyFilters();}
  if(button.id==='retry-analysis'){state.mode='normal';$('#demo-state').value='normal';runAnalysis();}
  if(button.id==='history-button')showHistory();
  if(button.id==='apply-mobile-options')$('#options-drawer').close();
  if(button.id==='replay-logo'){const logo=$('#brand-home');logo.classList.remove('play');void logo.offsetWidth;logo.classList.add('play');$('#help-dialog').close();}
  if(button.id==='help-button')$('#help-dialog').showModal();
  if(button.hasAttribute('data-close-dialog'))button.closest('dialog').close();
  if(button.dataset.restore!==undefined){const entry=state.history[Number(button.dataset.restore)];$('#detail-drawer').close();showHome();state.filters=structuredClone(entry.filters);$('#query').value=entry.query;renderFilters();updateLaunch();$('#query').focus();}
});
document.addEventListener('input',event=>{
  const field=event.target;
  if(field.id==='query'){stopPlaceholder();$('#query-error').hidden=true;updateLaunch();}
  if(field.id==='popover-search')$('#popover-options').innerHTML=popoverOptions(state.popover,field.value);
  if(field.dataset.option){state.filters[field.dataset.option]=field.value;applyFilters();$('#mobile-options-count').textContent=countFilters();}
});
document.addEventListener('change',event=>{
  if(event.target.id==='sort-results'){state.sort=event.target.value;renderResults();}
  if(event.target.id==='demo-state')state.mode=event.target.value;
});
$('#brand-home').addEventListener('click',event=>{event.preventDefault();showHome();});
$('#analysis-form').addEventListener('submit',event=>{event.preventDefault();runAnalysis();});
$('#query').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();runAnalysis();}});
$('#filter-popover').addEventListener('toggle',event=>{
  if(event.newState==='closed'){
    const group=state.popover;
    const restoreFocus=$('#filter-popover').contains(document.activeElement)||document.activeElement===document.body;
    state.popover=null;renderFilterBar();
    if(restoreFocus&&!$('#home-screen').hidden)document.querySelector(`[data-popover="${group}"]`)?.focus({preventScroll:true});
  }
});
$('#filter-popover').addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const buttons=[...$('#popover-options').querySelectorAll('button')];if(!buttons.length)return;
  const index=buttons.indexOf(document.activeElement);
  let next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;
  if(index<0&&event.key==='ArrowUp')next=buttons.length-1;
  event.preventDefault();buttons[next].focus();
});
$('#detail-drawer').addEventListener('close',()=>{state.detailId++;if(returnFocus?.isConnected)returnFocus.focus();});
window.addEventListener('resize',()=>{if($('#filter-popover').matches(':popover-open'))$('#filter-popover').hidePopover();});
$('#examples').innerHTML=M.examples.map(e=>`<button type="button" class="example-card" data-example="${e.id}"><span class="example-top">${icon(e.icon)}${e.title}</span><p>${e.subtitle}</p>${icon('arrow')}</button>`).join('');
hydrate();renderFilters();updateLaunch();startPlaceholder();

async function connectHighlights(detailId){
  await wait(reducedMotion()?0:400);
  if(detailId!==state.detailId||!$('#detail-drawer').open)return;
  const wrap=$('.comparison-wrap'),marks=[...wrap.querySelectorAll('mark')],svg=wrap.querySelector('.contradiction-link');
  if(marks.length!==2||innerWidth<=760)return;
  const bounds=wrap.getBoundingClientRect(),left=marks[0].getClientRects()[0],right=marks[1].getClientRects()[0];
  const x1=left.right-bounds.left+3,y1=left.top-bounds.top+left.height/2,x2=right.left-bounds.left-3,y2=right.top-bounds.top+right.height/2;
  const bend=Math.max(24,Math.abs(x2-x1)/2);
  svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
  const path=svg.querySelector('path');path.setAttribute('d',`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`);
  const length=path.getTotalLength();path.style.strokeDasharray=String(length);path.style.strokeDashoffset=reducedMotion()?'0':String(length);
  $('.versus').style.top=`${(y1+y2)/2}px`;
}
let mobileFilterReturn;
function openMobileOptions(group){
  mobileFilterReturn=group||'more';
  renderMobileOptions();$('#options-drawer').showModal();
  $('#options-drawer').scrollTop=0;
}
function renderMobileOptions(){
  const mainGroups=['domains','norms','period'];
  $('#mobile-options-content').innerHTML=mainGroups.map(group=>{
    if(group==='domains')return `<section class="mobile-filter-group"><h3>${groupNames[group]}</h3>${filterChips(group)}</section>`;
    return `<section class="mobile-filter-group"><h3>${groupNames[group]}</h3>${popoverOptions(group)}</section>`;
  }).join('')+['types','territories','statuses','sources'].map(group=>`<section class="mobile-filter-group"><h3>${groupNames[group]}</h3>${filterChips(group)}</section>`).join('')+`<div class="keyword-fields"><div><label for="mobile-include">Mots-clés à inclure</label><input class="input" id="mobile-include" data-option="include" value="${esc(state.filters.include)}" placeholder="conservation, dossier"></div><div><label for="mobile-exclude">Mots-clés à exclure</label><input class="input" id="mobile-exclude" data-option="exclude" value="${esc(state.filters.exclude)}" placeholder="incident"></div></div><button type="button" class="text-button" id="reset-mobile-filters">Réinitialiser les filtres</button>`;
  $('#mobile-options-count').textContent=countFilters();
}
$('#options-drawer').addEventListener('close',()=>{
  const anchor=mobileFilterReturn==='more'?$('#more-options'):document.querySelector(`[data-popover="${mobileFilterReturn}"]`);
  anchor?.focus({preventScroll:true});
});
$('#options-drawer').addEventListener('click',event=>{if(event.target.closest('#reset-mobile-filters')){state.filters=M.defaults();renderFilters();renderMobileOptions();}});
window.addEventListener('resize',()=>{if($('#detail-drawer').open)connectHighlights(state.detailId);});
