// Apply a saved theme choice before first paint (no flash). Without one, the system setting applies.
(function(){ try{ var t=localStorage.getItem('ch57x-theme'); if(t==='light'||t==='dark') document.documentElement.setAttribute('data-theme',t); }catch(e){} })();
