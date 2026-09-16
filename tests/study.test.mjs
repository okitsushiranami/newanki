import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,schedule,csvCell,jstDate} from '../lib/study.ts';
test('CSV handles BOM, quoted commas, line breaks and escaped quotes',()=>{assert.deepEqual(parseCsv('\uFEFF問題,答え,補足\r\n"a,b","c\nd","say ""hi"""\r\n'),[['問題','答え','補足'],['a,b','c\nd','say "hi"']]);});
test('CSV rejects broken quotation without silently changing cards',()=>{assert.throws(()=>parseCsv('a,"b'));assert.throws(()=>parseCsv('a,b"c'));assert.throws(()=>parseCsv('"a"z,b'));assert.throws(()=>parseCsv('\n'));});
test('schedule restarts after lapse and expands remembered cards',()=>{const t=100000000;let card={interval:0,streak:0,lapses:0};card=schedule(card,'good',t);assert.equal(card.interval,1);card=schedule(card,'good',t);assert.equal(card.interval,3);card=schedule(card,'good',t);assert.equal(card.interval,7);card=schedule(card,'again',t);assert.equal(card.due,t+600000);assert.equal(card.streak,0);assert.equal(card.lapses,1);assert.equal(schedule(card,'good',t).interval,1);assert.equal(schedule({interval:364,streak:20,lapses:0},'good',t).interval,365)});
test('CSV export escapes formula cells and quotes',()=>{assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('say "yes"'),'"say ""yes"""')});
test('Japanese day boundary',()=>{assert.equal(jstDate(Date.parse('2026-09-16T15:00:00Z')),'2026-09-17')});
