'use client';
import {useEffect,useRef,useState} from 'react';
import type {Card,Rating} from '../lib/study';
import {schedule} from '../lib/study';
import {advancePlay,createPlayState} from '../lib/play-session';

export type ReviewRequest={eventId:string;rating:Rating;durationMs:number};
export default function StudyPlayer({cards,name,setSize,busy,onReview,onExit,onFinish}:{cards:Card[];name:string;setSize:number;busy:boolean;onReview:(card:Card,request:ReviewRequest)=>Promise<boolean>;onExit:()=>void;onFinish:()=>void}){
 const [state,setState]=useState(()=>createPlayState(cards.length,setSize));
 const [revealed,setRevealed]=useState(false),[hint,setHint]=useState(false),[ratings,setRatings]=useState<Rating[]>([]),[pending,setPending]=useState<ReviewRequest|null>(null);
 const lock=useRef(false),started=useRef(Date.now()),elapsed=useRef(0),touch=useRef<{id:number;x:number;y:number;at:number;dx:number;dy:number}|null>(null),face=useRef<HTMLDivElement>(null),suppressClick=useRef(false);
 const card=cards[state.cursor],reviewing=state.cursor<state.answered,disabled=busy||!!pending;
 const resetDrag=()=>{if(face.current){face.current.style.transform='';face.current.removeAttribute('data-dragging');face.current.removeAttribute('data-direction')}};
 const toggle=()=>{if(!disabled&&!lock.current){setRevealed(value=>!value);setHint(false)}};
 const resetFace=()=>{setRevealed(false);setHint(false)};
 const move=(action:'previous'|'next'|'continue')=>{
  if(lock.current||disabled)return;
  const next=advancePlay(state,action);
  if(next===state)return;
  if(state.screen==='cards'&&!reviewing)elapsed.current+=Date.now()-started.current;
  if(next.screen==='cards'&&next.cursor===next.answered)started.current=Date.now();
  setState(next);resetFace();
 };
 const rate=async(rating:Rating)=>{
  if(lock.current||busy||state.screen!=='cards'||reviewing||!revealed||!card||(pending&&pending.rating!==rating))return;
  lock.current=true;
  const request=pending||{eventId:crypto.randomUUID(),rating,durationMs:Math.max(0,elapsed.current+Date.now()-started.current)};
  setPending(request);
  try{if(!await onReview(card,request))return;
   const next=advancePlay(state,'answer');setRatings(values=>[...values,rating]);setState(next);setPending(null);resetFace();resetDrag();elapsed.current=0;started.current=Date.now();
   if(next.screen==='done')onFinish();
  }finally{lock.current=false;resetDrag()}
 };
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{
  if(state.screen!=='cards'||busy||(event.target as HTMLElement).closest('input,textarea,select,button,a'))return;
  if(event.code==='Space'){event.preventDefault();if(!pending)setRevealed(value=>!value)}
  if(event.key==='1'||event.key==='ArrowLeft')void rate('again');
  if(event.key==='2'||event.key==='ArrowRight')void rate('good');
 };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)});
 const percent=state.total?Math.round(state.answered/state.total*100):100;
 const good=ratings.filter(value=>value==='good').length;
 return <div className="study">
  <div className="row spaced"><button className="text-button" disabled={disabled} onClick={onExit}>終了する</button><span className="subtle break">{name}</span></div>
  {state.screen!=='cards'?<section className="panel break-panel" aria-label={state.screen==='break'?'ブレイク':'プレイ完了'}>
   <p className="eyebrow">{state.screen==='break'?`セット${Math.ceil(state.answered/state.size)} 完了`:'すべてのセットが完了'}</p>
   <h1>{state.screen==='break'?'ひと息つきましょう。':'おつかれさまでした。'}</h1>
   <p className="break-percent">{percent}<small>% 達成</small></p>
   <progress max={state.total||1} value={state.answered} aria-label="今回のプレイの達成率"/>
   <p>{state.answered} / {state.total}枚を学習 · 残り{state.total-state.answered}枚</p>
   <p className="subtle">わかった {good}枚 · 難しい {state.answered-good}枚</p>
   <div className="break-actions">
    {state.screen==='break'&&<button className="primary" disabled={busy} onClick={()=>move('continue')}>続ける（次の{Math.min(state.size,state.total-state.answered)}枚）</button>}
    <button className="secondary" disabled={busy} onClick={onExit}>終了する</button>
    <button className="text-button" disabled={disabled||!state.answered} onClick={()=>move('previous')}>一つ前の問題に戻る</button>
   </div>
  </section>:card&&<>
   <div className="row spaced" style={{marginTop:16}}><span className="subtle">セット{Math.floor(state.cursor/state.size)+1} · {state.cursor%state.size+1} / {Math.min(state.size,state.total-Math.floor(state.cursor/state.size)*state.size)}枚</span><span className="badge">{reviewing?'回答済み':`${percent}% 達成`}</span></div>
   <progress className="play-progress" max={state.total} value={state.answered} aria-label="今回のプレイの達成率"/>
   <div ref={face} className="flashcard" aria-label="単語カード。タップで答えを表示・非表示"
    onClick={event=>{if((event.target as HTMLElement).closest('button,a'))return;if(suppressClick.current){suppressClick.current=false;return}toggle()}}
    onPointerDown={event=>{
     if(!event.isPrimary||event.button!==0||disabled||(event.target as HTMLElement).closest('button,a'))return;
     suppressClick.current=false;touch.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),dx:0,dy:0};
     event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event=>{
     const start=touch.current;if(!start||start.id!==event.pointerId)return;
     start.dx=event.clientX-start.x;start.dy=event.clientY-start.y;
     if(Math.abs(start.dx)>8||Math.abs(start.dy)>8)suppressClick.current=true;
     if(!revealed||reviewing||Math.abs(start.dy)>Math.abs(start.dx))return;
     const maxOffset=Math.min(window.innerWidth*.9,480);
     const dx=Math.sign(start.dx)*Math.min(Math.abs(start.dx)*1.8,maxOffset);
     event.currentTarget.dataset.dragging='true';event.currentTarget.dataset.direction=dx>0?'good':'again';
     const rotation=Math.max(-14,Math.min(14,dx/24));
     event.currentTarget.style.transform=`translate3d(${dx}px,0,0) rotate(${rotation}deg)`;
    }}
    onPointerUp={event=>{
     const start=touch.current;touch.current=null;if(!start)return;
     const dx=event.clientX-start.x,dy=event.clientY-start.y;
     const swiped=Math.abs(dx)>Math.abs(dy)*1.5&&(Math.abs(dx)>72||(Math.abs(dx)>28&&Math.abs(dx)/Math.max(1,performance.now()-start.at)>.5));
     if(Math.abs(dx)>8||Math.abs(dy)>8)suppressClick.current=true;
     resetDrag();if(swiped&&revealed&&!reviewing){if(typeof navigator.vibrate==='function')navigator.vibrate(10);void rate(dx>0?'good':'again')}
    }}
    onPointerCancel={()=>{touch.current=null;suppressClick.current=true;resetDrag()}}
    onLostPointerCapture={()=>{touch.current=null;resetDrag()}}>
    <span className="swipe-feedback" aria-hidden="true"><span>← 難しい</span><span>わかった →</span></span>
    <span className="eyebrow">{revealed?'QUESTION & ANSWER':'QUESTION'}</span><div key={state.cursor} className="question word-enter">{card.front}</div>
    {revealed&&<><div className="answer">{card.back}</div>{card.note&&<p className="hint">{card.note}</p>}</>}
    <button className={revealed?'secondary':'primary'} disabled={disabled} aria-expanded={revealed} onClick={toggle}>{revealed?'答えを隠す':'答えを見る'}</button>
    {!revealed&&<><button className="text-button" disabled={disabled} onClick={()=>setHint(true)}>最初の1文字をヒントに</button>{hint&&<p className="hint">{Array.from(card.back)[0]}…</p>}</>}
   </div>
   {reviewing?<div className="review-navigation"><p className="subtle">記録済み：{ratings[state.cursor]==='good'?'わかった':'難しい'}（見返しでは記録は増えません）</p><button className="primary" disabled={disabled} onClick={()=>move('next')}>{state.cursor+1===state.answered&&state.checkpoint?'進捗画面に戻る':'次の問題へ'}</button></div>:revealed&&<div className="rating">
    <button className="danger" disabled={busy||!!pending&&pending.rating!=='again'} onClick={()=>void rate('again')}><span>難しい</span><small>{pending?.rating==='again'?'保存を再試行':'10分後にもう一度'}</small></button>
    <button className="good" disabled={busy||!!pending&&pending.rating!=='good'} onClick={()=>void rate('good')}><span>わかった</span><small>{pending?.rating==='good'?'保存を再試行':`${Math.round(schedule(card,'good',Date.now()).interval)}日後に復習`}</small></button>
   </div>}
   <button className="secondary previous-card" disabled={disabled||state.cursor===0} onClick={()=>move('previous')}>一つ前の問題に戻る</button>
   <p className="subtle" style={{textAlign:'center',marginTop:12}}>{busy||pending?'端末に保存しています…':`${state.answered} / ${state.total}枚を学習済み`}</p>
  </>}
 </div>;
}
