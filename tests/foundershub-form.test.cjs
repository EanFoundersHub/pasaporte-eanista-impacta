const test=require('node:test');
const assert=require('node:assert/strict');
const definition=require('../foundershub-form-definition.json');

test('replica las 70 preguntas y 11 secciones de FoundersHub',()=>{
  assert.equal(definition.fields.length,70);
  assert.equal(definition.sections.length,11);
  assert.equal(definition.fields.reduce((total,field)=>total+(field.options?.length||0),0),344);
});

test('conserva selección múltiple y ramificaciones verificadas',()=>{
  assert.equal(definition.fields.filter(field=>field.type==='multiselect').length,6);
  const byId=Object.fromEntries(definition.fields.map(field=>[field.id,field]));
  assert.deepEqual(byId.q01.branchEndOn,['No']);
  assert.equal(byId.q10.condition,'q09=Otro');
  assert.equal(byId.q12.condition,'q11=Referido');
  assert.equal(byId.q13.condition,'q11=Colaborador administrativo de la Universidad');
  assert.equal(byId.q17.condition,'q16=Pregrado');
  assert.equal(byId.q19.condition,'q16=Posgrado');
  assert.equal(byId.q29.condition,'q28=Otro');
  assert.equal(byId.q40.condition,'q39=Otras estructuras legales');
  assert.equal(byId.q67.condition,'q66=Otro');
});
