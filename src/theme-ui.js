(function(){
  var root=document.documentElement, btn=document.getElementById('themeToggle');
  var mq=window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function effective(){ var t=root.getAttribute('data-theme'); return t || (mq && mq.matches ? 'dark' : 'light'); }
  function paint(){
    var dark=effective()==='dark';
    btn.textContent = dark ? '☀ Light' : '☾ Dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  btn.addEventListener('click',function(){
    var next=effective()==='dark' ? 'light' : 'dark';
    root.setAttribute('data-theme',next);
    try{ localStorage.setItem('ch57x-theme',next); }catch(e){}
    paint();
  });
  if(mq){ if(mq.addEventListener) mq.addEventListener('change',paint); else if(mq.addListener) mq.addListener(paint); }
  paint();
})();
