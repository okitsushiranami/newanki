import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:5173';
assert.equal((await fetch(base+'/api/study')).status,401);
const signin=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=signin.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
assert.ok(cookie,'Local preview must provide its development sign-in cookie');
async function request(body,path=''){const r=await fetch(base+'/api/study'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','Origin':base}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const operationId=crypto.randomUUID();let deck;
try{
 const bad=await request({action:'import',operationId,name:'Invalid',cards:[{front:'',back:'answer'}]});assert.equal(bad.status,400);
 const payload={action:'import',operationId,name:'自動検証用（削除予定）',cards:[{front:'カンマ,改行\n引用符"',back:'答え',note:'説明',tags:'検証'},{front:'second',back:'2番目'}]};
 const imported=await request(payload);assert.equal(imported.status,200);deck=imported.data.deckId;
 await request(payload);let result=await request(null,'?deck='+deck);assert.equal(result.data.cards.length,2);
 const c=result.data.cards[0],eventId=crypto.randomUUID(),rating={action:'review',eventId,cardId:c.id,version:c.version,rating:'good',durationMs:1234};
 assert.equal((await request(rating)).status,200);assert.equal((await request(rating)).status,200);
 let updated=(await request(null,'?deck='+deck)).data.cards.find(x=>x.id===c.id);assert.equal(updated.reviews,1);assert.equal(updated.interval,1);
 assert.equal((await request({...rating,eventId:crypto.randomUUID()})).status,409);
 const parallel=await Promise.all([request({...rating,eventId:crypto.randomUUID(),version:updated.version}),request({...rating,eventId:crypto.randomUUID(),version:updated.version})]);assert.deepEqual(parallel.map(x=>x.status).sort(),[200,409]);
 updated=(await request(null,'?deck='+deck)).data.cards.find(x=>x.id===c.id);assert.equal(updated.reviews,2);
 assert.equal((await request({action:'editCard',deckId:deck,cardId:c.id,version:updated.version,front:'edited',back:'編集済み',note:'',tags:''})).status,200);
 const exported=(await request(null,'?export=1')).data;assert.equal(exported.reviews.filter(r=>r.card_id===c.id).length,2);assert.equal(exported.cards.find(x=>x.id===c.id).front,'edited');
 const forbidden=await fetch(base+'/api/study',{method:'POST',headers:{Cookie:cookie,Origin:'https://unrelated.invalid','Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(forbidden.status,403);
 console.log('PASS: validation, import retry, durable readback, review idempotency, concurrent update conflict, card edit, history export, origin protection');
}finally{if(deck){const r=await request({action:'deleteDeck',deckId:deck});assert.equal(r.status,200);assert.equal((await request(null,'?deck='+deck)).status,404);const all=(await request(null,'?export=1')).data;assert.ok(!all.cards.some(c=>c.deck_id===deck));assert.ok(!all.reviews.some(r=>r.deck_id===deck));console.log('PASS: test deck deletion cascades to its cards and history')}}
