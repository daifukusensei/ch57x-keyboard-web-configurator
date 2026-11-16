// Runs first, in <head>. Storage keys were renamed from ch57x-editor-v1 / ch57x-editor-notes / ch57x-theme on 2026-11-15:
// copy any old value across once (old keys are kept, so an older copy of the page still works).
(function(){ try{ var m={'ch57x-editor-v1':'ch57x-configurator-v1','ch57x-editor-notes':'ch57x-configurator-notes','ch57x-theme':'ch57x-configurator-theme'};
  for(var k in m){ var v=localStorage.getItem(k); if(v!==null && localStorage.getItem(m[k])===null) localStorage.setItem(m[k],v); } }catch(e){} })();
// Apply a saved theme choice before first paint (no flash). Without one, the system setting applies.
(function(){ try{ var t=localStorage.getItem('ch57x-configurator-theme'); if(t==='light'||t==='dark') document.documentElement.setAttribute('data-theme',t); }catch(e){} })();
