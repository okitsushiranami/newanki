export type PlayState = {cursor:number; answered:number; total:number; size:number; checkpoint:'break'|'done'|null; screen:'cards'|'break'|'done'};
export function createPlayState(total:number,size=20):PlayState {
 return {cursor:0,answered:0,total,size:Number.isInteger(size)&&size>0?size:20,checkpoint:total?null:'done',screen:total?'cards':'done'};
}
export function advancePlay(state:PlayState,action:'answer'|'previous'|'next'|'continue'):PlayState {
 if(action==='previous'){
  const cursor=state.screen==='cards'?state.cursor-1:state.answered-1;
  return cursor>=0?{...state,cursor,screen:'cards'}:state;
 }
 if(action==='continue')return state.screen==='break'?{...state,cursor:state.answered,checkpoint:null,screen:'cards'}:state;
 if(action==='next'){
  if(state.screen!=='cards'||state.cursor>=state.answered)return state;
  const cursor=state.cursor+1;
  return {...state,cursor,screen:cursor===state.answered?(state.checkpoint||'cards'):'cards'};
 }
 if(state.screen!=='cards'||state.cursor!==state.answered||state.answered>=state.total)return state;
 const answered=state.answered+1;
 const checkpoint=answered===state.total?'done':answered%state.size===0?'break':null;
 return {...state,answered,cursor:answered,checkpoint,screen:checkpoint||'cards'};
}
