const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../frontend/mocks/analysis.js');
const filter=(options={},query='Vérifier la cohérence des textes du corpus')=>M.filterIssues(query,{...M.defaults(),...options});

test('le corpus contient onze scénarios fictifs sur trois thèmes et quatre types',()=>{
  assert.equal(M.issues.length,11);
  assert.equal(new Set(M.issues.map(x=>x.theme)).size,3);
  assert.equal(new Set(M.issues.map(x=>x.type)).size,4);
  assert.equal(filter().length,11);
});
test('chaque exemple préremplit une demande et sélectionne les résultats de son thème',()=>{
  for(const example of M.examples){
    const results=filter(example.filters,example.text);
    assert.equal(results.length,example.id==='health'?5:3,example.id);
    assert.ok(results.every(x=>x.theme===example.id));
  }
});
test('les catégories se cumulent, les choix multiples se réunissent',()=>{
  assert.equal(filter({domains:['health','urban']}).length,8);
  const results=filter({domains:['health'],types:['conflict','duplicate']});
  assert.equal(results.length,3);
  assert.ok(results.every(x=>x.theme==='health'&&['conflict','duplicate'].includes(x.type)));
});
test('chaque niveau de norme et source filtre les textes réellement comparés',()=>{
  for(const norm of Object.keys(M.norms))assert.ok(filter({norms:[norm]}).every(x=>x.texts.some(t=>t.norm===norm)));
  for(const source of Object.keys(M.sourceNames))assert.ok(filter({sources:[source]}).every(x=>x.texts.some(t=>t.source===source)));
  assert.equal(filter({norms:['constitution']}).length,0);
  assert.equal(filter({sources:['eurlex']}).length,2);
});
test('territoire et statut sont appliqués au texte examiné',()=>{
  assert.equal(filter({territories:['local']}).length,2);
  assert.equal(filter({statuses:['draft']}).length,9);
  assert.equal(filter({statuses:['in_force']}).length,2);
});
test('la période suit la date du texte examiné, sur une horloge de démo fixe',()=>{
  assert.ok(filter({period:'1'}).every(x=>x.date>='2025-10-22'));
  assert.ok(filter({period:'5'}).every(x=>x.date>='2021-10-22'));
  assert.equal(filter({period:'10'}).length,11);
  assert.equal(filter({types:['obsolete'],period:'1'}).length,0);
});
test('les mots-clés ignorent accents et casse et respectent inclusions/exclusions',()=>{
  const included=filter({include:'CONSERVATION, SANTE'});
  assert.equal(included.length,1);
  assert.equal(included[0].id,'inc-1');
  assert.equal(filter({domains:['health'],exclude:'conservation'}).length,4);
  assert.equal(filter({include:'terme inexistant'}).length,0);
});
test('une demande hors des thèmes ne fabrique pas de résultat',()=>{
  assert.equal(filter({},'Calculer une orbite spatiale').length,0);
  assert.equal(filter({domains:['work']},M.examples[0].text).length,0);
});
test('les sources anglaises se limitent aux scénarios européens simulés',()=>{
  assert.equal(filter({language:'en'}).length,2);
  assert.equal(filter({language:'fr'}).length,11);
});
test('chaque détail dispose de deux références, passages et correction',()=>{
  for(const item of M.issues){
    assert.equal(item.texts.length,2);
    assert.ok(item.explanation&&item.suggestion);
    for(const t of item.texts)assert.ok(t.highlight&&t.reference&&t.date&&M.norms[t.norm]);
  }
});
test('les dates personnalisées filtrent les bornes inclusives',()=>{
  const results=filter({period:'custom',customFrom:'2026-01-01',customTo:'2026-08-21'});
  assert.ok(results.length>0);
  assert.ok(results.every(item=>item.date>='2026-01-01'&&item.date<='2026-08-21'));
  assert.equal(filter({period:'custom',customFrom:'2030-01-01'}).length,0);
});
test('chaque diagnostic possède une correction explicite pour le mini-diff',()=>{
  assert.ok(M.issues.every(item=>typeof item.correction==='string'&&item.correction.length>30));
});

test('le scénario Cicero présente deux conflits, deux vides et un doublon',()=>{
  const example=M.examples.find(e=>e.id==='health');
  const results=filter(example.filters,example.text);
  assert.equal(results.filter(item=>item.type==='conflict').length,2);
  assert.equal(results.filter(item=>item.type==='gap').length,2);
  assert.equal(results.filter(item=>item.type==='duplicate').length,1);
  const conflict=results.find(item=>item.id==='inc-1');
  assert.equal(conflict.texts[0].norm,'order');
  assert.equal(conflict.texts[1].norm,'decree');
  assert.ok(conflict.texts[0].highlight.includes('cinq ans'));
  assert.ok(conflict.texts[1].highlight.includes('vingt ans'));
  assert.ok(conflict.correction.includes('vingt ans'));
});
