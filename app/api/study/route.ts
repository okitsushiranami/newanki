import {getChatGPTUser} from '../../chatgpt-auth';
import {db} from '../../../db/raw';
import {schedule,type Card} from '../../../lib/study';
export const dynamic='force-dynamic';
class AppError extends Error{constructor(message:string,public status=400){super(message)}}
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const string=(v:unknown,max:number,required=true)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new AppError('入力内容または文字数を確認してください。');return v.trim();};
const id=(v:unknown)=>{const s=string(v,100);if(!/^[a-zA-Z0-9_-]+$/.test(s))throw new AppError('IDが正しくありません。');return s;};
async function ownedDeck(deck:string,owner:string){const d=await db().prepare('SELECT * FROM decks WHERE id=? AND owner=?').bind(deck,owner).first();if(!d)throw new AppError('単語帳が見つかりません。',404);return d;}
async function handled(fn:()=>Promise<Response>){try{return await fn()}catch(e){if(e instanceof AppError)return response({error:e.message},e.status);console.error('Study API failed',e);return response({error:'保存先に接続できませんでした。入力を残しているので、もう一度お試しください。'},503)}}
export async function GET(req:Request){return handled(async()=>{
 const user=await getChatGPTUser();if(!user)return response({error:'ログインしてください。'},401);
 const owner=user.userId,url=new URL(req.url),deck=url.searchParams.get('deck'),now=Date.now();
 if(deck){await ownedDeck(id(deck),owner);const cards=await db().prepare('SELECT * FROM cards WHERE deck_id=? ORDER BY due,created_at,id').bind(deck).all();return response({cards:cards.results,serverTime:now});}
 if(url.searchParams.get('export')==='1'){
  const [decks,cards,reviews]=await db().batch([db().prepare('SELECT * FROM decks WHERE owner=? ORDER BY created_at').bind(owner),db().prepare('SELECT c.* FROM cards c JOIN decks d ON d.id=c.deck_id WHERE d.owner=?').bind(owner),db().prepare('SELECT * FROM reviews WHERE owner=? ORDER BY reviewed_at').bind(owner)]);
  return response({schemaVersion:1,scheduler:'newanki-v1',exportedAt:new Date().toISOString(),timezone:'Asia/Tokyo',aiMonitoring:{requested:true,enabled:false},decks:decks.results,cards:cards.results,reviews:reviews.results});
 }
 const [decks,daily,summary,recent]=await db().batch([
 db().prepare('SELECT d.id,d.name,d.created_at,COUNT(c.id) AS total,COALESCE(SUM(CASE WHEN c.due<=? THEN 1 ELSE 0 END),0) AS due,COALESCE(SUM(CASE WHEN c.interval>=21 THEN 1 ELSE 0 END),0) AS learned FROM decks d LEFT JOIN cards c ON c.deck_id=d.id WHERE d.owner=? GROUP BY d.id ORDER BY d.created_at DESC').bind(now,owner),
 db().prepare("SELECT strftime('%Y-%m-%d',reviewed_at/1000,'unixepoch','+9 hours') AS day,COUNT(*) AS count,SUM(CASE WHEN rating='good' THEN 1 ELSE 0 END) AS good,SUM(duration_ms) AS duration FROM reviews WHERE owner=? GROUP BY day ORDER BY day DESC LIMIT 366").bind(owner),
 db().prepare("SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN rating='good' THEN 1 ELSE 0 END),0) AS good,COALESCE(SUM(duration_ms),0) AS duration FROM reviews WHERE owner=?").bind(owner),
 db().prepare('SELECT r.id,r.rating,r.reviewed_at,r.next_due,c.front,d.name FROM reviews r JOIN cards c ON c.id=r.card_id JOIN decks d ON d.id=r.deck_id WHERE r.owner=? ORDER BY r.reviewed_at DESC LIMIT 30').bind(owner)]);
 return response({user:{email:user.email},decks:decks.results,daily:daily.results,summary:summary.results[0],recent:recent.results,serverTime:now});
})}
export async function POST(req:Request){return handled(async()=>{
 const user=await getChatGPTUser();if(!user)return response({error:'ログインしてください。'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new AppError('別のサイトからの保存はできません。',403);
 if(Number(req.headers.get('content-length')||0)>3_000_000)throw new AppError('ファイルは2MB以下にしてください。');
 const raw=await req.text();if(raw.length>3_000_000)throw new AppError('データが大きすぎます。');let body;try{body=JSON.parse(raw)}catch{throw new AppError('データ形式が正しくありません。')}
 const owner=user.userId,now=Date.now(),database=db();
 if(body.action==='import'){
  const operation=id(body.operationId),deck=body.deckId?id(body.deckId):operation;
  if(!Array.isArray(body.cards)||body.cards.length<1||body.cards.length>1000)throw new AppError('1回に1〜1,000枚まで取り込めます。');
  const rows=body.cards.map((c:Record<string,unknown>,i:number)=>({id:operation+'-'+i,front:string(c.front,5000),back:string(c.back,10000),note:string(c.note??'',10000,false),tags:string(c.tags??'',500,false)}));
  const statements=[];
  if(body.deckId)await ownedDeck(deck,owner);else {const existing=await database.prepare('SELECT owner FROM decks WHERE id=?').bind(deck).first();if(existing&&existing.owner!==owner)throw new AppError('保存できません。',409);statements.push(database.prepare('INSERT OR IGNORE INTO decks(id,owner,name,created_at) VALUES(?,?,?,?)').bind(deck,owner,string(body.name,100),now));}
  statements.push(database.prepare("INSERT OR IGNORE INTO cards(id,deck_id,front,back,note,tags,due,created_at) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.front'),json_extract(value,'$.back'),json_extract(value,'$.note'),json_extract(value,'$.tags'),?,? FROM json_each(?)").bind(deck,now,now,JSON.stringify(rows)));
  await database.batch(statements);return response({deckId:deck,count:rows.length});
 }
 if(body.action==='review'){
  const event=id(body.eventId),cardId=id(body.cardId);
  const duplicate=await database.prepare('SELECT * FROM reviews WHERE id=? AND owner=?').bind(event,owner).first();if(duplicate)return response({saved:true,nextDue:duplicate.next_due});
  const card=await database.prepare('SELECT c.* FROM cards c JOIN decks d ON d.id=c.deck_id WHERE c.id=? AND d.owner=?').bind(cardId,owner).first<Card>();if(!card)throw new AppError('カードが見つかりません。',404);
  if(!Number.isInteger(body.version)||card.version!==body.version)throw new AppError('別の端末で更新されました。単語帳を開き直してください。',409);
  if(body.rating!=='again'&&body.rating!=='good')throw new AppError('判定が正しくありません。');
  if(!Number.isFinite(body.durationMs)||body.durationMs<0)throw new AppError('学習時間が正しくありません。');
  const next=schedule(card,body.rating,now),duration=Math.min(600000,Math.round(body.durationMs));
  const result=await database.batch([
   database.prepare('INSERT OR IGNORE INTO reviews(id,owner,card_id,deck_id,rating,reviewed_at,duration_ms,old_interval,new_interval,next_due) SELECT ?,?,?,?,?,?,?,?,?,? FROM cards WHERE id=? AND version=?').bind(event,owner,cardId,card.deck_id,body.rating,now,duration,card.interval,next.interval,next.due,cardId,body.version),
   database.prepare('UPDATE cards SET due=?,interval=?,streak=?,lapses=?,reviews=reviews+1,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM reviews WHERE id=? AND card_id=?)').bind(next.due,next.interval,next.streak,next.lapses,cardId,body.version,event,cardId)]);
  if(!result[1].meta.changes){const saved=await database.prepare('SELECT next_due FROM reviews WHERE id=? AND owner=?').bind(event,owner).first();if(saved)return response({saved:true,nextDue:saved.next_due});throw new AppError('別の端末で更新されました。単語帳を開き直してください。',409);}
  return response({saved:true,nextDue:next.due});
 }
 const deck=id(body.deckId);await ownedDeck(deck,owner);
 if(body.action==='rename'){await database.prepare('UPDATE decks SET name=? WHERE id=? AND owner=?').bind(string(body.name,100),deck,owner).run();return response({saved:true});}
 if(body.action==='deleteDeck'){await database.prepare('DELETE FROM decks WHERE id=? AND owner=?').bind(deck,owner).run();return response({deleted:true});}
 if(body.action==='deleteCard'){await database.prepare('DELETE FROM cards WHERE id=? AND deck_id=?').bind(id(body.cardId),deck).run();return response({deleted:true});}
 if(body.action==='editCard'){
  if(!Number.isInteger(body.version))throw new AppError('カードの状態が正しくありません。');
  const r=await database.prepare('UPDATE cards SET front=?,back=?,note=?,tags=?,version=version+1 WHERE id=? AND deck_id=? AND version=?').bind(string(body.front,5000),string(body.back,10000),string(body.note??'',10000,false),string(body.tags??'',500,false),id(body.cardId),deck,body.version).run();
  if(!r.meta.changes)throw new AppError('カードが更新されています。一覧を開き直してください。',409);return response({saved:true});
 }
 throw new AppError('操作が見つかりません。');
})}
