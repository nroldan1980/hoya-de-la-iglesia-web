/* ===================== VERSIÓN PROPIA: plataforma sobre Firebase =====================
   La app se escribió para claude.ai, que le da window.claude.use('db' | 'user' | 'downloads' | 'dictation' | 'tts' | 'sample').
   Aquí se ofrece lo mismo con Firebase (base de datos Firestore + usuarios con email y contraseña) y el navegador.
   La configuración del proyecto está en firebase-config.js (window.FIREBASE_CONFIG y window.PROPIETARIOS). */
(function () {
  window.__PROPIA = true;
  const SDK = window.FIREBASE_SDK || 'https://www.gstatic.com/firebasejs/10.12.2/';
  let listo; const esperar = new Promise(r => { listo = r; });
  let FB = null, app = null, db = null, auth = null, usuario = null;
  const PROP = (window.PROPIETARIOS || []).map(e => String(e).toLowerCase());
  const esProp = () => !!usuario && PROP.includes(String(usuario.email || '').toLowerCase());

  /* ---------- Pantalla de acceso ---------- */
  const css = `#acceso{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#233a2e;font-family:Inter,system-ui,sans-serif}
  #acceso form{background:#fff;border-radius:16px;padding:28px 28px 22px;width:min(380px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.35)}
  #acceso h1{margin:0 0 2px;font-size:22px;color:#233a2e}#acceso p{margin:0 0 16px;color:#5b6b62;font-size:14px}
  #acceso label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px;color:#2a3a32}
  #acceso input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #cfd8d2;border-radius:10px}
  #acceso button{width:100%;margin-top:16px;font:inherit;font-weight:700;font-size:16px;padding:12px;border:0;border-radius:10px;background:#3f6e4f;color:#fff;cursor:pointer}
  #acceso .alt{display:flex;justify-content:space-between;margin-top:12px;font-size:13px}#acceso .alt a{color:#3f6e4f;cursor:pointer}
  #acceso .err{color:#b3261e;font-size:13px;min-height:18px;margin-top:8px}`;
  function pantallaAcceso(modo = 'entrar', msg = '') {
    let el = document.getElementById('acceso'); if (!el) { el = document.createElement('div'); el.id = 'acceso'; document.body.appendChild(el); const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
    const reg = modo === 'registro';
    el.innerHTML = `<form novalidate><h1>Hoya de la Iglesia</h1><p>${reg ? 'Crea tu usuario. Después el administrador te dará acceso.' : 'Gestión de quesería · entra con tu usuario'}</p>
      ${reg ? '<label for="acN">Tu nombre</label><input id="acN" autocomplete="name" required>' : ''}
      <label for="acE">Email</label><input id="acE" type="email" autocomplete="username" required>
      <label for="acP">Contraseña</label><input id="acP" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="6" required>
      <button>${reg ? 'Crear usuario' : 'Entrar'}</button><div class="err" role="alert">${msg}</div>
      <div class="alt">${reg ? '<a data-m="entrar">Ya tengo usuario</a>' : '<a data-m="registro">Crear usuario</a><a data-m="olvido">He olvidado la contraseña</a>'}</div></form>`;
    const f = el.querySelector('form'), err = el.querySelector('.err');
    el.querySelectorAll('[data-m]').forEach(a => a.onclick = async () => {
      if (a.dataset.m === 'olvido') { const e = f.querySelector('#acE').value.trim(); if (!e) { err.textContent = 'Escribe tu email y vuelve a pulsar'; return; } try { await FB.auth.sendPasswordResetEmail(auth, e); err.style.color = '#3f6e4f'; err.textContent = 'Te hemos mandado un correo para cambiar la contraseña'; } catch (x) { err.textContent = textoError(x); } return; }
      pantallaAcceso(a.dataset.m);
    });
    f.onsubmit = async ev => { ev.preventDefault(); err.style.color = ''; err.textContent = ''; const e = f.querySelector('#acE').value.trim(), p = f.querySelector('#acP').value;
      try { if (reg) { const n = f.querySelector('#acN').value.trim(); if (!n) throw { code: 'nombre' }; const c = await FB.auth.createUserWithEmailAndPassword(auth, e, p); await FB.auth.updateProfile(c.user, { displayName: n }); }
        else await FB.auth.signInWithEmailAndPassword(auth, e, p); } catch (x) { err.textContent = textoError(x); } };
    setTimeout(() => { if (!el.contains(document.activeElement)) el.querySelector('input')?.focus(); }, 30);
  }
  const textoError = x => ({ 'auth/invalid-credential': 'Email o contraseña incorrectos', 'auth/wrong-password': 'Email o contraseña incorrectos', 'auth/user-not-found': 'Email o contraseña incorrectos', 'auth/email-already-in-use': 'Ya hay un usuario con ese email', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres', 'auth/invalid-email': 'El email no es válido', 'auth/too-many-requests': 'Demasiados intentos: espera un poco', 'auth/network-request-failed': 'Sin conexión a internet', nombre: 'Escribe tu nombre' })[x?.code] || (x?.message || 'No se pudo entrar');

  /* ---------- Arranque de Firebase ---------- */
  async function arrancar() {
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) { document.body.insertAdjacentHTML('beforeend', '<div id="acceso" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#233a2e;color:#fff;font:16px system-ui;padding:20px;text-align:center">Falta la configuración de Firebase (firebase-config.js).</div>'); return; }
    const [a, f, au] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js'), import(SDK + 'firebase-auth.js')]);
    FB = { app: a, fs: f, auth: au };
    app = a.initializeApp(window.FIREBASE_CONFIG);
    try { db = f.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) }); }
    catch (e) { db = f.initializeFirestore(app, { ignoreUndefinedProperties: true }); }
    auth = au.getAuth(app);
    au.onAuthStateChanged(auth, async u => {
      if (!u) { if (usuario) location.reload(); pantallaAcceso(); return; }
      usuario = u; document.getElementById('acceso')?.remove();
      try { await f.setDoc(f.doc(db, 'usuarios_app/' + u.uid), { name: u.displayName || u.email, email: u.email, avatarUrl: '', visto: new Date().toISOString() }, { merge: true }); } catch (e) { console.warn(e); }
      listo();
    });
  }

  /* ---------- db: lo mismo que el de claude.ai ---------- */
  const snapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
  function coleccion(path, filtros = []) {
    const q = () => { let r = FB.fs.collection(db, path); return filtros.length ? FB.fs.query(r, ...filtros.map(([a, op, v]) => FB.fs.where(a, op, v))) : r; };
    return {
      path, where: (a, op, v) => coleccion(path, [...filtros, [a, op, v]]),
      onSnapshot(next, onErr) { return FB.fs.onSnapshot(q(), { includeMetadataChanges: true }, s => next({ docChanges: () => s.docChanges().map(ch => ({ type: ch.type, doc: { id: ch.doc.id, data: () => ch.doc.data() } })), metadata: { fromCache: s.metadata.fromCache }, size: s.size, docs: s.docs.map(snapDoc) }), e => onErr && onErr(e)); },
      async get() { const s = await FB.fs.getDocs(q()); return { docs: s.docs.map(snapDoc), size: s.size, empty: s.empty }; },
      doc: id => documento(path + '/' + id)
    };
  }
  function documento(path) {
    const ref = () => FB.fs.doc(db, path);
    return {
      id: path.split('/').pop(), path,
      async get() { return snapDoc(await FB.fs.getDoc(ref())); },
      set: d => FB.fs.setDoc(ref(), d), update: d => FB.fs.updateDoc(ref(), d), delete: () => FB.fs.deleteDoc(ref()),
      onSnapshot(next) { return FB.fs.onSnapshot(ref(), s => next(snapDoc(s))); },
      /* Bloqueo cooperativo para numeraciones: se guarda en leases/ con una transacción */
      async acquire({ holder, ttlMs = 30000 }) {
        const lr = FB.fs.doc(db, 'leases/' + path.replace(/\//g, '__'));
        try { return await FB.fs.runTransaction(db, async t => { const s = await t.get(lr); const now = Date.now(); const x = s.exists() ? s.data() : null; if (x && x.exp > now && x.holder !== holder) return { acquired: false }; t.set(lr, { holder, exp: now + ttlMs }); return { acquired: true }; }); }
        catch (e) { console.warn(e); return { acquired: false }; }
      }
    };
  }
  const dbApi = { collection: p => coleccion(p), doc: p => documento(p) };

  /* ---------- user: quién es, si es propietario y los perfiles ---------- */
  async function rolDe(uid) { try { const s = await FB.fs.getDoc(FB.fs.doc(db, 'config/usuarios')); return s.exists() ? s.data()?.roles?.[uid] || null : null; } catch { return null; } }
  async function perfiles() { const s = await FB.fs.getDocs(FB.fs.collection(db, 'usuarios_app')); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
  const userApi = {
    isOwner: async () => esProp(),
    me: async () => ({ id: usuario.uid, name: usuario.displayName || usuario.email, email: usuario.email, avatarUrl: '' }),
    canEdit: async () => esProp() || ['admin', 'gerente'].includes(await rolDe(usuario.uid)),
    async search(q) { q = String(q || '').toLowerCase(); return (await perfiles()).filter(p => !q || (p.name + ' ' + p.email).toLowerCase().includes(q)).slice(0, 20); },
    async profiles(ids) { const all = await perfiles(); const out = {}; for (const id of ids) { const p = all.find(x => x.id === id); if (p) out[id] = p; } return out; },
    salir: () => FB.auth.signOut(auth),
    /* El administrador crea el usuario de un trabajador sin cerrar su propia sesión (segunda instancia de Firebase) */
    async crearUsuario({ nombre, email, password }) {
      const app2 = FB.app.getApps().find(a => a.name === 'altas') || FB.app.initializeApp(window.FIREBASE_CONFIG, 'altas');
      const auth2 = FB.auth.getAuth(app2);
      let c; try { c = await FB.auth.createUserWithEmailAndPassword(auth2, email, password); } catch (x) { throw new Error(textoError(x)); }
      await FB.auth.updateProfile(c.user, { displayName: nombre });
      try { await FB.fs.setDoc(FB.fs.doc(FB.fs.getFirestore(app2), 'usuarios_app/' + c.user.uid), { name: nombre, email, avatarUrl: '', visto: '' }); } catch (e) { console.warn(e); }
      await FB.auth.signOut(auth2);
      return { id: c.user.uid, name: nombre, email };
    }
  };

  /* ---------- downloads: descarga normal del navegador ---------- */
  const dlApi = { async save({ filename, data }) { const b = data instanceof Blob ? data : new Blob([data]); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } };

  /* ---------- dictation: reconocimiento de voz del navegador (Chrome, Edge, Android) ---------- */
  function dictado() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return null;
    let rec = null, activo = false; const cb = { p: [], f: [], s: [] };
    const estado = (state, reason) => cb.s.forEach(f => f({ state, reason }));
    return {
      onPartial: f => cb.p.push(f), onFinal: f => cb.f.push(f), onState: f => cb.s.push(f), active: () => activo,
      start({ language = 'es' } = {}) { return new Promise((res, rej) => { try { rec = new SR(); rec.lang = language === 'es' ? 'es-ES' : language; rec.continuous = true; rec.interimResults = true;
        rec.onstart = () => { activo = true; estado('listening'); res(); };
        rec.onresult = e => { let parcial = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) cb.f.forEach(f => f({ text: r[0].transcript + ' ' })); else parcial += r[0].transcript; } cb.p.forEach(f => f({ text: parcial })); };
        rec.onerror = e => { if (e.error === 'not-allowed') rej({ code: 'not_granted' }); };
        rec.onend = () => { activo = false; estado('idle', 'viewer_stopped'); };
        estado('starting'); rec.start(); } catch (e) { rej(e); } }); },
      stop() { try { rec && rec.stop(); } catch { } }
    };
  }

  /* ---------- tts: voz del navegador en castellano ---------- */
  function voz() {
    if (!('speechSynthesis' in window)) return null;
    const S = window.speechSynthesis; const cb = { l: [], s: [] }; let vozEs = null, rate = 1;
    const elegir = () => { const vs = S.getVoices(); vozEs = vs.find(v => /^es(-|_)ES/i.test(v.lang) && /google|natural|online/i.test(v.name)) || vs.find(v => /^es(-|_)ES/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null; };
    elegir(); S.onvoiceschanged = elegir;
    const estado = (state, reason) => cb.s.forEach(f => f({ state, reason }));
    let parado = false;
    return {
      onLine: f => cb.l.push(f), onState: f => cb.s.push(f), onPosition: () => { },
      setRate: r => { rate = r; }, pause: () => S.pause(), resume: () => S.resume(),
      stop() { parado = true; S.cancel(); estado('idle', 'viewer_stopped'); },
      speak(t, opts = {}) {
        const lines = Array.isArray(t) ? t : [{ text: String(t) }]; parado = false; S.cancel();
        return new Promise((res, rej) => {
          let i = 0; estado('speaking');
          const sig = () => {
            if (parado) return rej({ code: 'viewer_stopped' });
            if (i >= lines.length) { estado('idle', 'completed'); return res(); }
            const ln = lines[i]; const u = new SpeechSynthesisUtterance(ln.text); u.lang = 'es-ES'; if (vozEs) u.voice = vozEs; u.rate = ln.rate || opts.rate || rate;
            u.onstart = () => cb.l.forEach(f => f({ line: i, id: ln.id }));
            u.onend = () => { i++; sig(); }; u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; i++; sig(); };
            S.speak(u);
          };
          sig();
        });
      }
    };
  }

  /* ---------- window.claude.use: la misma puerta que usa la app ---------- */
  const cache = {};
  window.claude = {
    use(name) {
      if (cache[name]) return cache[name];
      const mk = { db: () => dbApi, user: () => userApi, downloads: () => dlApi, dictation: () => dictado(), tts: () => voz() }[name];
      return (cache[name] = mk ? esperar.then(mk) : Promise.resolve(null));
    }
  };
  window.salirApp = () => auth && FB.auth.signOut(auth);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { }));
  /* Aviso de versión nueva: al volver a la app y cada 5 minutos mira si se ha publicado un cambio */
  const miVersion = document.querySelector('meta[name=app-version]')?.content;
  async function hayVersionNueva() {
    if (!miVersion || document.getElementById('avisoVersion')) return;
    try {
      const t = await fetch('index.html?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '');
      const v = (t.match(/name="app-version" content="([^"]+)"/) || [])[1];
      if (v && v !== miVersion) {
        navigator.serviceWorker?.getRegistration?.().then(r => r && r.update()).catch(() => { });
        const d = document.createElement('div'); d.id = 'avisoVersion';
        d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#233a2e;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 6px 24px #0005;display:flex;gap:12px;align-items:center;font:600 15px system-ui;max-width:92vw';
        d.innerHTML = '<span>Hay una versión nueva de la app</span><button type="button" style="background:#fff;color:#233a2e;border:0;border-radius:10px;padding:8px 14px;font:700 15px system-ui;cursor:pointer">Actualizar</button>';
        d.querySelector('button').onclick = () => location.reload();
        document.body.appendChild(d);
      }
    } catch { }
  }
  if (location.protocol === 'https:') { setTimeout(hayVersionNueva, 4000); setInterval(hayVersionNueva, 5 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') hayVersionNueva(); }); }
})();
