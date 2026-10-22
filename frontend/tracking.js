/* Pages de diagnostic et de suivi. Toutes les données restent dans la session. */
function updateNavigation(view){
  if(view)document.body.dataset.view=view;
  const tracking=document.body.dataset.view==='tracking';
  for(const [id,active]of [['nav-analysis',!tracking],['nav-tracking',tracking]]){
    const button=$('#'+id);button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  const info=M.tracking.summary(state.followed,state.treated);
  $('#tracking-alert-count').textContent=info.newAlerts;
  $('#nav-tracking').classList.toggle('has-alerts',info.newAlerts>0);
}
function currentFindings(){
  const matches=M.filterIssues(state.lastQuery,state.filters);
  const followed=state.followed.find(text=>text.id===state.currentFollowedId);
  return followed?.analyzed?matches.filter(item=>followed.issueIds.includes(item.id)):matches;
}
function diagnosticProject(){
  const current=state.followed.find(text=>text.id===state.currentFollowedId);
  if(current)return current;
  const known=state.followed.find(text=>M.normalize(text.query.trim())===M.normalize(state.lastQuery.trim()));
  if(known)return known;
  const themes=M.queryThemes(state.lastQuery);
  const norm=/arr[eê]t[eé]/i.test(state.lastQuery)?'order':/d[eé]cret/i.test(state.lastQuery)?'decree':/loi/i.test(state.lastQuery)?'law':/d[eé]lib[eé]ration/i.test(state.lastQuery)?'local':null;
  return {title:state.lastQuery.length<=160?state.lastQuery:'Projet de texte soumis à l’analyse',reference:'Texte non référencé',norm,theme:themes[0]||'health',status:'À examiner',query:state.lastQuery};
}
function renderDiagnosticContext(){
  const project=diagnosticProject(),followed=state.followed.find(text=>text.id===project.id);
  $('#diagnostic-context').innerHTML=`<section class="diagnostic-project" aria-label="Texte examiné"><div><p class="eyebrow">Texte examiné · scénario fictif</p><h1>${esc(project.title)}</h1><div class="project-meta"><span class="reference-pill">${esc(project.reference)}</span>${project.norm?`<span class="tag">${M.norms[project.norm]}</span>`:''}<span class="tag">${esc(project.status)}</span></div></div><button class="secondary-button" data-follow-current>${icon(followed?'check':'plus')}${followed?'Texte suivi':'Suivre ce texte'}</button></section>`;
}
function syncTrackedAnalysis(){
  const text=state.followed.find(text=>text.id===state.currentFollowedId);
  if(!text)return;
  if(!text.analyzed){text.issueIds=state.results.map(item=>item.id);text.newIssueIds=[...text.issueIds];text.analyzed=true;text.status=text.issueIds.length?'À examiner':'Prêt pour relecture';}
  text.updated=new Date().toISOString();updateNavigation();
}
function followCurrentText(){
  const project=diagnosticProject();
  if(state.followed.some(text=>text.id===project.id)){showTracking();return;}
  const text={...project,id:crypto.randomUUID(),norm:project.norm||'order',owner:'Votre espace',updated:new Date().toISOString(),issueIds:state.results.map(item=>item.id),newIssueIds:state.results.map(item=>item.id),analyzed:true};
  state.followed.unshift(text);state.currentFollowedId=text.id;renderDiagnosticContext();updateNavigation();toast('Texte ajouté au suivi de cette session.');
}
function showTracking(){
  stopPlaceholder();state.runId++;cancelAnimationFrame(animationFrame);state.autoTyping=false;state.phase='tracking';
  $('#home-screen').hidden=true;$('#analysis-screen').hidden=true;$('#results-screen').hidden=true;$('#tracking-screen').hidden=false;
  updateNavigation('tracking');renderTracking();updateLaunch();window.scrollTo({top:0,behavior:'instant'});
  document.title='Mes textes suivis — Cicero';history.replaceState(null,'','#suivi');
}
function displayCheck(value){
  const date=new Date(value);return date.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
function trackingCard(text){
  const pending=M.tracking.pendingIds(text,state.treated),newAlerts=M.tracking.newIds(text,state.treated),findings=M.issues.filter(item=>pending.includes(item.id));
  const counts=Object.entries(M.meta).map(([type,meta])=>{const count=findings.filter(item=>item.type===type).length;return {type,count,label:count===1?singular[type]:meta.plural};}).filter(item=>item.count);
  return `<article class="tracked-card" data-tracked-id="${esc(text.id)}"><div class="tracked-top"><span class="tracked-status">${esc(text.status)}</span>${newAlerts.length?`<span class="new-alert-badge">${icon('bell')}${newAlerts.length} nouvelle${newAlerts.length>1?'s':''}</span>`:'<span class="tag">Suivi simulé</span>'}</div><h2>${esc(text.title)}</h2><div class="tracked-meta"><span class="reference-pill">${esc(text.reference)}</span><span>${M.norms[text.norm]}</span><span>·</span><span>${esc(text.owner)}</span></div><div class="tracked-alerts">${pending.length?`<span class="tracked-alert-count">${pending.length} alerte${pending.length>1?'s':''} à traiter</span>${counts.map(item=>tag(item.type,`${item.count} ${item.label}`)).join('')}`:`<span class="tracked-quiet">${icon(text.analyzed?'check':'clock')}${text.analyzed?'Aucune alerte à traiter dans ce scénario':'En attente d’une première analyse'}</span>`}</div><div class="tracked-bottom"><span>Dernière vérification : ${displayCheck(text.updated)}</span><button class="text-button" data-open-tracked="${esc(text.id)}">Ouvrir le diagnostic ${icon('arrow')}</button></div></article>`;
}
function renderTracking(){
  const info=M.tracking.summary(state.followed,state.treated);
  $('#tracking-overview').innerHTML=`<article class="tracking-stat"><span>Textes en cours</span><strong>${info.total}</strong><small>dans votre espace</small></article><article class="tracking-stat attention"><span>Avec des alertes</span><strong>${info.attention}</strong><small>à examiner</small></article><article class="tracking-stat ${info.newAlerts?'attention':''}"><span>Nouveaux signaux</span><strong>${info.newAlerts}</strong><small>depuis votre dernier examen</small></article>`;
  const texts=M.tracking.filterTexts(state.followed,state.trackingQuery,state.trackingFilter,state.treated);
  $('#tracking-list').innerHTML=`<div class="tracking-list-header"><span>${texts.length} texte${texts.length>1?'s':''} affiché${texts.length>1?'s':''}</span><span>Vigilance sur les textes en préparation</span></div>${texts.length?texts.map(trackingCard).join(''):emptyState('Aucun texte dans cette sélection.','Modifiez votre recherche ou élargissez le filtre de suivi.','','search')}`;
}
function openTrackedDiagnostic(id){
  const text=state.followed.find(text=>text.id===id);if(!text)return;
  if(!text.analyzed){showHome();state.currentFollowedId=id;$('#query').value=text.query;state.filters={...M.defaults(),domains:[text.theme]};renderFilters();updateLaunch();runAnalysis();return;}
  state.runId++;cancelAnimationFrame(animationFrame);state.currentFollowedId=id;state.lastQuery=text.query;state.phase='complete';state.completedMode='normal';state.duration=0;state.filters={...M.defaults(),domains:[text.theme]};
  state.results=M.issues.filter(item=>text.issueIds.includes(item.id));text.newIssueIds=[];
  $('#query').value=text.query;$('#tracking-screen').hidden=true;$('#home-screen').hidden=true;$('#analysis-screen').hidden=true;$('#results-screen').hidden=false;
  updateNavigation('analysis');renderResults(true);$('#analysis-duration').textContent='Dernier diagnostic · simulation';
  document.title=text.title+' — Cicero';window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.id==='nav-analysis'){showHome();document.title='Cicero — La clarté du droit';}
  if(button.id==='nav-tracking')showTracking();
  if(button.dataset.openTracked)openTrackedDiagnostic(button.dataset.openTracked);
  if(button.hasAttribute('data-follow-current'))followCurrentText();
  if(button.id==='add-tracked-text')$('#add-text-dialog').showModal();
});
$('#tracking-search').addEventListener('input',event=>{state.trackingQuery=event.target.value;renderTracking();});
$('#tracking-filter').addEventListener('change',event=>{state.trackingFilter=event.target.value;renderTracking();});
$('#add-text-form').addEventListener('submit',event=>{
  event.preventDefault();const data=new FormData(event.target),title=String(data.get('title')).trim(),query=String(data.get('query')).trim();
  if(!title||query.length<10)return;
  const text={id:crypto.randomUUID(),title,reference:String(data.get('reference')).trim()||'Projet sans référence',norm:String(data.get('norm')),theme:String(data.get('domain')),status:'En attente d’analyse',owner:'Votre espace',updated:new Date().toISOString(),query,issueIds:[],newIssueIds:[],analyzed:false};
  state.followed.unshift(text);$('#add-text-dialog').close();event.target.reset();showHome();state.currentFollowedId=text.id;state.filters={...M.defaults(),domains:[text.theme]};$('#query').value=text.query;renderFilters();updateLaunch();runAnalysis();
});
updateNavigation('analysis');

function restorePageFromHash(){
  if(location.hash==='#suivi'){showTracking();return;}
  if(location.hash.startsWith('#diagnostic/')){
    let id;try{id=decodeURIComponent(location.hash.slice('#diagnostic/'.length));}catch{showHome();return;}
    if(state.followed.some(text=>text.id===id)){openTrackedDiagnostic(id);return;}
  }
  showHome();
}
window.addEventListener('hashchange',restorePageFromHash);
if(location.hash)restorePageFromHash();
