import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedDeckCount,saveReviewLocally,loadCards,loadDashboard,queueCount,flushQueue} from '../lib/offline.ts';

test('local commit persists history and card before network, and retries the same event',async()=>{
 const owner='local-test',card={id:'c1',version:2},dashboard={user:{email:owner},summary:{count:1}};
 await saveReviewLocally(owner,{eventId:'e1'},'d1',[card],dashboard);
 assert.deepEqual(await loadCards(owner,'d1'),[card]);
 assert.equal(await cachedDeckCount(owner),1);
 assert.equal(await cachedDeckCount('another-owner'),0);
 assert.deepEqual(await loadDashboard(),dashboard);
 assert.equal(await queueCount(owner),1);
 await flushQueue(owner,async()=>{throw new Error('offline')});
 assert.equal(await queueCount(owner),1);
 const sent=[];await flushQueue(owner,async body=>sent.push(body.eventId));
 assert.deepEqual(sent,['e1']);assert.equal(await queueCount(owner),0);
});

test('concurrent flushes share a writer and include answers added during slow network',async()=>{
 const owner='concurrent-test',dashboard={user:{email:owner}};
 await saveReviewLocally(owner,{eventId:'e2'},'d2',[],dashboard);
 let release,started;const ready=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve),sent=[];
 const send=async body=>{sent.push(body.eventId);if(body.eventId==='e2'){started();await gate}};
 const first=flushQueue(owner,send);await ready;
 const second=flushQueue(owner,send);assert.equal(first,second);
 await saveReviewLocally(owner,{eventId:'e3'},'d2',[],dashboard);
 release();await first;
 assert.deepEqual(sent,['e2','e3']);assert.equal(await queueCount(owner),0);
});

test('failed transaction cannot leave a queued event without corresponding history',async()=>{
 const owner='atomic-test';
 await assert.rejects(saveReviewLocally(owner,{eventId:'bad'},'d3',[],{user:{email:owner},invalid:()=>{}}));
 assert.equal(await queueCount(owner),0);
 assert.equal(await loadCards(owner,'d3'),null);
});
