/* GTMC responsive blue sidebar drawer for mobile */
(function(){
 function setup(){
  const app=document.getElementById('appView'),top=app&&app.querySelector('.topbar'),side=document.getElementById('sidebar');
  if(!app||!top||!side||top.querySelector('.gtmc-mobile-menu-btn'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='gtmc-mobile-menu-btn';btn.setAttribute('aria-label','Open navigation menu');btn.setAttribute('aria-expanded','false');btn.innerHTML='☰';
  const backdrop=document.createElement('div');backdrop.className='gtmc-sidebar-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.appendChild(backdrop);
  top.insertBefore(btn,top.firstChild);
  function close(){side.classList.remove('gtmc-drawer-open');backdrop.classList.remove('gtmc-visible');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Open navigation menu');btn.innerHTML='☰'}
  function open(){side.classList.add('gtmc-drawer-open');backdrop.classList.add('gtmc-visible');btn.setAttribute('aria-expanded','true');btn.setAttribute('aria-label','Close navigation menu');btn.innerHTML='×'}
  btn.addEventListener('click',()=>side.classList.contains('gtmc-drawer-open')?close():open());
  backdrop.addEventListener('click',close);
  side.addEventListener('click',e=>{if(e.target.closest('.nav-item'))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  window.addEventListener('resize',()=>{if(window.innerWidth>900)close()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
