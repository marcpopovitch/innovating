/* Suivi local de démonstration : aucune surveillance réelle ni notification externe. */
(function(root){
  const followedTexts=[
    {id:'suivi-sante',title:'Conservation des dossiers médicaux partagés',reference:'Projet d’arrêté SANP2600142A',norm:'order',theme:'health',status:'En révision',owner:'Direction de la santé',updated:'2026-10-22T09:42:00',query:'Projet d’arrêté fixant la durée de conservation des dossiers médicaux partagés à 5 ans chez les hébergeurs certifiés.',issueIds:['inc-1','inc-2','inc-3','inc-4','inc-5'],newIssueIds:['inc-1','inc-2','inc-4'],analyzed:true},
    {id:'suivi-travail',title:'Repos quotidien et organisation du temps de travail',reference:'Projet de décret n° 2026-705',norm:'decree',theme:'work',status:'En rédaction',owner:'Direction du travail',updated:'2026-10-22T09:15:00',query:'Vérifier la cohérence des textes sur le repos quotidien, le télétravail et le suivi du temps de travail.',issueIds:['LG-039','LG-038','LG-037'],newIssueIds:['LG-039','LG-038'],analyzed:true},
    {id:'suivi-urbanisme',title:'Installations temporaires et rénovation en zone urbaine',reference:'Projet de délibération n° 2026-061',norm:'local',theme:'urban',status:'En instruction',owner:'Commune de Valmont',updated:'2026-10-22T08:50:00',query:'Vérifier les règles d’urbanisme : autorisations des installations temporaires, rénovation et pièces des dossiers d’aménagement.',issueIds:['LG-036','LG-035','LG-034'],newIssueIds:['LG-036'],analyzed:true},
    {id:'suivi-procedure',title:'Dépôt des demandes de télétravail',reference:'Projet d’arrêté FP-2026-118',norm:'order',theme:'work',status:'Prêt pour relecture',owner:'Secrétariat général',updated:'2026-10-22T08:30:00',query:'Procédure administrative de dépôt des demandes de télétravail.',issueIds:[],newIssueIds:[],analyzed:true}
  ];
  const pendingIds=(text,treated=new Set())=>text.issueIds.filter(id=>!treated.has(id));
  const newIds=(text,treated=new Set())=>text.newIssueIds.filter(id=>text.issueIds.includes(id)&&!treated.has(id));
  function summary(texts,treated=new Set()){
    return {total:texts.length,attention:texts.filter(text=>pendingIds(text,treated).length).length,newAlerts:texts.reduce((sum,text)=>sum+newIds(text,treated).length,0)};
  }
  function filterTexts(texts,query='',status='all',treated=new Set()){
    const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const needle=normalize(query.trim());
    return texts.filter(text=>normalize(`${text.title} ${text.reference} ${text.owner}`).includes(needle)&&(
      status==='all'||status==='new'&&newIds(text,treated).length>0||status==='attention'&&pendingIds(text,treated).length>0||status==='quiet'&&pendingIds(text,treated).length===0
    ));
  }
  const api={followedTexts,pendingIds,newIds,summary,filterTexts};
  if(root.CiceroMock){root.CiceroMock.followedTexts=followedTexts;root.CiceroMock.tracking=api;}
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
