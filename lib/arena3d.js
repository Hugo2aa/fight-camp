// Fight Night en 3D : vestiaire -> couloir -> allée -> cage, puis l'annonce dans la cage face à l'adversaire et au speaker.
import * as THREE from "./three.module.min.js";

const smooth = t => t*t*(3-2*t);
const clamp = (x, a=0, b=1) => Math.min(b, Math.max(a, x));
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
  const P = (seg < 10 ? [V(0,.9),V(.16,.92),V(.16,1.1),V(.2,1.32),V(.17,1.45),V(.07,1.51),V(0,1.52)] : [V(0,.9),V(.15,.9),V(.17,.95),V(.155,1.06),V(.165,1.16),V(.19,1.28),V(.2,1.36),V(.185,1.43),V(.13,1.48),V(.07,1.51),V(0,1.52)]).map(p=>V(p.x*scale, p.y));
  const g = new THREE.LatheGeometry(P, seg); g.scale(1, 1, flat); g.computeVertexNormals(); return g; }
function limbGeo(r1, r2, len, seg=10){ const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1); g.translate(0, -len/2, 0); return g; }
const sph = (r, x, y, z, sx=1, sy=1, sz=1) => { const g = new THREE.SphereGeometry(r, 12, 10); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
function at(g, x, y, z, rx=0, ry=0, rz=0){ const h = g.clone(); h.rotateX(rx); h.rotateY(ry); h.rotateZ(rz); h.translate(x, y, z); return h; }

// Public en basse définition : des milliers de personnes, il faut peu de triangles par personne
const lsph = (r, x, y, z, sx=1, sy=1, sz=1) => { const g = new THREE.SphereGeometry(r, 7, 5); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
function crowdGeos(kind){
  const T = torsoGeo(1, .62, 7), clothes = [T, at(limbGeo(.11, .1, .55, 5), .09, .9, 0), at(limbGeo(.11, .1, .55, 5), -.09, .9, 0)], skin = [lsph(.105, 0, 1.66, .01, 1, 1.15, 1.05)];
  const arm = (side, up) => {
    if (up){ clothes.push(at(limbGeo(.055, .045, .56, 5), side*.21, 1.43, 0, 0, 0, side*2.85)); skin.push(lsph(.045, side*.31, 1.98, 0)); }
    else { clothes.push(at(limbGeo(.055, .045, .56, 5), side*.21, 1.43, .02, -.12, 0, side*.1)); skin.push(lsph(.042, side*.26, .87, .07)); } };
  if (kind === 0){ arm(-1, false); arm(1, false); } else if (kind === 1){ arm(-1, true); arm(1, true); } else { arm(-1, false); arm(1, true); }
  return [merge(clothes), merge(skin)];
}

function makeHuman(opt){
  const skinM = new THREE.MeshStandardMaterial({color: opt.skin || 0x8a5a44, roughness:.55});
  const topM = new THREE.MeshStandardMaterial({color: opt.top ?? 0x111111, roughness:.7});
  const botM = new THREE.MeshStandardMaterial({color: opt.bottom ?? 0x111111, roughness:.7});
  const shoeM = new THREE.MeshStandardMaterial({color: opt.shoes ?? 0x0a0a0a, roughness:.5});
  const g = new THREE.Group(), suit = !!opt.suit, bare = !suit && opt.topless, B = opt.build || 1.05;
  g.add(new THREE.Mesh(torsoGeo(B, .64, 20), bare ? skinM : topM));
  if (bare) g.add(new THREE.Mesh(merge([sph(.085, .075, 1.33, .085, 1, .7, .55), sph(.085, -.075, 1.33, .085, 1, .7, .55)]), skinM));
  if (suit){ const shirt = new THREE.Mesh(new THREE.PlaneGeometry(.1, .2), new THREE.MeshStandardMaterial({color:0xf2f2f2})); shirt.position.set(0, 1.38, .125); g.add(shirt);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(.07, .03, .02), new THREE.MeshStandardMaterial({color:0x111111})); tie.position.set(0, 1.46, .13); g.add(tie); }
  const neck = new THREE.Mesh(limbGeo(.058, .055, .14, 12), skinM); neck.position.y = 1.62; g.add(neck);
  const head = new THREE.Group(); head.position.y = 1.62; g.add(head);
  head.add(new THREE.Mesh(merge([sph(.108, 0, .12, 0, .95, 1.12, 1.05), sph(.075, 0, .05, .035, 1, .9, 1)]), skinM));
  if (opt.hair) head.add(new THREE.Mesh(sph(.112, 0, .16, -.01, .97, .8, 1.06), new THREE.MeshStandardMaterial({color:opt.hair, roughness:.9})));
  const parts = {g, head};
  ["L","R"].forEach((k, i)=>{ const s = i ? -1 : 1;
    const sh = new THREE.Group(); sh.position.set(s*.205*B, 1.43, 0); g.add(sh);
    sh.add(new THREE.Mesh(sph(.075, 0, 0, 0, 1, .9, .9), bare ? skinM : topM));
    sh.add(new THREE.Mesh(limbGeo(.058, .046, .29, 12), bare ? skinM : topM));
    const el = new THREE.Group(); el.position.y = -.29; sh.add(el);
    el.add(new THREE.Mesh(limbGeo(.047, .037, .26, 12), bare ? skinM : topM));
    const hand = new THREE.Group(); hand.position.y = -.27; el.add(hand);
    if (opt.gloves) hand.add(new THREE.Mesh(sph(.072, 0, -.04, .01, 1, 1.2, 1.15), new THREE.MeshStandardMaterial({color:opt.gloves, roughness:.35})));
    else hand.add(new THREE.Mesh(sph(.042, 0, -.035, 0, .8, 1.2, .55), skinM));
    const hip = new THREE.Group(); hip.position.set(s*.095, .92, 0); g.add(hip);
    hip.add(new THREE.Mesh(limbGeo(.088, .062, .43, 12), opt.shorts ? skinM : botM));
    if (opt.shorts){ const sh2 = new THREE.Mesh(limbGeo(.1, .095, .22, 12), new THREE.MeshStandardMaterial({color:opt.shorts, roughness:.6})); sh2.position.y = -.02; hip.add(sh2); }
    const kn = new THREE.Group(); kn.position.y = -.43; hip.add(kn);
    kn.add(new THREE.Mesh(merge([limbGeo(.06, .038, .42, 12), sph(.055, 0, -.12, -.02, 1, 1.6, 1)]), opt.shorts ? skinM : botM));
    const ft = new THREE.Mesh(new THREE.BoxGeometry(.085, .06, .24), opt.barefoot ? skinM : shoeM); ft.position.set(0, -.44, .06); kn.add(ft);
    parts["sh"+k] = sh; parts["el"+k] = el; parts["hip"+k] = hip; parts["kn"+k] = kn; parts["hand"+k] = hand; });
  if (opt.shorts){ const belt = new THREE.Mesh(new THREE.CylinderGeometry(.175, .175, .12, 20, 1, true), new THREE.MeshStandardMaterial({color:opt.shorts, roughness:.6, side:THREE.DoubleSide})); belt.scale.z = .66; belt.position.y = .95; g.add(belt); }
  return parts;
}
function guardPose(p){ p.shL.rotation.set(-.55, 0, .22); p.elL.rotation.set(-2.1, 0, 0); p.shR.rotation.set(-.45, 0, -.25); p.elR.rotation.set(-2.2, 0, 0);
  p.hipL.rotation.x = -.12; p.knL.rotation.x = .2; p.hipR.rotation.x = .1; p.knR.rotation.x = .18; }

export function startArena(canvas, o = {}){
  const D = o.duration || 30, r = rnd(11);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:"high-performance"});
  const mobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent), maxPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.4);
  let pr = Math.min(maxPR, mobile ? 1 : 1.25); renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040203); scene.fog = new THREE.FogExp2(0x070406, .015);
  const cam = new THREE.PerspectiveCamera(64, 1, .05, 400); scene.add(cam);
  const size = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); }; size();
  const uTime = {value:0}, std = (c, ro=.8, me=0) => ro >= .7 && !me ? new THREE.MeshLambertMaterial({color:c}) : new THREE.MeshStandardMaterial({color:c, roughness:ro, metalness:me});
  const add = (geo, mat, x, y, z, ry=0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };

  scene.add(new THREE.HemisphereLight(0x4a3035, 0x060304, .5));
  const cageSpot = new THREE.SpotLight(0xffffff, 300, 60, .55, .5, 1.4); cageSpot.position.set(0, 26, 0); cageSpot.target.position.set(0, 0, 0); scene.add(cageSpot, cageSpot.target);
  // Une seule lumière chaude qui suit la caméra : vestiaire, couloir, allée, puis l'adversaire et le speaker
  const camLight = new THREE.PointLight(0xffe2c8, 70, 16, 1.4); scene.add(camLight);
  const redL = new THREE.PointLight(0xd7262e, 240, 70, 1.6); redL.position.set(-18, 14, 30); scene.add(redL);
  const redR = new THREE.PointLight(0xd7262e, 240, 70, 1.6); redR.position.set(18, 14, 30); scene.add(redR);
  const blue = new THREE.PointLight(0x3a6dff, 110, 80, 1.6); blue.position.set(0, 18, -24); scene.add(blue);

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
  const coach = makeHuman({skin:0x6b4a3a, top:0x141414, bottom:0x1a1a1a, hair:0x111111, build:1.1}); coach.g.position.set(1.6, 0, 89.2); coach.g.rotation.y = -2.3; coach.shL.rotation.set(-.3, 0, .1); coach.elL.rotation.x = -1.2; scene.add(coach.g);

  // Couloir
  const concrete = tex(256, 256, (g,w)=>{ g.fillStyle = "#1d1b1c"; g.fillRect(0,0,w,w); for (let i=0;i<2500;i++){ const v = 20 + Math.random()*25; g.fillStyle = `rgb(${v},${v-2},${v-1})`; g.fillRect(Math.random()*w, Math.random()*w, 2, 2); } g.fillStyle = "rgba(120,10,15,.6)"; g.fillRect(0, 150, w, 14); });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(8, 1);
  const tunM = new THREE.MeshStandardMaterial({map:concrete, roughness:.9});
  add(new THREE.BoxGeometry(.3, 3.6, 24), tunM, -2.1, 1.8, 74); add(new THREE.BoxGeometry(.3, 3.6, 24), tunM, 2.1, 1.8, 74);
  add(new THREE.BoxGeometry(4.5, .3, 24), std(0x0c0b0b), 0, 3.6, 74); add(new THREE.BoxGeometry(4.2, .1, 24), std(0x141213, .4, .2), 0, -.04, 74);
  for (let i=0;i<8;i++) add(new THREE.BoxGeometry(1.4, .05, .3), new THREE.MeshBasicMaterial({color:0xffe6cc}), 0, 3.42, 64 + i*3);
  // mur de salle autour de la sortie du couloir
  [-21.6, 21.6].forEach(x=>add(new THREE.BoxGeometry(39, 16, .4), std(0x0b0708, .9), x, 8, 62)); add(new THREE.BoxGeometry(4.2, 12.4, .4), std(0x0b0708, .9), 0, 9.8, 62);
  const exitSign = tex(512, 128, (g,w,h)=>{ g.fillStyle = "#0a0a0a"; g.fillRect(0,0,w,h); g.fillStyle = "#d7262e"; g.font = "bold 76px Impact, Anton, sans-serif"; g.textAlign = "center"; g.fillText("FIGHT NIGHT", w/2, 92); });
  add(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({map:exitSign, toneMapped:false}), 0, 4.4, 61.78, 0);

  // Salle
  add(new THREE.PlaneGeometry(260, 260), std(0x0b0809, .85), 0, 0, 0).rotation.x = -Math.PI/2;
  const aisle = add(new THREE.PlaneGeometry(3.2, 54), std(0x151012, .55, .05), 0, .012, 35); aisle.rotation.x = -Math.PI/2;
  const ledMat = new THREE.MeshBasicMaterial({color:0xff2a32});
  [-1.62, 1.62].forEach(x=>add(new THREE.BoxGeometry(.06, .04, 54), ledMat, x, .03, 35));
  [-2.3, 2.3].forEach(x=>{ add(new THREE.BoxGeometry(.18, 1.05, 46), std(0x0e0a0b, .6), x, .52, 35); add(new THREE.BoxGeometry(.2, .03, 46), new THREE.MeshBasicMaterial({color:0x6a1015}), x, 1.06, 35); });
  const standM = std(0x0d090a, .9);
  for (let side of [-1,1]){ const w = 13*.82, h = 13*.42, slope = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w, h), .3, 48), standM); slope.position.set(side*(3.1 + w/2), h/2 - .25, 34.5); slope.rotation.z = side*Math.atan2(h, w); scene.add(slope);
    add(new THREE.BoxGeometry(.4, h + 3, 48), standM, side*(3.5 + w), (h + 3)/2, 34.5); }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(40.5, 15.2, 11, 64, 1, true), new THREE.MeshStandardMaterial({color:0x0d090a, roughness:.9, side:THREE.DoubleSide})); bowl.position.y = 5.2; scene.add(bowl);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 24, 64, 1, true), new THREE.MeshStandardMaterial({color:0x080506, roughness:.9, side:THREE.BackSide})); outer.position.y = 12; scene.add(outer);
  [[-1.95, 52],[1.95, 44],[-1.95, 34],[1.95, 24],[-1.95, 16],[1.95, 70],[-1.6, 78]].forEach(([x,z])=>{ const p = makeHuman({skin:0x5a3c2e, top:0x0a0a0a, bottom:0x0a0a0a, hair:0x0a0a0a, build:1.12}); p.g.position.set(x, 0, z); p.g.rotation.y = x < 0 ? Math.PI/2 : -Math.PI/2; p.shL.rotation.z = .12; p.shR.rotation.z = -.12; p.elL.rotation.x = -.5; p.elR.rotation.x = -.5; scene.add(p.g); });

  // Public
  const spots = [];
  for (let side of [-1, 1]) for (let row=0; row<13; row++) for (let z=11; z<58; z+=.82) spots.push([side*(3.1 + row*.82) + (r()-.5)*.22, row*.42, z + (r()-.5)*.28, 0]);
  for (let ring=0; ring<18; ring++){ const R = 15.6 + ring*1.25, n = Math.floor(2*Math.PI*R/.92);
    for (let i=0;i<n;i++){ const a = i/n*Math.PI*2, x = Math.sin(a)*R, z = Math.cos(a)*R; if (z > 10 && Math.abs(x) < 14) continue; spots.push([x + (r()-.5)*.2, ring*.55, z + (r()-.5)*.2, 1]); } }
  const groups = [[],[],[]]; spots.forEach(s=>{ const k = r(); groups[k < .6 ? 0 : k < .85 ? 1 : 2].push(s); });
  function crowdMat(){ const m = new THREE.MeshLambertMaterial({color:0xffffff});
    m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime;
      sh.vertexShader = "attribute float aPhase; attribute float aEnergy; uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n float j = max(0.0, sin(uTime*6.5 + aPhase)) * 0.24 * aEnergy + sin(uTime*1.8 + aPhase)*0.03; transformed.y += j; transformed.x += sin(uTime*1.2 + aPhase)*0.04;"); };
    return m; }
  const cMat = crowdMat(), sMat = crowdMat(), dummy = new THREE.Object3D(), col = new THREE.Color();
  const SHIRTS = [[.03,.03,.035],[.05,.05,.06],[.02,.02,.02],[.35,.03,.04],[.6,.6,.62],[.06,.08,.16],[.12,.1,.08],[.2,.2,.22]];
  groups.forEach((list, k)=>{ if (!list.length) return; const [cg, sg] = crowdGeos(k), N = list.length;
    const ph = new Float32Array(N), en = new Float32Array(N); for (let i=0;i<N;i++){ ph[i] = r()*6.28; en[i] = k ? .8 + r()*.4 : (r() < .3 ? 1 : r()*.35); }
    const cm = new THREE.InstancedMesh(cg, cMat, N), sm = new THREE.InstancedMesh(sg, sMat, N);
    list.forEach(([x,y,z,b], i)=>{ dummy.position.set(x, y, z); if (b) dummy.lookAt(0, y, 0); else dummy.lookAt(0, y, z); dummy.rotateY((r()-.5)*.5); dummy.scale.setScalar(.9 + r()*.18); dummy.updateMatrix();
      cm.setMatrixAt(i, dummy.matrix); sm.setMatrixAt(i, dummy.matrix);
      const s = SHIRTS[Math.floor(r()*SHIRTS.length)]; col.setRGB(s[0]*(.8+r()*.4), s[1]*(.8+r()*.4), s[2]*(.8+r()*.4)); cm.setColorAt(i, col);
      const t = .1 + r()*.45; col.setRGB(t*1.25, t*.92, t*.75); sm.setColorAt(i, col); });
    [cm, sm].forEach(m=>{ m.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1)); m.geometry.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(en, 1)); scene.add(m); }); });
  const PH = 700, php = new Float32Array(PH*3); for (let i=0;i<PH;i++){ const s = spots[Math.floor(r()*spots.length)]; php.set([s[0], s[1] + 1.95, s[2]], i*3); }
  const phG = new THREE.BufferGeometry(); phG.setAttribute("position", new THREE.BufferAttribute(php, 3));
  const dot = tex(64, 64, (g,w)=>{ const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.25,"rgba(255,250,235,.7)"); gr.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0,0,w,w); });
  const phM = new THREE.PointsMaterial({size:.5, map:dot, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:0xfff6e8}); scene.add(new THREE.Points(phG, phM));

  // Faisceaux
  const beamMat = c => new THREE.ShaderMaterial({transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, uniforms:{c:{value:new THREE.Color(c)}, k:{value:1}},
    vertexShader:"varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"uniform vec3 c; uniform float k; varying float vY; void main(){ gl_FragColor = vec4(c, pow(vY, 2.2)*0.15*k); }"});
  const beams = [];
  [[-9, 0xffffff], [-3, 0xff3a3a], [3, 0xffffff], [9, 0x4a7dff]].forEach(([x, c], i)=>{
    const g = new THREE.ConeGeometry(3.4, 34, 16, 1, true); g.translate(0, -17, 0); const piv = new THREE.Object3D(); piv.position.set(x, 32, 6 + (i%3)*10); const m = new THREE.Mesh(g, beamMat(c)); piv.add(m); scene.add(piv); beams.push([piv, i, m]); });

  // Cage
  const cage = new THREE.Group(); scene.add(cage);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(7.75, 8, .9, 8), std(0x111111, .6)); apron.rotation.y = Math.PI/8; apron.position.y = .45; cage.add(apron);
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
  for (let i=0;i<16;i++){ const lamp = new THREE.Mesh(new THREE.CircleGeometry(.33, 16), new THREE.MeshBasicMaterial({color:0xffffff})); lamp.rotation.x = Math.PI/2; lamp.position.set(-5.4 + (i%4)*3.6, 19.31, -5.4 + Math.floor(i/4)*3.6); cage.add(lamp); }

  // Adversaire et speaker
  const opp = makeHuman({skin: 0x7a4f3a, topless:true, shorts: o.oppColor || 0x1f4fb4, gloves: o.oppColor || 0x1f4fb4, barefoot:true, hair:0x120c08, build:1.12});
  opp.g.position.set(-.3, .905, -4.6); guardPose(opp); scene.add(opp.g);
  const spk = makeHuman({skin:0xb58466, suit:true, top:0x0c0c0c, bottom:0x0c0c0c, hair:0x2a2420, build:1.05});
  spk.g.position.set(.7, .905, -.6); spk.g.rotation.y = .5; spk.shR.rotation.set(-1.25, 0, -.1); spk.elR.rotation.x = -1.4; spk.shL.rotation.set(.1, 0, .25); spk.elL.rotation.x = -.6; scene.add(spk.g);
  const mic = new THREE.Mesh(merge([new THREE.CylinderGeometry(.018, .013, .2, 10), sph(.03, 0, .11, 0)]), std(0x111111, .3, .7)); mic.position.set(0, -.08, .03); mic.rotation.x = -1.2; spk.handR.add(mic);

  // Écran géant
  const SW = 768, SH = 384, sc2 = document.createElement("canvas"); sc2.width = SW; sc2.height = SH; const sx = sc2.getContext("2d");
  const scrT = new THREE.CanvasTexture(sc2); scrT.colorSpace = THREE.SRGBColorSpace;
  const led = document.createElement("canvas"); led.width = 8; led.height = 8; { const l = led.getContext("2d"); l.fillStyle = "rgba(0,0,0,.35)"; l.fillRect(0,0,8,8); l.clearRect(1,1,6,6); }
  const ledPat = sx.createPattern(led, "repeat");
  let screenOverride = null, overrideAt = 0;
  function drawScreen(s){
    const SW = 1024, SH = 512; sx.setTransform(sc2.width/SW, 0, 0, sc2.width/SW, 0, 0);
    const ov = screenOverride, phase = Math.floor(s/3.2) % 3, k = ov ? Math.min(1, (s - overrideAt)/3.2) : (s % 3.2)/3.2;
    const gr = sx.createLinearGradient(0,0,SW,SH); const c0 = ov && ov.color || "#3a0509"; gr.addColorStop(0,c0); gr.addColorStop(.5,"#0c0203"); gr.addColorStop(1,c0); sx.fillStyle = gr; sx.fillRect(0,0,SW,SH);
    sx.save(); sx.globalAlpha = .22; sx.strokeStyle = ov && ov.accent || "#d7262e"; sx.lineWidth = 3; for (let i=-6;i<12;i++){ const x = ((i*120 + s*160) % (SW+240)) - 120; sx.beginPath(); sx.moveTo(x,0); sx.lineTo(x+240,SH); sx.stroke(); } sx.restore();
    sx.textAlign = "center"; sx.textBaseline = "middle"; const pop = 1 + Math.max(0, .25 - k)*1.2;
    const fit = (t, max, font) => { let f = max; sx.font = font.replace("%", f); while (sx.measureText(t).width > SW*.88/pop && f > 40){ f -= 6; sx.font = font.replace("%", f); } };
    sx.save(); sx.translate(SW/2, SH/2); sx.scale(pop, pop);
    if (ov){ sx.fillStyle = ov.accent || "#d9a43a"; sx.font = "600 46px Arial"; sx.fillText((ov.top || "").toUpperCase(), 0, -150);
      const big = (ov.big || "").toUpperCase(); sx.fillStyle = "#fff"; fit(big, 180, "bold %px Impact, Anton, sans-serif"); sx.fillText(big, 0, 10);
      if (ov.sub){ sx.fillStyle = "#ddd"; sx.font = "italic 600 50px Arial"; sx.fillText(ov.sub, 0, 150); } }
    else if (phase === 0){ sx.fillStyle = "#d9a43a"; sx.font = "600 48px Arial"; sx.fillText((o.top || "MAIN EVENT").toUpperCase(), 0, -150);
      const nm = (o.name || "").toUpperCase(); sx.fillStyle = "#fff"; fit(nm, 190, "bold %px Impact, Anton, sans-serif"); sx.fillText(nm, 0, 10);
      if (o.nick){ sx.fillStyle = "#8fc4ff"; sx.font = "italic 600 58px Arial"; sx.fillText("« " + o.nick + " »", 0, 150); } }
    else if (phase === 1){ sx.fillStyle = "#d9a43a"; sx.font = "600 48px Arial"; sx.fillText("PALMARÈS", 0, -150); sx.fillStyle = "#fff"; fit(o.record || "0-0-0", 200, "bold %px Impact, Anton, sans-serif"); sx.fillText(o.record || "0-0-0", 0, 20);
      sx.fillStyle = "#ccc"; sx.font = "600 44px Arial"; sx.fillText((o.rank || "").toUpperCase(), 0, 160); }
    else { sx.fillStyle = "#fff"; sx.font = "bold 150px Impact, Anton, sans-serif"; sx.fillText("FIGHT", 0, -70); sx.fillStyle = "#d7262e"; sx.fillText("CAMP", 0, 90); }
    sx.restore(); sx.fillStyle = ledPat; sx.fillRect(0,0,SW,SH); sx.strokeStyle = ov && ov.accent || "#d7262e"; sx.lineWidth = 10; sx.strokeRect(5,5,SW-10,SH-10); scrT.needsUpdate = true;
  }
  drawScreen(0);
  const cube = new THREE.Group(); cube.position.y = 13.5; cage.add(cube);
  const frameM = std(0x050505, .4, .5);
  for (let i=0;i<4;i++){ const a = i*Math.PI/2, s = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({map:scrT, toneMapped:false})); s.position.set(Math.sin(a)*3.7, 0, Math.cos(a)*3.7); s.rotation.y = a; cube.add(s);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4, .2), frameM); fr.position.set(Math.sin(a)*3.6, 0, Math.cos(a)*3.6); fr.rotation.y = a; cube.add(fr); }
  const ringC = document.createElement("canvas"); ringC.width = 2048; ringC.height = 64; const rx = ringC.getContext("2d");
  rx.fillStyle = "#050505"; rx.fillRect(0,0,2048,64); rx.fillStyle = "#ff3a3a"; rx.font = "bold 44px Arial"; rx.textBaseline = "middle";
  const ringTxt = `FIGHT CAMP  ·  ${(o.name||"").toUpperCase()}  ·  ${o.nick ? "« " + o.nick.toUpperCase() + " »  ·  " : ""}MAIN EVENT  ·  `; let rxp = 0; while (rxp < 2048){ rx.fillText(ringTxt, rxp, 34); rxp += rx.measureText(ringTxt).width; }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace; ringT.wrapS = THREE.RepeatWrapping; ringT.repeat.set(2, 1);
  const ringM = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, .7, 48, 1, true), new THREE.MeshBasicMaterial({map:ringT, toneMapped:false, side:THREE.DoubleSide})); ringM.position.y = -2.6; cube.add(ringM);

  const wallScr = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshBasicMaterial({map:scrT, toneMapped:false})); wallScr.position.set(0, 17, -39.2); scene.add(wallScr);
  const wallFr = new THREE.Mesh(new THREE.BoxGeometry(23, 12, .4), frameM); wallFr.position.set(0, 17, -39.6); scene.add(wallFr);
  // Tes gants à la première personne
  const glovesG = new THREE.Group(); cam.add(glovesG);
  const gm = new THREE.MeshStandardMaterial({color: o.myColor || 0xc81e28, roughness:.35}), wm = new THREE.MeshStandardMaterial({color:0xeeeeee, roughness:.6});
  [[-1, -.2], [1, .2]].forEach(([s, x])=>{ const gl = new THREE.Group(); gl.add(new THREE.Mesh(sph(.075, 0, 0, 0, 1, 1.15, 1.25), gm)); const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.052, .055, .09, 14), wm); cuff.rotation.x = Math.PI/2; cuff.position.z = .1; gl.add(cuff);
    gl.position.set(x*.55, -.34, -.8); gl.rotation.set(.25, s*-.25, 0); gl.scale.setScalar(.62); glovesG.add(gl); });
  glovesG.visible = false;

  // Caméra
  const PATH = [[0,0,94.2],[0,0,90],[0,0,86],[0,0,80],[0,0,72],[0,0,62],[0,0,50],[0,0,36],[0,0,22],[0,0,12],[0,0,8.8],[0,.3,8.35],[0,.6,7.95],[0,.9,7.55],[0,.9,6.4],[0,.9,4.2]];
  const segs = []; let tot = 0; for (let i=1;i<PATH.length;i++){ const L = Math.hypot(PATH[i][0]-PATH[i-1][0], PATH[i][1]-PATH[i-1][1], PATH[i][2]-PATH[i-1][2]); segs.push(L); tot += L; }
  const pathAt = d => { let i = 0; while (i < segs.length-1 && d > segs[i]){ d -= segs[i]; i++; } const k = clamp(d/segs[i]), A = PATH[i], Bp = PATH[i+1]; return [A[0]+(Bp[0]-A[0])*k, A[1]+(Bp[1]-A[1])*k, A[2]+(Bp[2]-A[2])*k]; };
  const KEYS = [[0,-70,-6],[.04,-35,-3],[.08,45,-2],[.11,0,0],[.14,0,0],[.25,0,2],[.32,0,5],[.38,50,9],[.45,52,12],[.51,-48,9],[.58,-52,12],[.63,0,4],[.68,34,14],[.72,-28,12],[.77,0,22],[.81,0,6],[.88,0,0],[.94,0,24],[1,0,3]];
  const look = t => { let i = 0; while (i < KEYS.length-2 && KEYS[i+1][0] < t) i++; const [t0,y0,p0] = KEYS[i], [t1,y1,p1] = KEYS[i+1], k = smooth(clamp((t-t0)/(t1-t0))); return [y0 + (y1-y0)*k, p0 + (p1-p0)*k]; };
  const prog = t => { const a = clamp((t-.1)/.8); return smooth(a)*.55 + a*.45; };
  const TARGETS = {opponent:[-.3, 2.55, -4.6], speaker:[.7, 2.45, -.6], screen:[0, 12, -30], crowdL:[-18, 6, -4], crowdR:[18, 6, -4], crowd:[0, 8, -30], gloves:[0, 1.2, 2.6]};
  let mode = "walk", lookCur = new THREE.Vector3(0, 2.4, -10), lookGoal = new THREE.Vector3(-.3, 2.55, -4.6), tintC = null, flashK = 0, gloveUp = 0, gloveGoal = 0, roarK = 0;
  let start = performance.now(), raf = 0, stopped = false, lastStep = 0, lastScr = -1;
  const tgt = new THREE.Vector3(), base = [new THREE.Color(0xd7262e), new THREE.Color(0xd7262e), new THREE.Color(0x3a6dff)];
  // Qualité adaptative : si le téléphone peine, on baisse la résolution pour garder 60 images/s
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
    const s = window.__arenaS !== undefined ? window.__arenaS : (now - start)/1000, t = clamp(s/D); uTime.value = s;
    if (mode === "walk"){
      const p = pathAt(prog(t)*tot), moving = t > .1 && t < .99, f = 1.75, ph = s*f*Math.PI;
      const bob = moving ? (Math.abs(Math.sin(ph)) - .63)*.07 : 0, sway = moving ? Math.sin(ph)*.035 : 0;
      cam.position.set(p[0] + sway, 1.72 + p[1] + bob, p[2]);
      const [yaw, pitch] = look(t), jx = Math.sin(s*1.7)*.35 + Math.sin(s*3.3)*.2, jy = Math.sin(s*1.3)*.25 + (moving ? Math.abs(Math.sin(ph))*-.6 : 0);
      const ya = THREE.MathUtils.degToRad(yaw + jx), pa = THREE.MathUtils.degToRad(pitch + jy);
      tgt.set(cam.position.x - Math.sin(ya)*Math.cos(pa)*10, cam.position.y + Math.sin(pa)*10, cam.position.z - Math.cos(ya)*Math.cos(pa)*10); cam.lookAt(tgt); lookCur.copy(tgt);
      cam.rotateZ(moving ? Math.sin(ph)*.01 : 0);
      if (moving && o.onStep){ const st = Math.floor(s*f); if (st !== lastStep){ lastStep = st; o.onStep(); } }
      if (t >= 1) mode = "cage";
    } else {
      cam.position.set(Math.sin(s*.8)*.06, 2.62 + Math.sin(s*1.6)*.012, 4.2 + Math.sin(s*.5)*.05);
      lookCur.lerp(lookGoal, .045); tgt.copy(lookCur); tgt.x += Math.sin(s*1.3)*.08; tgt.y += Math.sin(s*1.1)*.06; cam.lookAt(tgt);
    }
    gloveUp += (gloveGoal - gloveUp)*.08; glovesG.visible = mode === "cage";
    glovesG.position.y = -.3 + gloveUp*.36 + Math.sin(s*2.2)*.008; glovesG.children.forEach(gl=>{ gl.rotation.x = .25 - gloveUp*.5; });
    opp.g.position.y = .905 + Math.abs(Math.sin(s*3.2))*.03; opp.g.rotation.y = Math.sin(s*.7)*.12; opp.shR.rotation.x = -.45 + Math.sin(s*3.2)*.05;
    spk.shR.rotation.x = -1.25 + Math.sin(s*2.4)*.08; spk.shL.rotation.x = .1 + Math.sin(s*1.7)*.25; spk.g.rotation.y = .5 + Math.sin(s*.45)*.35;
    coach.elL.rotation.x = -1.2 + Math.sin(s*2)*.3;
    camLight.position.set(cam.position.x, cam.position.y + 1.2, cam.position.z - (mode === "walk" ? 1.5 : .8)); camLight.intensity = mode === "walk" ? (cam.position.z > 86 ? 28 : cam.position.z > 62 ? 45 : 40) : 55;
    flashK *= .9; roarK *= .97;
    beams.forEach(([b, i, m])=>{ b.rotation.z = Math.sin(s*(.6 + roarK*1.2) + i*1.3)*.5; b.rotation.x = Math.cos(s*.45 + i)*.35; m.material.uniforms.k.value = 1 + flashK*3 + roarK; });
    phM.opacity = .55 + Math.sin(s*9)*.25; ledMat.color.setHSL(0, 1, .42 + Math.sin(s*5)*.12);
    [redL, redR, blue].forEach((L, i)=>L.color.lerp(tintC || base[i], .05));
    redL.intensity = (200 + Math.sin(s*3.2)*80)*(1 + flashK*2); redR.intensity = (200 + Math.cos(s*2.7)*80)*(1 + flashK*2); cageSpot.intensity = 300*(1 + flashK*1.5);
    cube.rotation.y = s*.12; ringT.offset.x = -s*.05;
    const si = Math.floor(s*7); if (si !== lastScr){ lastScr = si; drawScreen(s); }
    if (o.onProgress) o.onProgress(t, cam.position.z);
    renderer.render(scene, cam);
  }
  window.addEventListener("resize", size);
  raf = requestAnimationFrame(frame);
  return {
    stop(){ stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
      scene.traverse(x=>{ if (x.geometry) x.geometry.dispose(); if (x.material){ (Array.isArray(x.material) ? x.material : [x.material]).forEach(m=>{ if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose(); try{ renderer.forceContextLoss(); }catch(e){} },
    cage(){ if (mode === "walk"){ mode = "cage"; lookCur.set(-.3, 2.55, -4.6); } },
    look(name){ const p = TARGETS[name] || name; if (p) lookGoal.set(p[0], p[1], p[2]); },
    tint(hex){ tintC = hex == null ? null : new THREE.Color(hex); },
    flash(){ flashK = 1; },
    roar(){ roarK = 1; flashK = Math.max(flashK, .6); },
    gloves(up){ gloveGoal = up ? 1 : 0; },
    screen(ov){ screenOverride = ov || null; overrideAt = (performance.now() - start)/1000; lastScr = -1; },
    get inCage(){ return mode === "cage"; }
  };
}
