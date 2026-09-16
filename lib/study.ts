export type Card={id:string;deck_id:string;front:string;back:string;note:string;tags:string;due:number;interval:number;streak:number;reviews:number;lapses:number;version:number};
export type Rating='again'|'good';
export function schedule(card:Pick<Card,'interval'|'streak'|'lapses'>,rating:Rating,now:number){
  if(rating!=='again'&&rating!=='good')throw new Error('Invalid rating');
  const streak=rating==='again'?0:card.streak+1;
  const interval=rating==='again'?10/1440:streak===1?1:streak===2?3:Math.min(365,Math.max(1,Math.round(card.interval*2.2)));
  return {interval,streak,lapses:card.lapses+(rating==='again'?1:0),due:now+Math.round(interval*86400000)};
}
export function parseCsv(source:string):string[][]{
  const text=source.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
    if(c==='"'){if(value.length||closed)throw new Error('引用符の位置が正しくありません。CSVを確認してください。');quoted=true;continue;}
    if(c===','||c==='\n'||c==='\r'){row.push(value);value='';closed=false;if(c!==','){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}continue;}
    if(closed){if(c===' '||c==='\t')continue;throw new Error('引用符の後に予期しない文字があります。');}value+=c;
  }
  if(quoted)throw new Error('閉じていない引用符があります。CSVを確認してください。');
  row.push(value);if(row.some(x=>x.trim()))rows.push(row);
  if(!rows.length)throw new Error('CSVにデータがありません。');return rows;
}
export function csvCell(value:unknown){let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function jstDate(time:number){return new Date(time+9*3600000).toISOString().slice(0,10);}
