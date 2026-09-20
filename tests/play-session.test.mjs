import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayState,advancePlay} from '../lib/play-session.ts';
const answer=(s,n)=>{for(let i=0;i<n;i++)s=advancePlay(s,'answer');return s};
test('default 20-card sets pause at each boundary and finish a partial set',()=>{
 let s=answer(createPlayState(45),20);assert.equal(s.screen,'break');assert.equal(s.answered,20);
 assert.deepEqual(advancePlay(s,'answer'),s);
 s=answer(advancePlay(s,'continue'),20);assert.equal(s.screen,'break');assert.equal(s.answered,40);
 s=answer(advancePlay(s,'continue'),5);assert.equal(s.screen,'done');assert.equal(s.answered,45);
});
test('looking back cannot duplicate ratings or skip a break',()=>{
 let s=answer(createPlayState(21),20);s=advancePlay(s,'previous');assert.equal(s.cursor,19);assert.equal(s.screen,'cards');assert.equal(s.answered,20);
 assert.deepEqual(advancePlay(s,'answer'),s);s=advancePlay(s,'next');assert.equal(s.screen,'break');
 s=advancePlay(s,'continue');s=advancePlay(s,'previous');s=advancePlay(s,'next');assert.equal(s.screen,'cards');assert.equal(s.cursor,20);
 s=advancePlay(s,'answer');s=advancePlay(s,'previous');s=advancePlay(s,'next');assert.equal(s.screen,'done');assert.equal(s.answered,21);
});
test('custom size, short decks, exact multiples and first-card navigation',()=>{
 let s=createPlayState(5,5);assert.deepEqual(advancePlay(s,'previous'),s);assert.deepEqual(advancePlay(s,'next'),s);assert.equal(answer(s,5).screen,'done');
 assert.equal(answer(createPlayState(3),3).screen,'done');assert.equal(answer(createPlayState(20),20).screen,'done');assert.equal(answer(createPlayState(11,5),5).screen,'break');
});
