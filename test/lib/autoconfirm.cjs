// Answers the page's confirmation dialog (#confirmDlg, opened by askConfirm) automatically, the way the
// suites used to stub window.confirm. The answer lands a microtask later, so `await tick()` after the click.
// st.answer: true = OK, false = Cancel. st.asked: the messages shown; st.last: the latest one.
module.exports=function autoConfirm(w,answer=true){
  const d=w.document, dlg=d.getElementById('confirmDlg');
  const st={answer,asked:[],get last(){ return st.asked[st.asked.length-1]||''; },
    tick:()=>new Promise(r=>setTimeout(r,0))};
  new w.MutationObserver(()=>{
    if(dlg.hidden) return;
    st.asked.push(d.getElementById('confirmMsg').textContent);
    d.getElementById(st.answer?'confirmOk':'confirmCancel').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  }).observe(dlg,{attributes:true,attributeFilter:['hidden']});
  return st;
};
