const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../frontend/mocks/analysis.js');
const T=require('../frontend/mocks/tracking.js');

test('les textes suivis ne référencent que des détections existantes',()=>{
  assert.equal(T.followedTexts.length,4);
  const known=new Set(M.issues.map(item=>item.id));
  for(const text of T.followedTexts){
    assert.ok(text.title&&text.reference&&text.query&&M.norms[text.norm]);
    assert.ok(text.issueIds.every(id=>known.has(id)));
    assert.ok(text.newIssueIds.every(id=>text.issueIds.includes(id)));
  }
});
test('le suivi présente quatre textes, trois avec alertes et six nouveaux signaux',()=>{
  assert.deepEqual(T.summary(T.followedTexts),{total:4,attention:3,newAlerts:6});
});
test('les traitements retirent les alertes des compteurs sans effacer le diagnostic',()=>{
  const text=T.followedTexts[0],treated=new Set(text.issueIds);
  assert.equal(T.pendingIds(text,treated).length,0);
  assert.equal(T.newIds(text,treated).length,0);
  assert.equal(text.issueIds.length,5);
  assert.equal(T.summary(T.followedTexts,treated).attention,2);
});
test('la recherche et les filtres de suivi se cumulent',()=>{
  assert.equal(T.filterTexts(T.followedTexts,'SANTE').length,1);
  assert.equal(T.filterTexts(T.followedTexts,'','new').length,3);
  assert.equal(T.filterTexts(T.followedTexts,'','quiet').length,1);
  assert.equal(T.filterTexts(T.followedTexts,'Valmont','attention').length,1);
  assert.equal(T.filterTexts(T.followedTexts,'introuvable').length,0);
});
test('une alerte consultée peut rester à traiter',()=>{
  const read={...T.followedTexts[0],newIssueIds:[]};
  assert.equal(T.newIds(read).length,0);
  assert.equal(T.pendingIds(read).length,5);
});
