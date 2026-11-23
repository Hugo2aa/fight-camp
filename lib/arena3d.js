// Fight Night en 3D : vestiaire -> couloir -> allée -> cage, puis l'annonce dans la cage, le face-à-face avec l'adversaire.
import * as THREE from "./three.module.min.js";

const smooth = t => t*t*(3-2*t);
const clamp = (x, a=0, b=1) => Math.min(b, Math.max(a, x));
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
function rnd(seed){ let s = seed >>> 0; return () => ((s = (s*1664525 + 1013904223) >>> 0) / 4294967296); }
function tex(w, h, draw){ const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function merge(list){
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  const n = parts.reduce((a,g)=>a + g.attributes.position.count, 0), pos = new Float32Array(n*3), nor = new Float32Array(n*3); let o = 0;
  parts.forEach(g=>{ pos.set(g.attributes.position.array, o*3); nor.set(g.attributes.normal.array, o*3); o += g.attributes.position.count; });
  const m = new THREE.BufferGeometry(); m.setAttribute("position", new THREE.BufferAttribute(pos, 3)); m.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); return m;
}
const V = (x,y) => new THREE.Vector2(x,y);
function torsoGeo(scale=1, flat=.62, seg=14){
  const P = (seg < 10 ? [V(0,.9),V(.16,.92),V(.16,1.1),V(.2,1.32),V(.17,1.45),V(.07,1.51),V(0,1.52)]
    : [V(0,.88),V(.15,.89),V(.172,.95),V(.16,1.03),V(.15,1.1),V(.162,1.18),V(.185,1.27),V(.205,1.35),V(.205,1.41),V(.18,1.46),V(.12,1.5),V(.065,1.525),V(0,1.53)]).map(p=>V(p.x*scale, p.y));
  const g = new THREE.LatheGeometry(P, seg); g.scale(1, 1, flat); g.computeVertexNormals(); return g; }
function limbGeo(r1, r2, len, seg=10){ const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1); g.translate(0, -len/2, 0); return g; }
const sph = (r, x, y, z, sx=1, sy=1, sz=1, ws=14, hs=10) => { const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const lsph = (r, x, y, z, sx=1, sy=1, sz=1) => sph(r, x, y, z, sx, sy, sz, 7, 5);
function at(g, x, y, z, rx=0, ry=0, rz=0){ const h = g.clone(); h.rotateX(rx); h.rotateY(ry); h.rotateZ(rz); h.translate(x, y, z); return h; }

// Public en basse définition (des milliers de personnes) : vêtements, peau, cheveux
function crowdGeos(kind){
  const clothes = [torsoGeo(1, .62, 7), at(limbGeo(.11, .1, .55, 5), .09, .9, 0), at(limbGeo(.11, .1, .55, 5), -.09, .9, 0)];
  const skin = [lsph(.102, 0, 1.66, .01, .95, 1.12, 1.04), lsph(.06, 0, 1.6, .035, 1, .8, 1)], hair = [lsph(.108, 0, 1.71, -.012, .98, .72, 1.06)];
  const arm = (side, up) => {
    if (up){ clothes.push(at(limbGeo(.055, .046, .3, 5), side*.21, 1.43, 0, 0, 0, side*2.6)); clothes.push(at(limbGeo(.046, .038, .27, 5), side*.365, 1.687, 0, 0, 0, side*2.95)); skin.push(lsph(.045, side*.41, 1.95, 0)); }
    else { clothes.push(at(limbGeo(.055, .046, .3, 5), side*.21, 1.43, 0, 0, 0, side*.1)); clothes.push(at(limbGeo(.046, .038, .27, 5), side*.24, 1.13, .01, -.35, 0, side*.05)); skin.push(lsph(.042, side*.25, .88, .1)); } };
  if (kind === 0){ arm(-1, false); arm(1, false); } else if (kind === 1){ arm(-1, true); arm(1, true); } else { arm(-1, false); arm(1, true); }
  return [merge(clothes), merge(skin), merge(hair)];
}

// Corps humain « loft » : chaque partie est une surface continue passant par des sections anatomiques (ellipses),
// comme un sculpteur : bassin, taille, thorax, épaules, deltoïdes, biceps, avant-bras, cuisses, mollets…
function loft(secs, seg=20, pw=2, axis="y"){
  const pos = [], idx = [], n = secs.length;
  secs.forEach(([y, rx, rz, cz=0, cx=0])=>{ for (let j=0;j<=seg;j++){ const a = j/seg*Math.PI*2, c = Math.cos(a), s = Math.sin(a);
    const ce = Math.sign(c)*Math.pow(Math.abs(c), 2/pw), se = Math.sign(s)*Math.pow(Math.abs(s), 2/pw);
    pos.push(cx + rx*ce, y, cz + rz*se); } });
  for (let i=0;i<n-1;i++) for (let j=0;j<seg;j++){ const a = i*(seg+1) + j, b = a + seg + 1; idx.push(a, a+1, b, a+1, b+1, b); }
  // bouchons
  const top = pos.length/3; pos.push(secs[0][4]||0, secs[0][0], secs[0][3]||0); for (let j=0;j<seg;j++) idx.push(top, j+1, j);
  const bot = pos.length/3, L = secs[n-1]; pos.push(L[4]||0, L[0], L[3]||0); const o = (n-1)*(seg+1); for (let j=0;j<seg;j++) idx.push(bot, o+j, o+j+1);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  // normales lissées à la couture
  g.computeVertexNormals(); const nr = g.attributes.normal;
  for (let i=0;i<n;i++){ const a = i*(seg+1), b = a + seg; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x,y,z) || 1; nr.setXYZ(a, x/l, y/l, z/l); nr.setXYZ(b, x/l, y/l, z/l); }
  return g;
}
const skinMat = (c, sweat) => new THREE.MeshPhysicalMaterial({color:c, roughness: sweat ? .42 : .58, sheen:.4, sheenRoughness:.6, sheenColor:new THREE.Color(0xffd0b0), clearcoat: sweat ? .25 : 0, clearcoatRoughness:.5});
function makeHuman(opt){
  const skinM = skinMat(opt.skin || 0x8a5a44, opt.topless);
  const topM = new THREE.MeshStandardMaterial({color: opt.top ?? 0x111111, roughness:.78});
  const botM = new THREE.MeshStandardMaterial({color: opt.bottom ?? 0x111111, roughness:.8});
  const shoeM = new THREE.MeshStandardMaterial({color: opt.shoes ?? 0x0a0a0a, roughness:.35});
  const g = new THREE.Group(), suit = !!opt.suit, bare = !suit && opt.topless, B = opt.build || 1.05, M = bare ? 1.06 : 1;
  const mesh = (geo, m, x=0, y=0, z=0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); return k; };
  // Tronc : bassin → taille → cage thoracique → pectoraux → épaules → trapèzes
  const tw = B, sec = (y, rx, rz, cz=0) => [y, rx*tw, rz, cz];
  const torso = [sec(.84,.13,.1,-.005), sec(.9,.162,.112,-.012), sec(.97,.168,.108,-.008), sec(1.04,.152,.098,0), sec(1.11,.148*M,.1,.006), sec(1.19,.162*M,.112,.012),
    sec(1.27,.182*M,.124,.016), sec(1.34,.198*M,.128,.014), sec(1.4,.205*M,.12,.004), sec(1.45,.19*M,.1,-.008), sec(1.5,.13,.078,-.02), sec(1.545,.07,.06,-.01)].reverse();
  g.add(mesh(loft(torso, 26, 2.3), bare ? skinM : topM));
  if (bare){ // reliefs : pectoraux, abdos, obliques, dentelés
    g.add(mesh(merge([sph(.085, .075, 1.325, .094, 1.08, .62, .42), sph(.085, -.075, 1.325, .094, 1.08, .62, .42),
      ...[0,1,2].flatMap(i=>[sph(.032, .034, 1.205 - i*.068, .099, 1.05, .82, .32), sph(.032, -.034, 1.205 - i*.068, .099, 1.05, .82, .32)]),
      sph(.05, .128, 1.04, .06, .8, 1.7, .5), sph(.05, -.128, 1.04, .06, .8, 1.7, .5)]), skinM)); }
  if (suit){ const lap = new THREE.MeshStandardMaterial({color:0x050505, roughness:.35});
    const shirt = mesh(new THREE.PlaneGeometry(.11, .28), new THREE.MeshStandardMaterial({color:0xf2f2f2}), 0, 1.38, .135); g.add(shirt);
    const tie = mesh(merge([new THREE.BoxGeometry(.042, .22, .012), at(new THREE.BoxGeometry(.03, .03, .012), 0, .11, 0, 0, 0, .785)]), new THREE.MeshStandardMaterial({color:opt.tie ?? 0x7a0d12, roughness:.35}), 0, 1.37, .145); g.add(tie);
    [-1,1].forEach(s=>{ const l = mesh(new THREE.BoxGeometry(.05, .27, .01), lap, s*.068, 1.37, .138); l.rotation.z = s*.32; g.add(l); }); }
  // Cou et tête (crâne, mâchoire, oreilles — sans visage)
  g.add(mesh(loft([[1.69,.05,.052,.005],[1.62,.056,.058,0],[1.55,.068,.064,-.01]], 16), skinM));
  const head = new THREE.Group(); head.position.y = 1.62; g.add(head);
  head.add(mesh(merge([sph(.094, 0, .145, -.012, 1, 1.18, 1.1, 22, 16), loft([[.16,.085,.09,.012],[.1,.08,.088,.018],[.05,.064,.075,.022],[.015,.035,.045,.03]], 18),
    sph(.02, .09, .12, -.01, .45, 1.05, .8), sph(.02, -.09, .12, -.01, .45, 1.05, .8)]), skinM));
  if (opt.hair) head.add(mesh(sph(.1, 0, .18, -.02, 1.01, .86, 1.12, 22, 14), new THREE.MeshStandardMaterial({color:opt.hair, roughness:.95})));
  if (opt.beard) head.add(mesh(loft([[.09,.084,.088,.02],[.05,.07,.08,.026],[.01,.038,.05,.034]], 16), new THREE.MeshStandardMaterial({color:opt.beard, roughness:1})));
  const parts = {g, head, neck: head};
  ["L","R"].forEach((k, i)=>{ const s = i ? -1 : 1, am = bare ? skinM : topM;
    const sh = new THREE.Group(); sh.position.set(s*.2*B, 1.425, -.005); g.add(sh);
    // deltoïde + bras (biceps/triceps)
    sh.add(mesh(sph(.078*M, s*.012, -.012, 0, 1.08, 1.05, 1), am));
    sh.add(mesh(loft([[0,.07*M,.072*M],[-.06,.064*M,.07*M,.006],[-.13,.054*M,.062*M,.012],[-.2,.046*M,.052*M,.006],[-.27,.04,.044],[-.31,.037,.04]], 18), am));
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    el.add(mesh(sph(.039, 0, 0, 0), am));
    el.add(mesh(loft([[0,.041,.043],[-.05,.047*M,.049*M,.004],[-.11,.043*M,.042*M],[-.19,.034,.03],[-.26,.028,.022]], 16), suit || (!bare && opt.sleeves !== false) ? am : skinM));
    if (suit) el.add(mesh(loft([[-.235,.031,.026],[-.26,.031,.026]], 14), new THREE.MeshStandardMaterial({color:0xf2f2f2})));
    const hand = new THREE.Group(); hand.position.y = -.265; el.add(hand);
    if (opt.gloves){ const gm = new THREE.MeshStandardMaterial({color:opt.gloves, roughness:.3, metalness:.05});
      hand.add(mesh(merge([loft([[0,.052,.05],[-.03,.068,.07],[-.08,.072,.078,.01],[-.13,.058,.066,.012],[-.155,.03,.035,.01]], 18), sph(.03, s*.058, -.05, .03, .8, 1.5, .9)]), gm));
      hand.add(mesh(loft([[.005,.05,.048],[-.035,.052,.05]], 16), new THREE.MeshStandardMaterial({color:0xeeeeee, roughness:.6}))); }
    else { const hm = opt.handM === "latex" ? new THREE.MeshStandardMaterial({color:0x2a5fd0, roughness:.4}) : skinM;
      const fingers = [0,1,2,3].map(f=>at(limbGeo(.0095, .008, .075, 6), 0, -.088, -.024 + f*.016, .15, 0, 0));
      hand.add(mesh(merge([loft([[0,.018,.03],[-.04,.019,.04],[-.09,.017,.037]], 12), ...fingers, at(limbGeo(.011, .009, .06, 6), 0, -.03, .036, -.6, 0, 0)]), hm)); }
    // jambes : fessier, quadriceps, genou, mollet, cheville, pied
    const hip = new THREE.Group(); hip.position.set(s*.092, .9, 0); g.add(hip);
    const lm = opt.shorts ? skinM : botM;
    hip.add(mesh(loft([[.04,.09,.1,-.01],[0,.094,.1,-.004],[-.1,.088,.092,.008],[-.22,.075,.078,.008],[-.34,.062,.064,.004],[-.44,.052,.056]], 18), lm));
    if (opt.shorts){ const shm = new THREE.MeshStandardMaterial({color:opt.shorts, roughness:.5});
      hip.add(mesh(loft([[.06,.112,.12,-.01],[0,.113,.118],[-.12,.108,.11,.006],[-.22,.104,.104,.006]], 18), shm));
      hip.add(mesh(loft([[-.205,.106,.106,.006],[-.23,.106,.106,.006]], 18), new THREE.MeshStandardMaterial({color:0xeeeeee, roughness:.5}))); }
    const kn = new THREE.Group(); kn.position.y = -.44; hip.add(kn);
    kn.add(mesh(sph(.05, 0, 0, .008), lm));
    kn.add(mesh(loft([[0,.052,.054],[-.08,.056,.066,-.016],[-.16,.05,.058,-.014],[-.28,.036,.04,-.004],[-.4,.028,.032],[-.43,.03,.036]], 18), lm));
    const ft = mesh(loft([[-.07,.03,.022],[-.02,.04,.03],[.06,.045,.026],[.14,.038,.017],[.17,.02,.01]].map(([z, rx, ry])=>[z, rx, ry]), 14), opt.barefoot ? skinM : shoeM, 0, -.455, 0);
    ft.geometry.rotateX(Math.PI/2); ft.geometry.computeVertexNormals(); ft.position.set(0, -.455, .02); kn.add(ft);
    parts["sh"+k] = sh; parts["el"+k] = el; parts["hip"+k] = hip; parts["kn"+k] = kn; parts["hand"+k] = hand; });
  if (opt.shorts){ const shm = new THREE.MeshStandardMaterial({color:opt.shorts, roughness:.5});
    g.add(mesh(loft([[1.0,.172*B,.112,.004],[.93,.178*B,.12,-.01],[.84,.17*B,.118,-.01]], 22), shm));
    g.add(mesh(loft([[1.02,.166*B,.108,.004],[.99,.168*B,.11,.004]], 22), new THREE.MeshStandardMaterial({color:0x111111, roughness:.45}))); }
  else { g.add(mesh(loft([[.99,.17*B,.112],[.9,.176*B,.118,-.01],[.84,.165*B,.115,-.01]], 22), suit ? botM : botM)); }
  g.traverse(x=>{ if (x.isMesh) x.frustumCulled = true; });
  return parts;
}
function guardPose(p){ p.shL.rotation.set(-.55, 0, .22); p.elL.rotation.set(-2.1, 0, 0); p.shR.rotation.set(-.45, 0, -.25); p.elR.rotation.set(-2.2, 0, 0);
  p.hipL.rotation.x = -.12; p.knL.rotation.x = .2; p.hipR.rotation.x = .1; p.knR.rotation.x = .18; }

export function startArena(canvas, o = {}){
  const D = o.duration || 30, r = rnd(11);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:"high-performance"});
  const mobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent), maxPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.4);
  let pr = Math.min(maxPR, mobile ? 1 : 1.25); renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040203); scene.fog = new THREE.FogExp2(0x0a0508, .017);
  const cam = new THREE.PerspectiveCamera(64, 1, .05, 400); scene.add(cam);
  const size = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); }; size();
  const uTime = {value:0}, uLvl = {value:.5}, std = (c, ro=.8, me=0) => ro >= .7 && !me ? new THREE.MeshLambertMaterial({color:c}) : new THREE.MeshStandardMaterial({color:c, roughness:ro, metalness:me});
  const add = (geo, mat, x, y, z, ry=0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const dot = tex(64, 64, (g,w)=>{ const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.25,"rgba(255,250,235,.7)"); gr.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0,0,w,w); });
  const glowMat = c => new THREE.SpriteMaterial({map:dot, color:c, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false});

  scene.add(new THREE.HemisphereLight(0x4a3035, 0x060304, .55));
  const cageSpot = new THREE.SpotLight(0xffffff, 320, 60, .55, .5, 1.4); cageSpot.position.set(0, 26, 0); cageSpot.target.position.set(0, 0, 0); scene.add(cageSpot, cageSpot.target);
  const camLight = new THREE.PointLight(0xffe2c8, 70, 16, 1.4); scene.add(camLight);
  const redL = new THREE.PointLight(0xd7262e, 260, 70, 1.6); redL.position.set(-18, 14, 30); scene.add(redL);
  const redR = new THREE.PointLight(0xd7262e, 260, 70, 1.6); redR.position.set(18, 14, 30); scene.add(redR);
  const blue = new THREE.PointLight(0x3a6dff, 140, 80, 1.6); blue.position.set(0, 18, -24); scene.add(blue);

  // Vestiaire
  const tile = tex(256, 256, (g,w)=>{ g.fillStyle = "#2a2c2e"; g.fillRect(0,0,w,w); g.strokeStyle = "#1a1b1c"; g.lineWidth = 4; for (let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*w/4,0); g.lineTo(i*w/4,w); g.moveTo(0,i*w/4); g.lineTo(w,i*w/4); g.stroke(); } });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(4, 2);
  const wallM = new THREE.MeshStandardMaterial({map:tile, roughness:.6});
  add(new THREE.BoxGeometry(8, .2, 10), std(0x1c1d1f, .5, .1), 0, -.1, 91); add(new THREE.BoxGeometry(8, .2, 10), std(0x141414), 0, 3.3, 91);
  add(new THREE.BoxGeometry(.2, 3.4, 10), wallM, -4, 1.6, 91); add(new THREE.BoxGeometry(.2, 3.4, 10), wallM, 4, 1.6, 91); add(new THREE.BoxGeometry(8, 3.4, .2), wallM, 0, 1.6, 96);
  [-2.65, 2.65].forEach(x=>add(new THREE.BoxGeometry(3.4, 3.4, .2), wallM, x, 1.6, 86)); add(new THREE.BoxGeometry(1.9, 1, .2), wallM, 0, 2.9, 86);
  const lockerT = tex(128, 512, (g,w,h)=>{ g.fillStyle = "#3b4048"; g.fillRect(0,0,w,h); g.fillStyle = "#2a2e34"; for (let i=0;i<8;i++) g.fillRect(30, 40 + i*12, 68, 5); g.fillStyle = "#9aa0a6"; g.fillRect(100, 240, 8, 40); g.strokeStyle = "#1c1f23"; g.lineWidth = 6; g.strokeRect(3,3,w-6,h-6); });
  const lockerM = new THREE.MeshStandardMaterial({map:lockerT, roughness:.45, metalness:.5});
  for (let i=0;i<8;i++){ add(new THREE.BoxGeometry(.6, 2.1, .55), lockerM, -3.6, 1.05, 87.6 + i*.95, Math.PI/2); add(new THREE.BoxGeometry(.6, 2.1, .55), lockerM, 3.6, 1.05, 87.6 + i*.95, -Math.PI/2); }
  add(new THREE.BoxGeometry(.5, .45, 6), std(0x3a2618, .6), -2.6, .25, 91); add(new THREE.BoxGeometry(.5, .45, 6), std(0x3a2618, .6), 2.6, .25, 91);
  const doorSign = tex(512, 160, (g,w,h)=>{ g.fillStyle = "#0d0d0d"; g.fillRect(0,0,w,h); g.fillStyle = "#d9a43a"; g.font = "bold 34px Arial"; g.textAlign = "center"; g.fillText("VESTIAIRE · COIN " + (o.corner || "BLEU").toUpperCase(), w/2, 52); g.fillStyle = "#fff"; g.font = "bold 70px Impact, Anton, sans-serif"; g.fillText((o.name || "").toUpperCase(), w/2, 128); });
  add(new THREE.PlaneGeometry(2.4, .75), new THREE.MeshBasicMaterial({map:doorSign, toneMapped:false}), 0, 2.85, 86.12, Math.PI);
  for (let i=0;i<3;i++) add(new THREE.BoxGeometry(.25, .06, 2.2), new THREE.MeshBasicMaterial({color:0xe8f1ff}), 0, 3.18, 88 + i*3);
  const coach = makeHuman({skin:0x6b4a3a, top:0x141414, bottom:0x1a1a1a, hair:0x111111, beard:0x111111, build:1.1}); coach.g.position.set(1.6, 0, 89.2); coach.g.rotation.y = -2.3; coach.shL.rotation.set(-.3, 0, .1); coach.elL.rotation.x = -1.2; scene.add(coach.g);

  // Couloir
  const concrete = tex(256, 256, (g,w)=>{ g.fillStyle = "#1d1b1c"; g.fillRect(0,0,w,w); for (let i=0;i<2500;i++){ const v = 20 + Math.random()*25; g.fillStyle = `rgb(${v},${v-2},${v-1})`; g.fillRect(Math.random()*w, Math.random()*w, 2, 2); } g.fillStyle = "rgba(120,10,15,.6)"; g.fillRect(0, 150, w, 14); });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(8, 1);
  const tunM = new THREE.MeshStandardMaterial({map:concrete, roughness:.9});
  add(new THREE.BoxGeometry(.3, 3.6, 24), tunM, -2.1, 1.8, 74); add(new THREE.BoxGeometry(.3, 3.6, 24), tunM, 2.1, 1.8, 74);
  add(new THREE.BoxGeometry(4.5, .3, 24), std(0x0c0b0b), 0, 3.6, 74); add(new THREE.BoxGeometry(4.2, .1, 24), std(0x141213, .4, .2), 0, -.04, 74);
  for (let i=0;i<8;i++) add(new THREE.BoxGeometry(1.4, .05, .3), new THREE.MeshBasicMaterial({color:0xffe6cc}), 0, 3.42, 64 + i*3);
  [-21.6, 21.6].forEach(x=>add(new THREE.BoxGeometry(39, 16, .4), std(0x0b0708, .9), x, 8, 62)); add(new THREE.BoxGeometry(4.2, 12.4, .4), std(0x0b0708, .9), 0, 9.8, 62);
  const exitSign = tex(512, 128, (g,w,h)=>{ g.fillStyle = "#0a0a0a"; g.fillRect(0,0,w,h); g.fillStyle = "#d7262e"; g.font = "bold 76px Impact, Anton, sans-serif"; g.textAlign = "center"; g.fillText("FIGHT NIGHT", w/2, 92); });
  add(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({map:exitSign, toneMapped:false}), 0, 4.4, 61.78, 0);

  // Salle
  add(new THREE.PlaneGeometry(260, 260), std(0x0b0809, .85), 0, 0, 0).rotation.x = -Math.PI/2;
  const aisle = add(new THREE.PlaneGeometry(3.2, 54), std(0x151012, .55, .05), 0, .012, 35); aisle.rotation.x = -Math.PI/2;
  const ledMat = new THREE.MeshBasicMaterial({color:0xff2a32, toneMapped:false});
  [-1.62, 1.62].forEach(x=>add(new THREE.BoxGeometry(.06, .04, 54), ledMat, x, .03, 35));
  [-2.3, 2.3].forEach(x=>{ add(new THREE.BoxGeometry(.18, 1.05, 46), std(0x0e0a0b, .6), x, .52, 35); add(new THREE.BoxGeometry(.2, .03, 46), ledMat, x, 1.06, 35); });
  const standM = std(0x0d090a, .9);
  for (let side of [-1,1]){ const w = 13*.82, h = 13*.42, slope = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w, h), .3, 48), standM); slope.position.set(side*(3.1 + w/2), h/2 - .25, 34.5); slope.rotation.z = side*Math.atan2(h, w); scene.add(slope);
    add(new THREE.BoxGeometry(.4, h + 3, 48), standM, side*(3.5 + w), (h + 3)/2, 34.5); }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(40.5, 15.2, 11, 64, 1, true), new THREE.MeshLambertMaterial({color:0x0d090a, side:THREE.DoubleSide})); bowl.position.y = 5.2; scene.add(bowl);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 24, 64, 1, true), new THREE.MeshLambertMaterial({color:0x080506, side:THREE.BackSide})); outer.position.y = 12; scene.add(outer);
  // Bandeaux LED autour du public
  const ledRingM = new THREE.MeshBasicMaterial({color:0xff2a32, toneMapped:false});
  [[15.3, .25], [41.6, 11.4]].forEach(([R, y])=>{ const t = new THREE.Mesh(new THREE.TorusGeometry(R, y > 1 ? .18 : .06, 4, 96), ledRingM); t.rotation.x = Math.PI/2; t.position.y = y; scene.add(t); });
  [[-1.95, 52],[1.95, 44],[-1.95, 34],[1.95, 24],[-1.95, 16],[1.95, 70],[-1.6, 78]].forEach(([x,z])=>{ const p = makeHuman({skin:0x5a3c2e, top:0x0a0a0a, bottom:0x0a0a0a, hair:0x0a0a0a, build:1.14}); p.g.position.set(x, 0, z); p.g.rotation.y = x < 0 ? Math.PI/2 : -Math.PI/2; p.shL.rotation.z = .12; p.shR.rotation.z = -.12; p.elL.rotation.x = -.5; p.elR.rotation.x = -.5; scene.add(p.g); });

  // Public
  const spots = [];
  for (let side of [-1, 1]) for (let row=0; row<13; row++) for (let z=11; z<58; z+=.82) spots.push([side*(3.1 + row*.82) + (r()-.5)*.22, row*.42, z + (r()-.5)*.28, 0]);
  for (let ring=0; ring<18; ring++){ const R = 15.6 + ring*1.25, n = Math.floor(2*Math.PI*R/.92);
    for (let i=0;i<n;i++){ const a = i/n*Math.PI*2, x = Math.sin(a)*R, z = Math.cos(a)*R; if (z > 10 && Math.abs(x) < 14) continue; spots.push([x + (r()-.5)*.2, ring*.55, z + (r()-.5)*.2, 1]); } }
  const groups = [[],[],[]]; spots.forEach(s=>{ const k = r(); groups[k < .55 ? 0 : k < .82 ? 1 : 2].push(s); });
  function crowdMat(){ const m = new THREE.MeshLambertMaterial({color:0xffffff});
    m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.uniforms.uLvl = uLvl;
      sh.vertexShader = "attribute float aPhase; attribute float aEnergy; uniform float uTime; uniform float uLvl;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n float j = max(0.0, sin(uTime*6.5 + aPhase)) * (0.12 + 0.22*uLvl) * aEnergy + sin(uTime*1.8 + aPhase)*0.03; transformed.y += j; transformed.x += sin(uTime*1.2 + aPhase)*0.04;"); };
    return m; }
  const cMat = crowdMat(), sMat = crowdMat(), hMat = crowdMat(), dummy = new THREE.Object3D(), col = new THREE.Color();
  const SHIRTS = [[.03,.03,.035],[.05,.05,.06],[.02,.02,.02],[.35,.03,.04],[.6,.6,.62],[.06,.08,.16],[.12,.1,.08],[.2,.2,.22],[.45,.05,.06]];
  const HAIRS = [[.02,.015,.01],[.05,.03,.02],[.12,.08,.04],[.3,.22,.12],[.01,.01,.01],[.18,.17,.16]];
  groups.forEach((list, k)=>{ if (!list.length) return; const [cg, sg, hg] = crowdGeos(k), N = list.length;
    const ph = new Float32Array(N), en = new Float32Array(N); for (let i=0;i<N;i++){ ph[i] = r()*6.28; en[i] = k ? .8 + r()*.4 : (r() < .3 ? 1 : r()*.35); }
    const cm = new THREE.InstancedMesh(cg, cMat, N), sm = new THREE.InstancedMesh(sg, sMat, N), hm = new THREE.InstancedMesh(hg, hMat, N);
    list.forEach(([x,y,z,b], i)=>{ dummy.position.set(x, y, z); if (b) dummy.lookAt(0, y, 0); else dummy.lookAt(0, y, z); dummy.rotateY((r()-.5)*.5); dummy.scale.setScalar(.9 + r()*.18); dummy.updateMatrix();
      cm.setMatrixAt(i, dummy.matrix); sm.setMatrixAt(i, dummy.matrix); hm.setMatrixAt(i, dummy.matrix);
      const s = SHIRTS[Math.floor(r()*SHIRTS.length)]; col.setRGB(s[0]*(.8+r()*.4), s[1]*(.8+r()*.4), s[2]*(.8+r()*.4)); cm.setColorAt(i, col);
      const t = .1 + r()*.45; col.setRGB(t*1.25, t*.92, t*.75); sm.setColorAt(i, col);
      const hh = HAIRS[Math.floor(r()*HAIRS.length)]; col.setRGB(hh[0], hh[1], hh[2]); hm.setColorAt(i, col); });
    [cm, sm, hm].forEach(m=>{ m.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1)); m.geometry.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(en, 1)); scene.add(m); }); });
  const PH = 800, php = new Float32Array(PH*3); for (let i=0;i<PH;i++){ const s = spots[Math.floor(r()*spots.length)]; php.set([s[0], s[1] + 1.95, s[2]], i*3); }
  const phG = new THREE.BufferGeometry(); phG.setAttribute("position", new THREE.BufferAttribute(php, 3));
  const phM = new THREE.PointsMaterial({size:.5, map:dot, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:0xfff6e8}); scene.add(new THREE.Points(phG, phM));

  // Lumières de show : grands faisceaux, lyres sur le grill, lasers, halos
  const beamMat = (c, a=.15) => new THREE.ShaderMaterial({transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, uniforms:{c:{value:new THREE.Color(c)}, k:{value:1}},
    vertexShader:"varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:`uniform vec3 c; uniform float k; varying float vY; void main(){ gl_FragColor = vec4(c, pow(vY, 2.2)*${a.toFixed(3)}*k); }`});
  const beams = [];
  [[-12, 0xffffff], [-6, 0xff3a3a], [0, 0xffffff], [6, 0xff3a3a], [12, 0x4a7dff], [-18, 0x4a7dff]].forEach(([x, c], i)=>{
    const g = new THREE.ConeGeometry(3.4, 34, 14, 1, true); g.translate(0, -17, 0); const piv = new THREE.Object3D(); piv.position.set(x, 32, 4 + (i%3)*14); const m = new THREE.Mesh(g, beamMat(c)); piv.add(m);
    const sp = new THREE.Sprite(glowMat(c)); sp.scale.setScalar(4); piv.add(sp); scene.add(piv); beams.push([piv, i, m, sp, 0]); });
  for (let i=0;i<8;i++){ const a = i/8*Math.PI*2 + Math.PI/8, c = [0xffffff, 0xff2a32, 0x4a7dff, 0xff2a32][i%4];
    const g = new THREE.ConeGeometry(1.1, 26, 10, 1, true); g.translate(0, -13, 0); const piv = new THREE.Object3D(); piv.position.set(Math.cos(a)*6.4, 19.2, Math.sin(a)*6.4); const m = new THREE.Mesh(g, beamMat(c, .3)); piv.add(m);
    const sp = new THREE.Sprite(glowMat(c)); sp.scale.setScalar(1.6); piv.add(sp); scene.add(piv); beams.push([piv, 10 + i, m, sp, a]); }
  const lasers = [], laserM = new THREE.MeshBasicMaterial({color:0xff1020, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false, fog:false});
  [-11, 11].forEach((x, b)=>{ for (let i=0;i<4;i++){ const g = new THREE.CylinderGeometry(.025, .025, 70, 4, 1, true); g.translate(0, -35, 0); const piv = new THREE.Object3D(); piv.position.set(x, 23, -38); piv.add(new THREE.Mesh(g, laserM)); scene.add(piv); lasers.push([piv, b, i]); }
    const sp = new THREE.Sprite(glowMat(0xff2030)); sp.scale.setScalar(2.4); sp.position.set(x, 23, -38); scene.add(sp); });

  // Pyrotechnie : jets d'étincelles et colonnes de feu
  const JETS = [[-2.6, 0, 60], [2.6, 0, 60], [-9.5, 0, -6.5], [9.5, 0, -6.5], [-9.5, 0, 6.5], [9.5, 0, 6.5]], PN = 160;
  const pyroPos = new Float32Array(JETS.length*PN*3), pyroSeed = new Float32Array(JETS.length*PN*3); for (let i=0;i<pyroSeed.length;i++) pyroSeed[i] = r();
  const pyroG = new THREE.BufferGeometry(); pyroG.setAttribute("position", new THREE.BufferAttribute(pyroPos, 3));
  const pyroM = new THREE.PointsMaterial({size:.35, map:dot, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:0xffb347, fog:false}); const pyroPts = new THREE.Points(pyroG, pyroM); pyroPts.frustumCulled = false; scene.add(pyroPts);
  const flames = JETS.map(([x,,z])=>{ const s = new THREE.Sprite(glowMat(0xff6a10)); s.position.set(x, 1.5, z); s.scale.set(1.5, 4, 1); s.visible = false; scene.add(s); return s; });
  let pyroAt = -99, pyroSet = 0;

  // Cage
  const cage = new THREE.Group(); scene.add(cage);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(7.75, 8, .9, 8), std(0x111111, .6)); apron.rotation.y = Math.PI/8; apron.position.y = .45; cage.add(apron);
  const apronLed = new THREE.Mesh(new THREE.CylinderGeometry(8.02, 8.02, .08, 8, 1, true), ledRingM); apronLed.rotation.y = Math.PI/8; apronLed.position.y = .22; cage.add(apronLed);
  const logo = tex(1024, 1024, (g,w)=>{ g.fillStyle = "#9c9a98"; g.fillRect(0,0,w,w); for (let i=0;i<9000;i++){ const v = 140 + Math.random()*30; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(Math.random()*w, Math.random()*w, 2, 2); } g.translate(w/2, w/2); g.strokeStyle = "rgba(160,20,26,.85)"; g.lineWidth = 14;
    g.beginPath(); for (let i=0;i<=8;i++){ const a = Math.PI/8 + i*Math.PI/4; g[i?"lineTo":"moveTo"](Math.cos(a)*300, Math.sin(a)*300); } g.stroke();
    g.globalAlpha = .55; g.fillStyle = "rgba(20,20,20,.8)"; g.font = "bold 150px Impact, Anton, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("FIGHT", 0, -70); g.fillStyle = "#b5121b"; g.fillText("CAMP", 0, 80); });
  const matM = new THREE.Mesh(new THREE.CircleGeometry(7.55, 8), new THREE.MeshStandardMaterial({map:logo, roughness:.85, color:0x8a8a8a})); matM.rotation.x = -Math.PI/2; matM.rotation.z = Math.PI/8; matM.position.y = .905; cage.add(matM);
  const fenceT = tex(128, 128, (g,w)=>{ g.clearRect(0,0,w,w); g.strokeStyle = "rgba(25,25,25,1)"; g.lineWidth = 7; g.beginPath(); g.moveTo(0,0); g.lineTo(w,w); g.moveTo(w,0); g.lineTo(0,w); g.stroke(); });
  fenceT.wrapS = fenceT.wrapT = THREE.RepeatWrapping; fenceT.repeat.set(18, 6);
  const fenceM = new THREE.MeshStandardMaterial({map:fenceT, transparent:true, alphaTest:.3, side:THREE.DoubleSide, color:0x333333, roughness:.5, metalness:.6});
  const padM = std(0x0a0a0a, .5), railM = std(0x0d0d0d, .4, .3), R8 = 7.5;
  for (let i=0;i<8;i++){ const a = Math.PI/8 + i*Math.PI/4, b = a + Math.PI/4, A = new THREE.Vector3(Math.cos(a)*R8, 0, Math.sin(a)*R8), Bv = new THREE.Vector3(Math.cos(b)*R8, 0, Math.sin(b)*R8);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 2.1, 12), padM); post.position.set(A.x, 1.95, A.z); cage.add(post);
    const mid = A.clone().add(Bv).multiplyScalar(.5), len = A.distanceTo(Bv), ang = Math.atan2(Bv.x - A.x, Bv.z - A.z);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .14, .16), railM); rail.position.set(mid.x, 2.75, mid.z); rail.rotation.y = ang + Math.PI/2; cage.add(rail);
    if (i === 1){ const door = new THREE.Mesh(new THREE.PlaneGeometry(len*.55, 1.7), fenceM); door.position.set(Bv.x + .9, 1.85, Bv.z + 1.1); door.rotation.y = ang + Math.PI/2 + 1.1; cage.add(door); continue; }
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.7), fenceM); f.position.set(mid.x, 1.85, mid.z); f.rotation.y = ang + Math.PI/2; cage.add(f); }
  [[.3, 8.35], [.6, 7.95], [.9, 7.55]].forEach(([h, z])=>{ const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, .42), std(0x181818, .6)); st.position.set(0, h/2, z); cage.add(st); });
  const rig = new THREE.Mesh(new THREE.BoxGeometry(13, .35, 13), std(0x080808)); rig.position.y = 19.5; cage.add(rig);
  const lampM = new THREE.MeshBasicMaterial({color:0xffffff, toneMapped:false});
  for (let i=0;i<16;i++){ const lamp = new THREE.Mesh(new THREE.CircleGeometry(.33, 16), lampM); lamp.rotation.x = Math.PI/2; lamp.position.set(-5.4 + (i%4)*3.6, 19.31, -5.4 + Math.floor(i/4)*3.6); cage.add(lamp); }

  // Dans la cage : adversaire, speaker, arbitre, cameraman
  const opp = makeHuman({skin: 0x7a4f3a, topless:true, shorts: o.oppColor || 0x1f4fb4, gloves: o.oppColor || 0x1f4fb4, barefoot:true, hair:0x120c08, build:1.14});
  const OPP0 = new THREE.Vector3(-.3, .905, -4.6), OPP1 = new THREE.Vector3(0, .905, -3.0);
  opp.g.position.copy(OPP0); guardPose(opp); scene.add(opp.g);
  const spk = makeHuman({skin:0xb58466, suit:true, top:0x0c0c0c, bottom:0x0c0c0c, hair:0x2a2420, build:1.06});
  const SPK0 = new THREE.Vector3(-1.25, .905, -.8), SPK1 = new THREE.Vector3(-3.2, .905, 1.6);
  spk.g.position.copy(SPK0); scene.add(spk.g);
  const mic = new THREE.Mesh(merge([new THREE.CylinderGeometry(.018, .013, .2, 10), sph(.032, 0, .11, 0)]), std(0x111111, .3, .7)); mic.position.set(0, -.08, .03); mic.rotation.x = -1.2; spk.handR.add(mic);
  const ref = makeHuman({skin:0x9a6a50, top:0x0b0b0b, bottom:0x3a3a3e, hair:0x1a1410, build:1.08, handM:"latex"});
  const REF0 = new THREE.Vector3(-4.6, .905, 1.2), REF1 = new THREE.Vector3(1.05, .905, -1.65);
  ref.g.position.copy(REF0); scene.add(ref.g);
  const camMan = makeHuman({skin:0xc08f70, top:0x1c1c1e, bottom:0x26262a, hair:0x3a2a1a, build:1.1});
  const camBody = new THREE.Group(); camBody.position.set(-.2, 1.63, .06); camMan.g.add(camBody);
  camBody.add(new THREE.Mesh(new THREE.BoxGeometry(.15, .17, .36), std(0x0d0d0d, .5)));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .16, 16), std(0x050505, .3, .6)); lens.rotation.x = Math.PI/2; lens.position.set(0, .01, .25); camBody.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.045, 16), new THREE.MeshStandardMaterial({color:0x0a1a3a, roughness:.05, metalness:1})); glass.position.set(0, .01, .331); camBody.add(glass);
  const tally = new THREE.Mesh(sph(.012, 0, 0, 0), new THREE.MeshBasicMaterial({color:0xff1010, toneMapped:false})); tally.position.set(.05, .1, .14); camBody.add(tally);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(.13, .12, .04), std(0x0d0d0d)); hood.position.set(.11, .03, .1); camBody.add(hood);
  camMan.shR.rotation.set(-1.5, 0, -.35); camMan.elR.rotation.x = -1.5; camMan.shL.rotation.set(-1.35, 0, .5); camMan.elL.rotation.x = -.55;
  const CAM0 = new THREE.Vector3(3.0, .905, .2), CAM1 = new THREE.Vector3(.8, .905, 1.3), CAM2 = new THREE.Vector3(-1.6, .905, -1.0);
  camMan.g.position.copy(CAM0); scene.add(camMan.g);

  // Écrans géants : écran du fond de salle + cube au-dessus de la cage
  const SW = 768, SH = 384, sc2 = document.createElement("canvas"); sc2.width = SW; sc2.height = SH; const sx = sc2.getContext("2d");
  const scrT = new THREE.CanvasTexture(sc2); scrT.colorSpace = THREE.SRGBColorSpace;
  const led = document.createElement("canvas"); led.width = 8; led.height = 8; { const l = led.getContext("2d"); l.fillStyle = "rgba(0,0,0,.32)"; l.fillRect(0,0,8,8); l.clearRect(1,1,6,6); }
  const ledPat = sx.createPattern(led, "repeat");
  const imgs = {}; const img = src => { if (!imgs[src]){ const im = new Image(); im.src = src; imgs[src] = im; } return imgs[src]; };
  let ov = null, ovAt = 0, sNow = 0;
  const W0 = 1024, H0 = 512;
  function txt(t, x, y, font, color, max){ sx.font = font; let f = font; if (max){ let size = parseInt(font.match(/(\d+)px/)[1]); while (sx.measureText(t).width > max && size > 30){ size -= 6; f = font.replace(/\d+px/, size + "px"); sx.font = f; } } sx.fillStyle = color; sx.fillText(t, x, y); }
  const IMPACT = n => `bold ${n}px Impact, Anton, sans-serif`;
  function bg(c0 = "#3a0509", accent = "#d7262e", s){
    const gr = sx.createLinearGradient(0,0,W0,H0); gr.addColorStop(0,c0); gr.addColorStop(.5,"#0c0203"); gr.addColorStop(1,c0); sx.fillStyle = gr; sx.fillRect(0,0,W0,H0);
    sx.save(); sx.globalAlpha = .2; sx.strokeStyle = accent; sx.lineWidth = 3; for (let i=-6;i<12;i++){ const x = ((i*120 + s*160) % (W0+240)) - 120; sx.beginPath(); sx.moveTo(x,0); sx.lineTo(x+240,H0); sx.stroke(); } sx.restore(); }
  const count = (to, k, dec) => { const v = to*(1 - Math.pow(1 - clamp(k), 3)); return dec ? (Math.round(v*10)/10).toLocaleString("fr-FR") : String(Math.round(v)); };
  function drawEye(t, d){
    const cx = W0/2, cy = H0/2;
    sx.fillStyle = "#000"; sx.fillRect(0,0,W0,H0);
    if (t < 2.15){
      const open = smooth(clamp((t - .15)/.55)), dive = t > 1.7 ? Math.pow((t - 1.7)/.45, 2.2) : 0, z = 1 + dive*14;
      sx.save(); sx.translate(cx, cy); sx.scale(z, z);
      const ew = 430, eh = 230*open; sx.beginPath(); sx.moveTo(-ew, 0); sx.quadraticCurveTo(0, -eh*1.15, ew, 0); sx.quadraticCurveTo(0, eh*1.15, -ew, 0); sx.closePath();
      sx.save(); sx.clip();
      const sg = sx.createRadialGradient(0,0,10,0,0,420); sg.addColorStop(0,"#9ad6ff"); sg.addColorStop(.5,"#2f86ff"); sg.addColorStop(1,"#071f55"); sx.fillStyle = sg; sx.fillRect(-ew,-260,ew*2,520);
      sx.strokeStyle = "rgba(200,235,255,.35)"; sx.lineWidth = 3; for (let i=0;i<36;i++){ const a = i/36*Math.PI*2; sx.beginPath(); sx.moveTo(Math.cos(a)*60, Math.sin(a)*60); sx.lineTo(Math.cos(a)*150, Math.sin(a)*150); sx.stroke(); }
      const ring = sx.createRadialGradient(0,0,110,0,0,165); ring.addColorStop(0,"rgba(5,15,45,0)"); ring.addColorStop(.7,"rgba(5,15,45,.6)"); ring.addColorStop(1,"rgba(5,15,45,0)"); sx.fillStyle = ring; sx.beginPath(); sx.arc(0,0,165,0,Math.PI*2); sx.fill();
      const pr = 95 - 40*smooth(clamp((t - .7)/.6)) + Math.sin(t*9)*2; sx.fillStyle = "#020309"; sx.beginPath(); sx.arc(0,0,pr,0,Math.PI*2); sx.fill();
      sx.fillStyle = "#fff"; sx.beginPath(); sx.arc(-38,-36,22,0,Math.PI*2); sx.fill(); sx.globalAlpha = .7; sx.beginPath(); sx.arc(30,30,8,0,Math.PI*2); sx.fill(); sx.globalAlpha = 1;
      sx.restore(); sx.strokeStyle = "#9fd0ff"; sx.lineWidth = 5; sx.stroke(); sx.restore();
      if (dive > .6){ sx.fillStyle = `rgba(0,0,0,${clamp((dive - .6)*2)})`; sx.fillRect(0,0,W0,H0); }
      if (t < .2){ sx.fillStyle = `rgba(0,0,0,${1 - t/.2})`; sx.fillRect(0,0,W0,H0); }
      return; }
    const u = t - 2.15, g = sx.createRadialGradient(cx,cy,10,cx,cy,600); g.addColorStop(0,"#0f3a7a"); g.addColorStop(.6,"#06101f"); g.addColorStop(1,"#000"); sx.fillStyle = g; sx.fillRect(0,0,W0,H0);
    if (u < .25){ sx.fillStyle = `rgba(255,255,255,${1 - u/.25})`; sx.fillRect(0,0,W0,H0); }
    sx.textAlign = "center"; sx.textBaseline = "middle"; const nm = (d.big || "").toUpperCase(), sc = 1 + Math.max(0, .35 - u)*2;
    sx.save(); sx.translate(cx, cy + 30); sx.scale(sc, sc);
    const jit = u < 1.1 ? 1 : 0, ox = jit ? (Math.random() - .5)*26 : 0;
    sx.globalCompositeOperation = "lighter"; txt(nm, -6 + ox, 0, IMPACT(170), "rgba(60,140,255,.9)", 920); txt(nm, 6 - ox, 0, IMPACT(170), "rgba(255,50,70,.8)", 920); sx.globalCompositeOperation = "source-over";
    txt(nm, 0, 0, IMPACT(170), "#fff", 920); sx.restore();
    if (d.top) txt(d.top, cx, 95, "italic 600 54px Arial", "#8fc4ff", 900);
    sx.fillStyle = "rgba(0,0,0,.18)"; for (let y=0;y<H0;y+=6) sx.fillRect(0, y, W0, 2);
  }
  function drawScreen(s){
    sx.setTransform(SW/W0, 0, 0, SW/W0, 0, 0); sx.textAlign = "center"; sx.textBaseline = "middle";
    const d = ov, t = s - ovAt, k = clamp(t/1.1), pop = 1 + Math.max(0, .3 - t)*1.6, cx = W0/2, cy = H0/2;
    const kind = d ? (d.kind || "text") : "loop";
    if (kind === "eye"){ drawEye(t, d); }
    else if (kind === "flag"){
      const im = d.img ? img(d.img) : null; sx.fillStyle = "#000"; sx.fillRect(0,0,W0,H0);
      const N = 48, fw = W0/N; for (let i=0;i<N;i++){ const wv = Math.sin(i*.35 - s*5)*14*(i/N + .2), x = i*fw;
        sx.save(); sx.beginPath(); sx.rect(x, 0, fw + 1, H0); sx.clip(); sx.translate(0, wv);
        if (im && im.complete && im.naturalWidth) sx.drawImage(im, 0, 0, W0, H0);
        else if (d.stripes){ const n = d.stripes.length; d.stripes.forEach((c, j)=>{ sx.fillStyle = c; if (d.dir === "v") sx.fillRect(j*W0/n, 0, W0/n + 1, H0); else sx.fillRect(0, j*H0/n, W0, H0/n + 1); }); }
        else { sx.fillStyle = "#2a2626"; sx.fillRect(0,0,W0,H0); }
        sx.fillStyle = `rgba(0,0,0,${.18 + .18*Math.sin(i*.35 - s*5)})`; sx.fillRect(x, 0, fw + 1, H0); sx.restore(); }
      const gb = sx.createLinearGradient(0, H0*.55, 0, H0); gb.addColorStop(0,"rgba(0,0,0,0)"); gb.addColorStop(1,"rgba(0,0,0,.85)"); sx.fillStyle = gb; sx.fillRect(0,0,W0,H0);
      sx.save(); sx.translate(cx, 420); sx.scale(pop, pop); txt((d.top || "").toUpperCase(), 0, -70, "600 40px Arial", "#d9a43a", 900); txt((d.big || "").toUpperCase(), 0, 0, IMPACT(96), "#fff", 940); sx.restore();
    }
    else if (kind === "gauge"){
      bg("#3a0509", "#d7262e", s); const gx = 300, gy = 330, R = 190, kk = ease(t/1.2);
      sx.lineCap = "round"; sx.lineWidth = 30; sx.strokeStyle = "#2a2323"; sx.beginPath(); sx.arc(gx, gy, R, Math.PI, 0); sx.stroke();
      const gr = sx.createLinearGradient(gx - R, 0, gx + R, 0); gr.addColorStop(0,"#d7262e"); gr.addColorStop(1,"#d9a43a"); sx.strokeStyle = gr; sx.beginPath(); sx.arc(gx, gy, R, Math.PI, Math.PI + Math.PI*(d.frac ?? .5)*kk); sx.stroke();
      const na = Math.PI + Math.PI*(d.frac ?? .5)*kk + Math.sin(t*20)*.03*(1 - kk); sx.strokeStyle = "#efe7dc"; sx.lineWidth = 8; sx.beginPath(); sx.moveTo(gx, gy); sx.lineTo(gx + Math.cos(na)*(R - 30), gy + Math.sin(na)*(R - 30)); sx.stroke();
      sx.fillStyle = "#efe7dc"; sx.beginPath(); sx.arc(gx, gy, 18, 0, Math.PI*2); sx.fill();
      txt(count(d.kg || 0, t/1.2, true) + " kg", gx, gy + 70, IMPACT(56), "#d9a43a");
      txt((d.top || "PESÉE OFFICIELLE").toUpperCase(), 740, 150, "600 40px Arial", "#d9a43a", 480);
      sx.save(); sx.translate(740, 270); sx.scale(pop, pop); txt((d.big || "").toUpperCase(), 0, 0, IMPACT(140), "#fff", 480); sx.restore();
    }
    else if (kind === "ruler"){
      bg("#3a0509", "#d7262e", s); const rx = 220, top = 50, bot = 470, kk = ease(t/1.1), h = (bot - top)*(d.frac ?? .8)*kk;
      sx.fillStyle = "#1a1414"; sx.fillRect(rx - 50, top, 100, bot - top);
      const gr = sx.createLinearGradient(0, bot, 0, top); gr.addColorStop(0,"#d7262e"); gr.addColorStop(1,"#d9a43a"); sx.fillStyle = gr; sx.fillRect(rx - 50, bot - h, 100, h);
      sx.strokeStyle = "rgba(255,255,255,.6)"; sx.lineWidth = 3; for (let i=0;i<=20;i++){ const y = bot - i*(bot - top)/20; sx.beginPath(); sx.moveTo(rx + 50, y); sx.lineTo(rx + (i%5 ? 70 : 95), y); sx.stroke(); }
      txt(count(d.cm || 0, t/1.1) + " cm", rx, bot - h - 30, IMPACT(46), "#fff");
      txt((d.top || "TAILLE").toUpperCase(), 680, 150, "600 40px Arial", "#d9a43a", 560);
      sx.save(); sx.translate(680, 280); sx.scale(pop, pop); txt((d.big || "").toUpperCase(), 0, 0, IMPACT(170), "#fff", 560); sx.restore();
    }
    else if (kind === "age"){
      bg("#2a1e05", "#d9a43a", s);
      for (let i=0;i<4;i++){ const p = ((t*.7 + i/4) % 1); sx.strokeStyle = `rgba(217,164,58,${(1 - p)*.8})`; sx.lineWidth = 6; sx.beginPath(); sx.arc(cx, cy, 80 + p*320, 0, Math.PI*2); sx.stroke(); }
      txt((d.top || "À SEULEMENT").toUpperCase(), cx, 70, "600 40px Arial", "#d9a43a");
      sx.save(); sx.translate(cx, cy + 10); sx.scale(pop, pop); txt(count(d.n || 0, t/1.1), 0, 0, IMPACT(230), "#fff"); sx.restore();
      txt("ANS", cx, 440, IMPACT(60), "#d9a43a");
    }
    else if (kind === "record"){
      bg("#1a0a0a", "#d7262e", s); txt("PALMARÈS PROFESSIONNEL", cx, 70, "600 40px Arial", "#d9a43a");
      (d.vals || ["0","0","0"]).forEach((v, i)=>{ const x = cx + (i - 1)*300, ki = clamp((t - .15 - i*.3)/.35), sy = Math.abs(Math.cos(ki*Math.PI));
        sx.fillStyle = "#120c0c"; sx.fillRect(x - 120, 120, 240, 270); sx.strokeStyle = ["#d9a43a","#d7262e","#8a8a8a"][i]; sx.lineWidth = 6; sx.strokeRect(x - 120, 120, 240, 270);
        sx.save(); sx.translate(x, 255); sx.scale(1, ki >= 1 ? 1 : Math.max(.02, sy)); txt(ki < .5 ? "-" : String(v), 0, 0, IMPACT(200), "#fff"); sx.restore();
        txt(["VICTOIRES","DÉFAITES","NULS"][i], x, 440, "600 34px Arial", "#ccc"); });
    }
    else if (kind === "heart"){
      sx.fillStyle = "#000"; sx.fillRect(0,0,W0,H0); const beat = Math.pow(Math.max(0, Math.sin(t*Math.PI*1.8)), 12);
      sx.strokeStyle = "#ff2a32"; sx.lineWidth = 5; sx.beginPath(); for (let x=0;x<=W0;x+=6){ const ph = ((x/W0)*2 - t*.9) % 1, p = ph < 0 ? ph + 1 : ph, y = cy + 60 + (Math.abs(p - .5) < .03 ? -150*Math.sin((p - .47)*Math.PI/.06) : 0); x ? sx.lineTo(x, y) : sx.moveTo(x, y); } sx.stroke();
      sx.save(); sx.translate(cx, cy - 80); sx.scale(1 + beat*.12, 1 + beat*.12); txt((d.big || "C'EST…").toUpperCase(), 0, 0, IMPACT(150), "#fff"); sx.restore();
    }
    else if (kind === "final"){
      const strobe = t < 1.2 && Math.floor(t*14) % 2 === 0; bg(strobe ? "#ffffff" : "#5a0a0d", "#ff3a3a", s);
      for (let i=0;i<5;i++){ const p = ((t*1.2 + i/5) % 1); sx.strokeStyle = `rgba(255,60,60,${(1 - p)*.7})`; sx.lineWidth = 8; sx.beginPath(); sx.arc(cx, cy, p*560, 0, Math.PI*2); sx.stroke(); }
      sx.save(); sx.translate(cx, cy); sx.scale(pop*1.1, pop*1.1); txt((d.top || "FIGHT").toUpperCase(), 0, -80, IMPACT(170), strobe ? "#000" : "#fff", 940); txt((d.big || "CAMP").toUpperCase(), 0, 90, IMPACT(170), "#ff2a32", 940); sx.restore();
    }
    else if (kind === "corner"){
      const c = d.color || "#0a1f4a", acc = d.accent || "#4f8fd6"; bg(c, acc, s); const w = ease(t/.5);
      sx.fillStyle = acc; sx.globalAlpha = .9*(1 - clamp((t - .5)/.5)); sx.beginPath(); sx.moveTo(w*1500 - 400, 0); sx.lineTo(w*1500 - 100, 0); sx.lineTo(w*1500 - 400, H0); sx.lineTo(w*1500 - 700, H0); sx.fill(); sx.globalAlpha = 1;
      txt((d.top || "DANS LE COIN").toUpperCase(), cx, 110, "600 44px Arial", acc);
      sx.save(); sx.translate(cx, 290); sx.scale(pop, pop); txt((d.big || "").toUpperCase(), 0, 0, IMPACT(230), "#fff", 940); sx.restore();
    }
    else if (kind === "vs"){
      bg("#200406", "#d7262e", s); sx.fillStyle = "rgba(215,38,46,.35)"; sx.fillRect(0,0,W0/2,H0); sx.fillStyle = "rgba(31,79,180,.35)"; sx.fillRect(W0/2,0,W0/2,H0);
      txt((d.a || "").toUpperCase(), W0*.24, cy, IMPACT(80), "#fff", 380); txt((d.b || "").toUpperCase(), W0*.76, cy, IMPACT(80), "#fff", 380);
      sx.save(); sx.translate(cx, cy); sx.scale(pop*1.2, pop*1.2); txt("VS", 0, 0, IMPACT(130), "#d9a43a"); sx.restore();
      txt((d.top || "FACE-À-FACE").toUpperCase(), cx, 70, "600 40px Arial", "#d9a43a");
    }
    else if (kind === "text"){
      bg(d.color || "#3a0509", d.accent || "#d7262e", s);
      if (t < .25){ for (let i=0;i<3;i++){ sx.strokeStyle = `rgba(255,220,150,${1 - t*4})`; sx.lineWidth = 10; sx.beginPath(); sx.arc(cx, cy, 80 + t*2400 + i*60, 0, Math.PI*2); sx.stroke(); } }
      txt((d.top || "").toUpperCase(), cx, 100, "600 46px Arial", d.accent || "#d9a43a", 920);
      sx.save(); sx.translate(cx, cy + 10); sx.scale(pop, pop); txt((d.big || "").toUpperCase(), 0, 0, IMPACT(180), "#fff", 920); sx.restore();
      if (d.sub) txt(d.sub, cx, 410, "italic 600 50px Arial", "#ddd", 920);
    }
    else {
      const phase = Math.floor(s/3.2) % 3, kk = (s % 3.2)/3.2, p2 = 1 + Math.max(0, .25 - kk)*1.2; bg("#3a0509", "#d7262e", s);
      sx.save(); sx.translate(cx, cy); sx.scale(p2, p2);
      if (phase === 0){ txt((o.top || "MAIN EVENT").toUpperCase(), 0, -150, "600 48px Arial", "#d9a43a"); txt((o.name || "").toUpperCase(), 0, 10, IMPACT(190), "#fff", 900); if (o.nick) txt("« " + o.nick + " »", 0, 150, "italic 600 58px Arial", "#8fc4ff", 900); }
      else if (phase === 1){ txt("PALMARÈS", 0, -150, "600 48px Arial", "#d9a43a"); txt(o.record || "0-0-0", 0, 20, IMPACT(200), "#fff", 900); txt((o.rank || "").toUpperCase(), 0, 160, "600 44px Arial", "#ccc"); }
      else { txt("FIGHT", 0, -70, IMPACT(150), "#fff"); txt("CAMP", 0, 90, IMPACT(150), "#d7262e"); }
      sx.restore();
    }
    sx.setTransform(1,0,0,1,0,0); sx.fillStyle = ledPat; sx.fillRect(0,0,SW,SH);
    sx.strokeStyle = d && d.accent || "#d7262e"; sx.lineWidth = 8; sx.strokeRect(4,4,SW-8,SH-8); scrT.needsUpdate = true;
  }
  drawScreen(0);
  const scrMat = new THREE.MeshBasicMaterial({map:scrT, toneMapped:false, fog:false});
  const cube = new THREE.Group(); cube.position.y = 13.5; cage.add(cube);
  const frameM = std(0x050505, .4, .5);
  for (let i=0;i<4;i++){ const a = i*Math.PI/2, sp = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), scrMat); sp.position.set(Math.sin(a)*3.7, 0, Math.cos(a)*3.7); sp.rotation.y = a; cube.add(sp);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4, .2), frameM); fr.position.set(Math.sin(a)*3.6, 0, Math.cos(a)*3.6); fr.rotation.y = a; cube.add(fr); }
  const ringC = document.createElement("canvas"); ringC.width = 2048; ringC.height = 64; const rx = ringC.getContext("2d");
  rx.fillStyle = "#050505"; rx.fillRect(0,0,2048,64); rx.fillStyle = "#ff3a3a"; rx.font = "bold 44px Arial"; rx.textBaseline = "middle";
  const ringTxt = `FIGHT CAMP  ·  ${(o.name||"").toUpperCase()}  ·  ${o.nick ? "« " + o.nick.toUpperCase() + " »  ·  " : ""}MAIN EVENT  ·  `; let rxp = 0; while (rxp < 2048){ rx.fillText(ringTxt, rxp, 34); rxp += rx.measureText(ringTxt).width; }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace; ringT.wrapS = THREE.RepeatWrapping; ringT.repeat.set(2, 1);
  const ringM = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, .7, 48, 1, true), new THREE.MeshBasicMaterial({map:ringT, toneMapped:false, side:THREE.DoubleSide, fog:false})); ringM.position.y = -2.6; cube.add(ringM);
  const wallScr = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), scrMat); wallScr.position.set(0, 17, -39.2); scene.add(wallScr);
  const wallFr = new THREE.Mesh(new THREE.BoxGeometry(23, 12, .4), frameM); wallFr.position.set(0, 17, -39.6); scene.add(wallFr);
  const scrGlow = new THREE.PointLight(0xff3040, 60, 30, 1.6); scrGlow.position.set(0, 15, -34); scene.add(scrGlow);

  // Tes gants à la première personne
  const glovesG = new THREE.Group(); cam.add(glovesG);
  const gm = new THREE.MeshStandardMaterial({color: o.myColor || 0xc81e28, roughness:.32}), wm = new THREE.MeshStandardMaterial({color:0xeeeeee, roughness:.6});
  [[-1, -.2], [1, .2]].forEach(([s, x])=>{ const gl = new THREE.Group(); gl.add(new THREE.Mesh(sph(.075, 0, 0, 0, 1, 1.15, 1.25), gm)); gl.add(new THREE.Mesh(sph(.03, s*-.06, .02, -.03, .8, 1.3, .9), gm)); const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.052, .055, .09, 14), wm); cuff.rotation.x = Math.PI/2; cuff.position.z = .1; gl.add(cuff);
    gl.position.set(x*.55, -.34, -.8); gl.rotation.set(.25, s*-.25, 0); gl.scale.setScalar(.62); glovesG.add(gl); });
  glovesG.visible = false;

  // Caméra
  const PATH = [[0,0,94.2],[0,0,90],[0,0,86],[0,0,80],[0,0,72],[0,0,62],[0,0,50],[0,0,36],[0,0,22],[0,0,12],[0,0,8.8],[0,.3,8.35],[0,.6,7.95],[0,.9,7.55],[0,.9,6.4],[0,.9,4.2]];
  const segs = []; let tot = 0; for (let i=1;i<PATH.length;i++){ const L = Math.hypot(PATH[i][0]-PATH[i-1][0], PATH[i][1]-PATH[i-1][1], PATH[i][2]-PATH[i-1][2]); segs.push(L); tot += L; }
  const pathAt = d => { let i = 0; while (i < segs.length-1 && d > segs[i]){ d -= segs[i]; i++; } const k = clamp(d/segs[i]), A = PATH[i], Bp = PATH[i+1]; return [A[0]+(Bp[0]-A[0])*k, A[1]+(Bp[1]-A[1])*k, A[2]+(Bp[2]-A[2])*k]; };
  const KEYS = [[0,-70,-6],[.04,-35,-3],[.08,45,-2],[.11,0,0],[.14,0,0],[.22,0,2],[.3,0,5],[.36,50,9],[.43,52,12],[.49,-48,9],[.56,-52,12],[.61,0,4],[.66,34,14],[.71,-28,12],[.76,0,22],[.81,0,6],[.88,0,0],[.94,0,24],[1,0,3]];
  const look = t => { let i = 0; while (i < KEYS.length-2 && KEYS[i+1][0] < t) i++; const [t0,y0,p0] = KEYS[i], [t1,y1,p1] = KEYS[i+1], k = smooth(clamp((t-t0)/(t1-t0))); return [y0 + (y1-y0)*k, p0 + (p1-p0)*k]; };
  const prog = t => { const a = clamp((t-.1)/.8); return smooth(a)*.55 + a*.45; };
  const TARGETS = {opponent:[-.3, 2.55, -4.6], speaker:[-1.25, 2.45, -.8], screen:[0, 12, -30], crowdL:[-18, 6, -4], crowdR:[18, 6, -4], crowd:[0, 8, -30], camera:[.25, 2.3, 2.0], gloves:[0, 1.2, 2.6]};
  let mode = "walk", cageAt = 0, faceAt = -1, lookCur = new THREE.Vector3(0, 2.4, -10), lookGoal = new THREE.Vector3(-.3, 2.55, -4.6), lookName = "opponent";
  let camStep = 0, tintC = null, flashK = 0, gloveUp = 0, gloveGoal = 0, roarK = 0, levelFn = null, lvl = .5, talkK = 0, spkAct = "talk", spkTgt = "me", spkAt = 0, spkRot0 = 0, spkStep = 0;
  let start = performance.now(), raf = 0, stopped = false, lastStep = 0, lastScr = -1;
  const tgt = new THREE.Vector3(), base = [new THREE.Color(0xd7262e), new THREE.Color(0xd7262e), new THREE.Color(0x3a6dff)], tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
  const lerpV = (out, a, b, k) => out.set(a.x + (b.x - a.x)*k, a.y + (b.y - a.y)*k, a.z + (b.z - a.z)*k);
  const faceTo = (g, x, z, k=.08) => { const want = Math.atan2(x - g.position.x, z - g.position.z); let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d*k; };
  function walkCycle(p, ph, amt){ p.hipL.rotation.x = Math.sin(ph)*.45*amt; p.hipR.rotation.x = -Math.sin(ph)*.45*amt; p.knL.rotation.x = Math.max(0, -Math.sin(ph))*.6*amt; p.knR.rotation.x = Math.max(0, Math.sin(ph))*.6*amt; }

  let fT = 0, fN = 0, lastNow = 0, calm = 0;
  function adapt(now){
    if (lastNow){ const dt = now - lastNow; if (dt < 200){ fT += dt; fN++; } } lastNow = now;
    if (fN < 45) return; const avg = fT/fN; fT = 0; fN = 0;
    if (avg > 21 && pr > .6){ pr = Math.max(.6, pr - .15); renderer.setPixelRatio(pr); size(); calm = 0; }
    else if (avg < 15.5 && pr < maxPR && ++calm > 2){ pr = Math.min(maxPR, pr + .1); renderer.setPixelRatio(pr); size(); calm = 0; }
  }
  function frame(now){
    if (stopped) return; raf = requestAnimationFrame(frame);
    if (document.hidden){ lastNow = 0; return; }
    adapt(now);
    const s = window.__arenaS !== undefined ? window.__arenaS : (now - start)/1000, t = clamp(s/D); uTime.value = s; sNow = s;
    // Niveau de la musique (si branchée), sinon pulsation régulière
    let lv = .5 + .5*Math.sin(s*Math.PI*2*1.55); if (levelFn){ try{ lv = levelFn(); }catch(e){} }
    lvl += (lv - lvl)*(lv > lvl ? .5 : .12); uLvl.value = clamp(lvl*.8 + roarK*.6, 0, 1.4);
    if (mode === "walk"){
      const p = pathAt(prog(t)*tot), moving = t > .1 && t < .99, f = 1.75, ph = s*f*Math.PI;
      const bob = moving ? (Math.abs(Math.sin(ph)) - .63)*.07 : 0, sway = moving ? Math.sin(ph)*.035 : 0;
      cam.position.set(p[0] + sway, 1.72 + p[1] + bob, p[2]);
      const [yaw, pitch] = look(t), jx = Math.sin(s*1.7)*.35 + Math.sin(s*3.3)*.2, jy = Math.sin(s*1.3)*.25 + (moving ? Math.abs(Math.sin(ph))*-.6 : 0);
      const ya = THREE.MathUtils.degToRad(yaw + jx), pa = THREE.MathUtils.degToRad(pitch + jy);
      tgt.set(cam.position.x - Math.sin(ya)*Math.cos(pa)*10, cam.position.y + Math.sin(pa)*10, cam.position.z - Math.cos(ya)*Math.cos(pa)*10); cam.lookAt(tgt); lookCur.copy(tgt);
      cam.rotateZ(moving ? Math.sin(ph)*.01 : 0);
      if (moving && o.onStep){ const st = Math.floor(s*f); if (st !== lastStep){ lastStep = st; o.onStep(); } }
      if (t > .12 && t < .2 && pyroSet !== 1){ pyroSet = 1; pyroAt = s; }
      if (t >= 1){ mode = "cage"; cageAt = s; }
    } else {
      const ck = s - cageAt, fk = faceAt >= 0 ? smooth(clamp((s - faceAt)/2.8)) : 0;
      const bz = 4.2 + (-1.15 - 4.2)*fk, by = 2.62 - fk*.04;
      cam.position.set(Math.sin(s*.8)*.06*(1 - fk) + Math.sin(s*1.7)*.015, by + Math.sin(s*1.6)*.012 + (fk > 0 && fk < 1 ? Math.abs(Math.sin(s*7))*.03 : 0), bz + Math.sin(s*.5)*.05*(1 - fk));
      if (lookName === "camera"){ const hp = camMan.head.getWorldPosition(tmpV); lookGoal.set(hp.x, hp.y + .05, hp.z); }
      if (faceAt >= 0 && lookName === "opponent"){ const hp = opp.head.getWorldPosition(tmpV); lookGoal.set(hp.x, hp.y + .1, hp.z); }
      lookCur.lerp(lookGoal, .05); tgt.copy(lookCur); tgt.x += Math.sin(s*1.3)*.08*(1 - fk*.7); tgt.y += Math.sin(s*1.1)*.06*(1 - fk*.7); cam.lookAt(tgt);
      // Le cameraman s'approche de toi, tourne autour, puis filme le face-à-face de profil
      // Cameraman face à toi : il avance, recule, ré-avance, en se décalant un peu, comme en vrai
      const cmk = ease(ck/3.5), prevZ = camMan.g.position.z, prevX = camMan.g.position.x;
      if (faceAt < 0){
        const wz = 1.85 - .8*Math.sin(ck*.62) - .2*Math.sin(ck*1.37), wx = .22 + .38*Math.sin(ck*.33) + .08*Math.sin(ck*1.1);
        tmpV.set(wx, .905, wz); lerpV(camMan.g.position, CAM0, tmpV, cmk);
        camMan.g.position.lerp(tmpV, cmk*.12);
        faceTo(camMan.g, cam.position.x, cam.position.z, .15);
      } else { camMan.g.position.lerp(CAM2, .03); faceTo(camMan.g, 0, -2.4, .06); }
      const spd = Math.hypot(camMan.g.position.z - prevZ, camMan.g.position.x - prevX)*60, back = (camMan.g.position.z - prevZ) < 0 ? -1 : 1;
      camStep += spd*.016*6*back; walkCycle(camMan, camStep, clamp(spd*1.4)); camMan.g.rotation.x = -back*clamp(spd)*.04;
      camMan.g.position.y = .905 + Math.abs(Math.sin(s*7))*.01;
      if (faceAt >= 0){ lerpV(opp.g.position, OPP0, OPP1, fk); spk.g.position.lerp(SPK1, .025); ref.g.position.lerp(REF1, .03); faceTo(ref.g, -.3, -1, .08);
        ref.shL.rotation.set(-1.5, 0, .2); ref.shR.rotation.set(-1.5, 0, -.2); ref.elL.rotation.x = -.2; ref.elR.rotation.x = -.2; walkCycle(ref, s*7, ref.g.position.distanceTo(REF1) > .15 ? 1 : 0); }
      if (faceAt >= 0){ faceTo(spk.g, cam.position.x, cam.position.z, .05); walkCycle(spk, s*6, spk.g.position.distanceTo(SPK1) > .2 ? 1 : 0); }
      if (faceAt < 0) faceTo(ref.g, 0, 0, .05);
    }
    gloveUp += (gloveGoal - gloveUp)*.08; glovesG.visible = mode === "cage";
    glovesG.position.y = -.3 + gloveUp*.36 + Math.sin(s*2.2)*.008;
    glovesG.children.forEach((gl, i)=>{ gl.rotation.x = .25 - gloveUp*.5; gl.position.z = -.8 + (faceAt >= 0 ? Math.max(0, Math.sin(s*3 + i*2))*.04 : 0); });
    // Adversaire : garde, sautille, roule des épaules, bouge la tête
    const ob = Math.abs(Math.sin(s*3.2));
    if (faceAt < 0) opp.g.position.y = .905 + ob*.035; else opp.g.position.y = .905 + ob*.015;
    opp.g.rotation.y = faceAt >= 0 ? Math.atan2(cam.position.x - opp.g.position.x, cam.position.z - opp.g.position.z) : Math.sin(s*.7)*.12;
    opp.shR.rotation.x = -.45 + Math.sin(s*3.2)*.06; opp.shL.rotation.x = -.55 + Math.sin(s*3.2 + 1)*.05; opp.head.rotation.y = Math.sin(s*1.3)*.15; opp.head.rotation.x = faceAt >= 0 ? .12 : Math.sin(s*1.1)*.05; opp.neck.rotation.z = Math.sin(s*1.6)*.04;
    opp.hipL.rotation.x = -.12 + ob*.05; opp.hipR.rotation.x = .1 - ob*.05;
    // Speaker : micro devant la bouche, l'autre bras qui accompagne la voix
    // Speaker : vrais gestes d'annonceur — il se tourne vers chaque côté du public, pointe les combattants,
    // lève le poing, se penche en arrière sur les grandes phrases et fait son demi-tour signature sur le nom
    talkK += ((faceAt >= 0 ? 0 : 1) - talkK)*.05;
    if (mode === "cage" && faceAt < 0){
      const sa = s - spkAt, inK = ease(sa/.35), DUR = {point:2.6, raise:2.2, lean:2.6, turn:3.2, spin:1.1, sweep:2.8}[spkAct] || 0;
      if (DUR && sa > DUR){ if (spkAct === "spin"){ spkAct = "point"; spkTgt = "me"; spkAt = s; } else spkAct = "talk"; }
      const outK = DUR ? clamp((DUR - sa)/.45) : 1, k = Math.min(inK, outK);
      const tgtXZ = n => n === "opp" ? [opp.g.position.x, opp.g.position.z] : n === "crowdL" ? [-12, -1] : n === "crowdR" ? [12, -1] : n === "crowdB" ? [0, -14] : [cam.position.x, cam.position.z];
      // bras gauche : gestes de la main libre ; bras droit : micro à la bouche
      let lx = -.55 - Math.sin(s*1.7)*.35, lz = .3 + Math.sin(s*1.1)*.18, le = -.75 - Math.sin(s*2.3)*.35, lean = 0, rise = 0, face = null, mx = -1.25, me2 = -1.45;
      if (spkAct === "talk"){ const ph = Math.floor((s - cageAt)/3.6) % 4; face = ["me","crowdL","me","crowdR"][ph]; }
      else if (spkAct === "point"){ face = spkTgt; lx += (-1.5 - lx)*k; lz += (.06 - lz)*k; le += (-.05 - le)*k; lean = .04*k; }
      else if (spkAct === "raise"){ face = "me"; lx += (-2.95 - lx)*k; lz += (.22 - lz)*k; le += (-.15 - le)*k; rise = .035*k; mx = -1.45; }
      else if (spkAct === "lean"){ face = "me"; lx += (-.35 - lx)*k; lz += (1.25 - lz)*k; le += (-.2 - le)*k; lean = -.085*k; mx = -1.55; me2 = -1.55; }
      else if (spkAct === "turn"){ face = spkTgt; lx += (-1.1 - lx)*k; lz += (.7 + Math.sin(s*2)*.25 - lz)*k; le += (-.4 - le)*k; }
      else if (spkAct === "sweep"){ const a = -1 + 2*clamp(sa/DUR); const tx = Math.sin(a*1.2)*12, tz = -Math.cos(a*1.2)*10; faceTo(spk.g, tx, tz, .06); lx += (-1.35 - lx)*k; lz += (.55 - lz)*k; le += (-.1 - le)*k; }
      else if (spkAct === "spin"){ spk.g.rotation.y = spkRot0 + Math.PI*2*ease(sa/DUR); lx += (-.25 - lx)*inK; lz += (1.35 - lz)*inK; le += (-.05 - le)*inK; rise = .02; }
      if (face){ const [fx2, fz2] = tgtXZ(face), before = spk.g.rotation.y; faceTo(spk.g, fx2, fz2, .07); spkStep += Math.abs(spk.g.rotation.y - before)*14; }
      walkCycle(spk, spkStep, clamp(Math.abs(Math.sin(spkStep))*.35));
      spk.g.rotation.x = lean; spk.g.position.y = .905 + rise;
      spk.shL.rotation.set(lx, 0, lz); spk.elL.rotation.x = le;
      spk.shR.rotation.set(mx - Math.sin(s*2.4)*.05, 0, -.1); spk.elR.rotation.x = me2;
      spk.head.rotation.x = Math.sin(s*2.5)*.05 - .05 + (spkAct === "lean" ? -.25*k : 0); spk.head.rotation.y = Math.sin(s*.9)*.1;
    } else {
      spk.g.rotation.x = 0;
      spk.shR.rotation.set(-1.25*talkK - .05, 0, -.1); spk.elR.rotation.x = -1.45*talkK - .2; spk.shL.rotation.set(-.6 - Math.sin(s*1.7)*.4*talkK, 0, .3 + Math.sin(s*1.1)*.2*talkK); spk.elL.rotation.x = -.7 - Math.sin(s*2.3)*.3*talkK;
      spk.head.rotation.x = Math.sin(s*2.5)*.05*talkK - .05;
    }
    coach.elL.rotation.x = -1.2 + Math.sin(s*2)*.3;
    camLight.position.set(cam.position.x, cam.position.y + 1.2, cam.position.z - (mode === "walk" ? 1.5 : .8)); camLight.intensity = mode === "walk" ? (cam.position.z > 86 ? 42 : cam.position.z > 62 ? 45 : 40) : 34;
    flashK *= .9; roarK *= .975;
    const show = clamp(.75 + lvl*.6 + roarK*.8 + flashK*2, 0, 3);
    beams.forEach(([b, i, m, sp, a])=>{
      if (i < 10){ b.rotation.z = Math.sin(s*(.6 + roarK*1.2) + i*1.3)*.5; b.rotation.x = Math.cos(s*.45 + i)*.35; }
      else { b.rotation.z = Math.sin(s*1.1 + i)*.6 + Math.cos(a)*.35; b.rotation.x = Math.cos(s*.9 + i*.7)*.6 - Math.sin(a)*.35; }
      m.material.uniforms.k.value = show; sp.material.opacity = clamp(.4 + show*.35); });
    lasers.forEach(([l, b, i])=>{ l.rotation.z = (b ? -1 : 1)*(.35 + i*.16) + Math.sin(s*1.4 + i*.4)*.22; l.rotation.x = -1.2 + Math.sin(s*.8 + b)*.3; });
    laserM.opacity = clamp(.06 + lvl*.16 + roarK*.3, 0, .45);
    phM.opacity = .55 + Math.sin(s*9)*.25;
    tmpC.setHSL(tintC ? tmpC.copy(tintC).getHSL({}).h : 0, 1, .35 + lvl*.25); ledMat.color.copy(tmpC); ledRingM.color.copy(tmpC);
    [redL, redR, blue].forEach((L, i)=>L.color.lerp(tintC || base[i], .05));
    redL.intensity = (190 + Math.sin(s*3.2)*60 + lvl*120)*(1 + flashK*2); redR.intensity = (190 + Math.cos(s*2.7)*60 + lvl*120)*(1 + flashK*2); blue.intensity = 140 + lvl*60;
    cageSpot.intensity = 320*(1 + flashK*1.5); renderer.toneMappingExposure = 1.15 + flashK*.9;
    // Pyro
    const pt = s - pyroAt, pOn = pt >= 0 && pt < 3.2;
    pyroPts.visible = pOn; flames.forEach((f, j)=>{ const near = j < 2 ? mode === "walk" : true; f.visible = pOn && pt < 1.3 && near; f.scale.set(1.5 + Math.random()*.4, 3.5 + Math.random()*1.5, 1); f.position.y = 1.8 + Math.random()*.3; });
    if (pOn){ for (let j=0;j<JETS.length;j++) for (let i=0;i<PN;i++){ const q = (j*PN + i)*3, sd = pyroSeed[q], life = (pt*1.6 + sd) % 1, emit = pt < 1.4 || life > (pt - 1.4)*1.6;
      const vx = (pyroSeed[q+1] - .5)*2.2, vz = (pyroSeed[q+2] - .5)*2.2, vy = 9 + sd*5, tt = life*1.4;
      pyroPos[q] = JETS[j][0] + vx*tt; pyroPos[q+1] = emit ? vy*tt - 6*tt*tt : -50; pyroPos[q+2] = JETS[j][2] + vz*tt; } pyroG.attributes.position.needsUpdate = true; }
    cube.rotation.y = s*.12; ringT.offset.x = -s*.05; scrGlow.intensity = 50 + lvl*40;
    const anim = ov && ov.kind && s - ovAt < 4.5, si = Math.floor(s*(anim ? 24 : 7)); if (si !== lastScr){ lastScr = si; drawScreen(s); }
    if (o.onProgress) o.onProgress(t, cam.position.z);
    renderer.render(scene, cam);
  }
  window.addEventListener("resize", size);
  raf = requestAnimationFrame(frame);
  return {
    stop(){ stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
      scene.traverse(x=>{ if (x.geometry) x.geometry.dispose(); if (x.material){ (Array.isArray(x.material) ? x.material : [x.material]).forEach(m=>{ if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose(); try{ renderer.forceContextLoss(); }catch(e){} },
    cage(){ if (mode === "walk"){ mode = "cage"; cageAt = sNow; lookCur.set(-.3, 2.55, -4.6); } },
    look(name){ lookName = typeof name === "string" ? name : ""; const p = TARGETS[name] || name; if (p) lookGoal.set(p[0], p[1], p[2]); },
    tint(hex){ tintC = hex == null ? null : new THREE.Color(hex); },
    flash(){ flashK = 1; },
    roar(){ roarK = 1; flashK = Math.max(flashK, .6); },
    gloves(up){ gloveGoal = up ? 1 : 0; },
    screen(d){ ov = d || null; ovAt = sNow; lastScr = -1; },
    pyro(){ pyroAt = sNow; },
    speaker(a){ const [act, t] = String(a || "talk").split(":"); spkAct = act; spkTgt = t || "me"; spkAt = sNow; spkRot0 = spk.g.rotation.y; },
    faceoff(){ if (faceAt < 0){ faceAt = sNow; gloveGoal = 1; lookName = "opponent"; } },
    level(fn){ levelFn = typeof fn === "function" ? fn : null; },
    get inCage(){ return mode === "cage"; }
  };
}
