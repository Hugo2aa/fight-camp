// Entrée en 3D à la première personne : vestiaire -> couloir -> allée au milieu du public -> marches -> dans la cage.
import * as THREE from "./three.module.min.js";

const smooth = t => t*t*(3-2*t);
const clamp = (x, a=0, b=1) => Math.min(b, Math.max(a, x));
function rnd(seed){ let s = seed >>> 0; return () => ((s = (s*1664525 + 1013904223) >>> 0) / 4294967296); }
function tex(w, h, draw){ const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// Fusion simple de géométries (non indexées)
function merge(list){
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  const n = parts.reduce((a,g)=>a + g.attributes.position.count, 0), pos = new Float32Array(n*3), nor = new Float32Array(n*3); let o = 0;
  parts.forEach(g=>{ pos.set(g.attributes.position.array, o*3); nor.set(g.attributes.normal.array, o*3); o += g.attributes.position.count; });
  const m = new THREE.BufferGeometry(); m.setAttribute("position", new THREE.BufferAttribute(pos, 3)); m.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); return m;
}
const cap = (r, l, x, y, z, rx=0, rz=0, sx=1, sz=1) => { const g = new THREE.CapsuleGeometry(r, l, 3, 8); g.scale(sx, 1, sz); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g; };
const ball = (r, x, y, z) => { const g = new THREE.SphereGeometry(r, 10, 8); g.translate(x, y, z); return g; };

// Spectateurs : vêtements et peau séparés, trois attitudes (bras le long du corps, bras levés, un bras levé avec téléphone)
function personParts(kind){
  const clothes = [cap(.19, .38, 0, 1.02, 0, 0, 0, 1.3, .75), cap(.15, .55, 0, .45, 0, 0, 0, 1.15, .8)];
  const skin = [ball(.115, 0, 1.52, .01), cap(.055, .08, 0, 1.36, 0)];
  const arm = (side, up) => { if (up){ clothes.push(cap(.06, .42, side*.3, 1.42, 0, 0, side*-.25)); skin.push(ball(.06, side*.38, 1.72, 0)); }
    else { clothes.push(cap(.06, .44, side*.3, .95, 0, 0, side*.12)); skin.push(ball(.055, side*.35, .66, 0)); } };
  if (kind === 0){ arm(-1, false); arm(1, false); }
  if (kind === 1){ arm(-1, true); arm(1, true); }
  if (kind === 2){ arm(-1, false); arm(1, true); }
  return [merge(clothes), merge(skin)];
}

export function startArena(canvas, o = {}){
  const D = o.duration || 30, r = rnd(11);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040203); scene.fog = new THREE.FogExp2(0x070406, .016);
  const cam = new THREE.PerspectiveCamera(64, 1, .05, 400);
  const size = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); }; size();
  const uTime = {value:0}, std = (c, ro=.8, me=0, em) => new THREE.MeshStandardMaterial({color:c, roughness:ro, metalness:me, emissive: em || 0x000000});
  const add = (geo, mat, x, y, z, ry=0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };

  /* ---------- Lumières générales ---------- */
  scene.add(new THREE.HemisphereLight(0x4a3035, 0x060304, .5));
  const cageSpot = new THREE.SpotLight(0xffffff, 420, 60, .55, .5, 1.4); cageSpot.position.set(0, 26, 0); cageSpot.target.position.set(0, 0, 0); scene.add(cageSpot, cageSpot.target);
  const follow = new THREE.SpotLight(0xffd9c0, 140, 30, .42, .7, 1.3); scene.add(follow, follow.target);
  const redL = new THREE.PointLight(0xd7262e, 240, 70, 1.6); redL.position.set(-18, 14, 30); scene.add(redL);
  const redR = new THREE.PointLight(0xd7262e, 240, 70, 1.6); redR.position.set(18, 14, 30); scene.add(redR);
  const blue = new THREE.PointLight(0x3a6dff, 110, 80, 1.6); blue.position.set(0, 18, -24); scene.add(blue);

  /* ---------- Vestiaire (z 86 -> 96) ---------- */
  const tile = tex(256, 256, (g,w)=>{ g.fillStyle = "#2a2c2e"; g.fillRect(0,0,w,w); g.strokeStyle = "#1a1b1c"; g.lineWidth = 4; for (let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*w/4,0); g.lineTo(i*w/4,w); g.moveTo(0,i*w/4); g.lineTo(w,i*w/4); g.stroke(); } });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(4, 2);
  const wallM = new THREE.MeshStandardMaterial({map:tile, roughness:.6});
  add(new THREE.BoxGeometry(8, .2, 10), std(0x1c1d1f, .5, .1), 0, -.1, 91);
  add(new THREE.BoxGeometry(8, .2, 10), std(0x141414), 0, 3.3, 91);
  add(new THREE.BoxGeometry(.2, 3.4, 10), wallM, -4, 1.6, 91); add(new THREE.BoxGeometry(.2, 3.4, 10), wallM, 4, 1.6, 91);
  add(new THREE.BoxGeometry(8, 3.4, .2), wallM, 0, 1.6, 96);
  [[-2.65, 3.4],[2.65, 3.4]].forEach(([x,w])=>add(new THREE.BoxGeometry(w, 3.4, .2), wallM, x, 1.6, 86)); add(new THREE.BoxGeometry(1.9, 1, .2), wallM, 0, 2.9, 86);
  const lockerT = tex(128, 512, (g,w,h)=>{ g.fillStyle = "#3b4048"; g.fillRect(0,0,w,h); g.fillStyle = "#2a2e34"; for (let i=0;i<8;i++) g.fillRect(30, 40 + i*12, 68, 5); g.fillStyle = "#9aa0a6"; g.fillRect(100, 240, 8, 40); g.strokeStyle = "#1c1f23"; g.lineWidth = 6; g.strokeRect(3,3,w-6,h-6); });
  const lockerM = new THREE.MeshStandardMaterial({map:lockerT, roughness:.45, metalness:.5});
  for (let i=0;i<8;i++){ add(new THREE.BoxGeometry(.6, 2.1, .55), lockerM, -3.6, 1.05, 87.6 + i*.95, Math.PI/2); add(new THREE.BoxGeometry(.6, 2.1, .55), lockerM, 3.6, 1.05, 87.6 + i*.95, -Math.PI/2); }
  add(new THREE.BoxGeometry(.5, .45, 6), std(0x5a3a22, .6), -2.6, .25, 91); add(new THREE.BoxGeometry(.5, .45, 6), std(0x5a3a22, .6), 2.6, .25, 91);
  add(new THREE.BoxGeometry(.5, .2, .5), std(0x8a1116, .5), 2.6, .58, 90.2);
  // nom sur la porte du vestiaire et néons
  const doorSign = tex(512, 160, (g,w,h)=>{ g.fillStyle = "#0d0d0d"; g.fillRect(0,0,w,h); g.fillStyle = "#d9a43a"; g.font = "bold 34px Arial"; g.textAlign = "center"; g.fillText("VESTIAIRE · COIN " + (o.corner || "BLEU").toUpperCase(), w/2, 52); g.fillStyle = "#fff"; g.font = "bold 70px Impact, Anton, sans-serif"; g.fillText((o.name || "").toUpperCase(), w/2, 128); });
  add(new THREE.PlaneGeometry(2.4, .75), new THREE.MeshBasicMaterial({map:doorSign, toneMapped:false}), 0, 2.85, 86.12, Math.PI);
  for (let i=0;i<3;i++){ add(new THREE.BoxGeometry(.25, .06, 2.2), new THREE.MeshBasicMaterial({color:0xe8f1ff}), 0, 3.18, 88 + i*3); }
  const lockerLight = new THREE.PointLight(0xdfe9ff, 60, 14, 1.5); lockerLight.position.set(0, 3, 91); scene.add(lockerLight);

  /* ---------- Couloir (z 62 -> 86) ---------- */
  const concrete = tex(256, 256, (g,w)=>{ g.fillStyle = "#1d1b1c"; g.fillRect(0,0,w,w); for (let i=0;i<2500;i++){ const v = 20 + Math.random()*25; g.fillStyle = `rgb(${v},${v-2},${v-1})`; g.fillRect(Math.random()*w, Math.random()*w, 2, 2); } g.fillStyle = "rgba(120,10,15,.6)"; g.fillRect(0, 150, w, 14); });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(8, 1);
  const tunM = new THREE.MeshStandardMaterial({map:concrete, roughness:.9});
  add(new THREE.BoxGeometry(.3, 3.6, 24), tunM, -2.1, 1.8, 74); add(new THREE.BoxGeometry(.3, 3.6, 24), tunM, 2.1, 1.8, 74);
  add(new THREE.BoxGeometry(4.5, .3, 24), std(0x0c0b0b), 0, 3.6, 74); add(new THREE.BoxGeometry(4.2, .1, 24), std(0x141213, .4, .2), 0, -.04, 74);
  const strips = []; for (let i=0;i<8;i++){ const s = add(new THREE.BoxGeometry(1.4, .05, .3), new THREE.MeshBasicMaterial({color:0xffe6cc}), 0, 3.42, 64 + i*3); strips.push(s); }
  const tunLight = new THREE.PointLight(0xffd2b0, 50, 12, 1.5); scene.add(tunLight);
  // bouche du couloir : grande lumière de la salle
  const glow = {material:{opacity:0}};

  /* ---------- Salle : sol, allée, barrières ---------- */
  add(new THREE.PlaneGeometry(260, 260), std(0x0b0809, .85), 0, 0, 0).rotation.x = -Math.PI/2;
  const aisle = add(new THREE.PlaneGeometry(3.2, 54), std(0x151012, .55, .05), 0, .012, 35); aisle.rotation.x = -Math.PI/2;
  const ledMat = new THREE.MeshBasicMaterial({color:0xff2a32});
  [-1.62, 1.62].forEach(x=>add(new THREE.BoxGeometry(.06, .04, 54), ledMat, x, .03, 35));
  [-2.3, 2.3].forEach(x=>{ add(new THREE.BoxGeometry(.18, 1.05, 46), std(0x0e0a0b, .6), x, .52, 35); add(new THREE.BoxGeometry(.2, .03, 46), new THREE.MeshBasicMaterial({color:0x6a1015}), x, 1.06, 35); });
  // agents de sécurité le long de l'allée
  const [sc, ss] = personParts(0), secM = new THREE.MeshLambertMaterial({color:0x0a0a0a}), secS = new THREE.MeshLambertMaterial({color:0x6b4a3a});
  [[-1.95, 52],[1.95, 44],[-1.95, 34],[1.95, 24],[-1.95, 16],[1.95, 70],[-1.6, 78]].forEach(([x,z])=>{ const g = new THREE.Group(); g.add(new THREE.Mesh(sc, secM), new THREE.Mesh(ss, secS)); g.position.set(x, 0, z); g.scale.setScalar(1.12); g.rotation.y = x < 0 ? Math.PI/2 : -Math.PI/2; scene.add(g); });

  /* ---------- Public ---------- */
  const spots = [];
  for (let side of [-1, 1]) for (let row=0; row<13; row++) for (let z=11; z<58; z+=.74) spots.push([side*(3.1 + row*.82) + (r()-.5)*.22, row*.42, z + (r()-.5)*.28, 0]);
  for (let ring=0; ring<20; ring++){ const R = 15 + ring*1.25, n = Math.floor(2*Math.PI*R/.8);
    for (let i=0;i<n;i++){ const a = i/n*Math.PI*2, x = Math.sin(a)*R, z = Math.cos(a)*R; if (z > 10 && Math.abs(x) < 14) continue; spots.push([x + (r()-.5)*.2, ring*.55, z + (r()-.5)*.2, 1]); } }
  const groups = [[],[],[]]; spots.forEach(s=>{ const k = r(); groups[k < .62 ? 0 : k < .86 ? 1 : 2].push(s); });
  function crowdMat(){ const m = new THREE.MeshLambertMaterial({color:0xffffff});
    m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime;
      sh.vertexShader = "attribute float aPhase; attribute float aEnergy; uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n float j = max(0.0, sin(uTime*6.5 + aPhase)) * 0.26 * aEnergy + sin(uTime*1.8 + aPhase)*0.035; transformed.y += j; transformed.x += sin(uTime*1.2 + aPhase)*0.05;"); };
    return m; }
  const cMat = crowdMat(), sMat = crowdMat(), dummy = new THREE.Object3D(), col = new THREE.Color();
  const SHIRTS = [[.03,.03,.035],[.05,.05,.06],[.02,.02,.02],[.35,.03,.04],[.6,.6,.62],[.06,.08,.16],[.12,.1,.08]];
  groups.forEach((list, k)=>{ if (!list.length) return; const [cg, sg] = personParts(k), N = list.length;
    const ph = new Float32Array(N), en = new Float32Array(N); for (let i=0;i<N;i++){ ph[i] = r()*6.28; en[i] = k ? .8 + r()*.4 : (r() < .3 ? 1 : r()*.35); }
    const cm = new THREE.InstancedMesh(cg, cMat, N), sm = new THREE.InstancedMesh(sg, sMat, N);
    list.forEach(([x,y,z,bowl], i)=>{ dummy.position.set(x, y, z); if (bowl) dummy.lookAt(0, y, 0); else dummy.lookAt(0, y, z); dummy.rotateY((r()-.5)*.4); dummy.scale.setScalar(.92 + r()*.2); dummy.updateMatrix();
      cm.setMatrixAt(i, dummy.matrix); sm.setMatrixAt(i, dummy.matrix);
      const s = SHIRTS[Math.floor(r()*SHIRTS.length)]; col.setRGB(s[0]*(.8+r()*.4), s[1]*(.8+r()*.4), s[2]*(.8+r()*.4)); cm.setColorAt(i, col);
      const t = .1 + r()*.45; col.setRGB(t*1.25, t*.92, t*.75); sm.setColorAt(i, col); });
    [cm, sm].forEach(m=>{ m.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1)); m.geometry.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(en, 1)); scene.add(m); }); });
  const standM = std(0x0c0809, .9);
  for (let side of [-1,1]) for (let row=0; row<13; row++) add(new THREE.BoxGeometry(.82, .42, 47), standM, side*(3.1 + row*.82), row*.42 - .21, 34.5);
  for (let ring=0; ring<20; ring++){ const t = new THREE.Mesh(new THREE.CylinderGeometry(15.6 + ring*1.25, 15.6 + ring*1.25, .55, 64, 1, true), standM); t.position.y = ring*.55 - .27; scene.add(t); }
  // flashs de téléphones
  const PH = 1100, php = new Float32Array(PH*3); for (let i=0;i<PH;i++){ const s = spots[Math.floor(r()*spots.length)]; php.set([s[0], s[1] + 1.75, s[2]], i*3); }
  const phG = new THREE.BufferGeometry(); phG.setAttribute("position", new THREE.BufferAttribute(php, 3));
  const dot = tex(64, 64, (g,w)=>{ const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.25,"rgba(255,250,235,.7)"); gr.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0,0,w,w); });
  const phM = new THREE.PointsMaterial({size:.5, map:dot, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:0xfff6e8}); scene.add(new THREE.Points(phG, phM));

  /* ---------- Faisceaux ---------- */
  const beamMat = c => new THREE.ShaderMaterial({transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, uniforms:{c:{value:new THREE.Color(c)}},
    vertexShader:"varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"uniform vec3 c; varying float vY; void main(){ gl_FragColor = vec4(c, pow(vY, 2.2)*0.15); }"});
  const beams = [];
  [[-9, 0xffffff], [-4, 0xff3a3a], [4, 0xffffff], [9, 0xff3a3a], [-14, 0x4a7dff], [14, 0x4a7dff]].forEach(([x, c], i)=>{
    const g = new THREE.ConeGeometry(4.2, 34, 24, 1, true); g.translate(0, -17, 0); const piv = new THREE.Object3D(); piv.position.set(x, 32, 6 + (i%3)*10); piv.add(new THREE.Mesh(g, beamMat(c))); scene.add(piv); beams.push([piv, i]); });

  /* ---------- La cage (porte ouverte côté allée) ---------- */
  const cage = new THREE.Group(); scene.add(cage);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(7.7, 8, .9, 8), std(0x111111, .6)); apron.rotation.y = Math.PI/8; apron.position.y = .45; cage.add(apron);
  const logo = tex(1024, 1024, (g,w)=>{ g.fillStyle = "#b4b4b4"; g.fillRect(0,0,w,w); g.translate(w/2, w/2); g.strokeStyle = "rgba(160,20,26,.85)"; g.lineWidth = 14;
    g.beginPath(); for (let i=0;i<=8;i++){ const a = Math.PI/8 + i*Math.PI/4; g[i?"lineTo":"moveTo"](Math.cos(a)*300, Math.sin(a)*300); } g.stroke();
    g.fillStyle = "rgba(20,20,20,.85)"; g.font = "bold 150px Impact, Anton, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("FIGHT", 0, -70); g.fillStyle = "#b5121b"; g.fillText("CAMP", 0, 80); });
  const matM = new THREE.Mesh(new THREE.CircleGeometry(7.5, 8), new THREE.MeshStandardMaterial({map:logo, roughness:.7})); matM.rotation.x = -Math.PI/2; matM.rotation.z = Math.PI/8; matM.position.y = .91; cage.add(matM);
  const fenceT = tex(128, 128, (g,w)=>{ g.clearRect(0,0,w,w); g.strokeStyle = "rgba(25,25,25,1)"; g.lineWidth = 7; g.beginPath(); g.moveTo(0,0); g.lineTo(w,w); g.moveTo(w,0); g.lineTo(0,w); g.stroke(); });
  fenceT.wrapS = fenceT.wrapT = THREE.RepeatWrapping; fenceT.repeat.set(18, 6);
  const fenceM = new THREE.MeshStandardMaterial({map:fenceT, transparent:true, alphaTest:.3, side:THREE.DoubleSide, color:0x333333, roughness:.5, metalness:.6});
  const padM = std(0x0a0a0a, .5), railM = std(0x0d0d0d, .4, .3);
  for (let i=0;i<8;i++){ const a = Math.PI/8 + i*Math.PI/4, b = a + Math.PI/4, R = 7.5, A = new THREE.Vector3(Math.cos(a)*R, 0, Math.sin(a)*R), B = new THREE.Vector3(Math.cos(b)*R, 0, Math.sin(b)*R);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 2.1, 10), padM); post.position.set(A.x, 1.95, A.z); cage.add(post);
    const mid = A.clone().add(B).multiplyScalar(.5), len = A.distanceTo(B), ang = Math.atan2(B.x - A.x, B.z - A.z);
    if (i === 1){ // porte ouverte, rabattue vers l'extérieur
      const door = new THREE.Mesh(new THREE.PlaneGeometry(len*.55, 1.7), fenceM); door.position.set(B.x + 1.0, 1.85, B.z + 1.25); door.rotation.y = ang + Math.PI/2 + 1.1; cage.add(door); continue; }
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.7), fenceM); f.position.set(mid.x, 1.85, mid.z); f.rotation.y = ang + Math.PI/2; cage.add(f);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .14, .16), railM); rail.position.set(mid.x, 2.75, mid.z); rail.rotation.y = ang + Math.PI/2; cage.add(rail); }
  for (let i=0;i<3;i++){ const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, .3*(i+1), .45), std(0x161616, .6)); st.position.set(0, .15*(i+1), 9.1 - i*.45); cage.add(st); }
  // rampe de projecteurs
  const rig = new THREE.Mesh(new THREE.BoxGeometry(13, .35, 13), std(0x080808)); rig.position.y = 19.5; cage.add(rig);
  for (let i=0;i<16;i++){ const lamp = new THREE.Mesh(new THREE.CircleGeometry(.33, 16), new THREE.MeshBasicMaterial({color:0xffffff})); lamp.rotation.x = Math.PI/2; lamp.position.set(-5.4 + (i%4)*3.6, 19.31, -5.4 + Math.floor(i/4)*3.6); cage.add(lamp); }

  /* ---------- Écran géant animé ---------- */
  const SW = 1024, SH = 512, sc2 = document.createElement("canvas"); sc2.width = SW; sc2.height = SH; const sx = sc2.getContext("2d");
  const scrT = new THREE.CanvasTexture(sc2); scrT.colorSpace = THREE.SRGBColorSpace;
  const led = document.createElement("canvas"); led.width = 8; led.height = 8; { const l = led.getContext("2d"); l.fillStyle = "rgba(0,0,0,.35)"; l.fillRect(0,0,8,8); l.clearRect(1,1,6,6); }
  const ledPat = sx.createPattern(led, "repeat");
  function drawScreen(s){
    const phase = Math.floor(s/3.2) % 3, k = (s % 3.2)/3.2;
    const gr = sx.createLinearGradient(0,0,SW,SH); gr.addColorStop(0,"#3a0509"); gr.addColorStop(.5,"#120203"); gr.addColorStop(1,"#3a0509"); sx.fillStyle = gr; sx.fillRect(0,0,SW,SH);
    sx.save(); sx.globalAlpha = .25; sx.strokeStyle = "#d7262e"; sx.lineWidth = 3; for (let i=-6;i<12;i++){ const x = ((i*120 + s*160) % (SW+240)) - 120; sx.beginPath(); sx.moveTo(x,0); sx.lineTo(x+240,SH); sx.stroke(); } sx.restore();
    sx.textAlign = "center"; sx.textBaseline = "middle";
    const pop = 1 + Math.max(0, .25 - k)*1.2;
    sx.save(); sx.translate(SW/2, SH/2); sx.scale(pop, pop);
    if (phase === 0){ sx.fillStyle = "#d9a43a"; sx.font = "600 48px Arial"; sx.fillText((o.top || "MAIN EVENT").toUpperCase(), 0, -150);
      sx.fillStyle = "#fff"; sx.font = "bold 190px Impact, Anton, sans-serif"; sx.fillText((o.name || "").toUpperCase(), 0, 10);
      if (o.nick){ sx.fillStyle = "#8fc4ff"; sx.font = "italic 600 58px Arial"; sx.fillText("« " + o.nick + " »", 0, 150); } }
    else if (phase === 1){ sx.fillStyle = "#d9a43a"; sx.font = "600 48px Arial"; sx.fillText("PALMARÈS", 0, -150); sx.fillStyle = "#fff"; sx.font = "bold 200px Impact, Anton, sans-serif"; sx.fillText(o.record || "0-0-0", 0, 20);
      sx.fillStyle = "#ccc"; sx.font = "600 44px Arial"; sx.fillText((o.rank || "").toUpperCase(), 0, 160); }
    else { sx.fillStyle = "#fff"; sx.font = "bold 150px Impact, Anton, sans-serif"; sx.fillText("FIGHT", 0, -70); sx.fillStyle = "#d7262e"; sx.fillText("CAMP", 0, 90); }
    sx.restore();
    sx.fillStyle = ledPat; sx.fillRect(0,0,SW,SH);
    sx.strokeStyle = "#d7262e"; sx.lineWidth = 10; sx.strokeRect(5,5,SW-10,SH-10);
    scrT.needsUpdate = true;
  }
  drawScreen(0);
  const cube = new THREE.Group(); cube.position.y = 13.5; cage.add(cube);
  const frameM = std(0x050505, .4, .5);
  for (let i=0;i<4;i++){ const a = i*Math.PI/2, s = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({map:scrT, toneMapped:false})); s.position.set(Math.sin(a)*3.7, 0, Math.cos(a)*3.7); s.rotation.y = a; cube.add(s);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4, .2), frameM); fr.position.set(Math.sin(a)*3.6, 0, Math.cos(a)*3.6); fr.rotation.y = a; cube.add(fr); }
  // anneau LED qui défile sous l'écran
  const ringC = document.createElement("canvas"); ringC.width = 2048; ringC.height = 64; const rx = ringC.getContext("2d");
  rx.fillStyle = "#050505"; rx.fillRect(0,0,2048,64); rx.fillStyle = "#ff3a3a"; rx.font = "bold 44px Arial"; rx.textBaseline = "middle";
  const ringTxt = `FIGHT CAMP  ·  ${(o.name||"").toUpperCase()}  ·  ${o.nick ? "« " + o.nick.toUpperCase() + " »  ·  " : ""}MAIN EVENT  ·  `; let rxp = 0; while (rxp < 2048){ rx.fillText(ringTxt, rxp, 34); rxp += rx.measureText(ringTxt).width; }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace; ringT.wrapS = THREE.RepeatWrapping; ringT.repeat.set(2, 1);
  const ringM = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, .7, 48, 1, true), new THREE.MeshBasicMaterial({map:ringT, toneMapped:false, side:THREE.DoubleSide})); ringM.position.y = -2.6; cube.add(ringM);
  const halo = new THREE.PointLight(0xff3040, 120, 30, 1.5); halo.position.y = 11; cage.add(halo);

  /* ---------- Trajet ---------- */
  // points du parcours [x, y, z] et vitesse relative
  const PATH = [[0,0,94.2],[0,0,90],[0,0,86],[0,0,80],[0,0,72],[0,0,62],[0,0,50],[0,0,36],[0,0,22],[0,0,12.6],[0,.3,9.1],[0,.6,8.65],[0,.9,8.2],[0,.9,6.3],[0,.9,2.4],[0,.9,.8]];
  const seg = []; let tot = 0; for (let i=1;i<PATH.length;i++){ const L = Math.hypot(PATH[i][0]-PATH[i-1][0], PATH[i][1]-PATH[i-1][1], PATH[i][2]-PATH[i-1][2]); seg.push(L); tot += L; }
  const at = d => { let i = 0; while (i < seg.length-1 && d > seg[i]){ d -= seg[i]; i++; } const k = clamp(d/seg[i]), A = PATH[i], B = PATH[i+1]; return [A[0]+(B[0]-A[0])*k, A[1]+(B[1]-A[1])*k, A[2]+(B[2]-A[2])*k]; };
  // [t, lacet°, tangage°] : on regarde le vestiaire, la porte, le public à gauche/droite, l'écran, puis on se retourne dans la cage
  const KEYS = [[0,-70,-6],[.04,-35,-3],[.08,45,-2],[.11,0,0],[.14,0,0],[.25,0,2],[.32,0,5],[.38,50,9],[.45,52,12],[.51,-48,9],[.58,-52,12],[.63,0,4],[.68,34,14],[.72,-28,12],[.77,0,22],[.81,0,8],[.86,0,-2],[.92,90,6],[.97,170,8],[1,180,6]];
  const look = t => { let i = 0; while (i < KEYS.length-2 && KEYS[i+1][0] < t) i++; const [t0,y0,p0] = KEYS[i], [t1,y1,p1] = KEYS[i+1], k = smooth(clamp((t-t0)/(t1-t0))); return [y0 + (y1-y0)*k, p0 + (p1-p0)*k]; };
  // vitesse : lente au départ, normale dans le couloir et l'allée, ralentie dans les marches
  const prog = t => { const a = clamp((t-.1)/.8); return smooth(a)*.55 + a*.45; };
  let start = performance.now(), raf = 0, stopped = false, lastStep = 0, lastScr = -1;
  const tgt = new THREE.Vector3();
  function frame(now){
    if (stopped) return; raf = requestAnimationFrame(frame);
    const s = window.__arenaS !== undefined ? window.__arenaS : (now - start)/1000, t = clamp(s/D); uTime.value = s;
    const p = at(prog(t)*tot), moving = t > .1 && t < .9, f = 1.75, ph = s*f*Math.PI;
    const bob = moving ? (Math.abs(Math.sin(ph)) - .63)*.07 : 0, sway = moving ? Math.sin(ph)*.035 : 0;
    cam.position.set(p[0] + sway, 1.72 + p[1] + bob, p[2]);
    const [yaw, pitch] = look(t), jx = Math.sin(s*1.7)*.35 + Math.sin(s*3.3)*.2, jy = Math.sin(s*1.3)*.25 + (moving ? Math.abs(Math.sin(ph))*-.6 : 0);
    const ya = THREE.MathUtils.degToRad(yaw + jx), pa = THREE.MathUtils.degToRad(pitch + jy);
    tgt.set(cam.position.x - Math.sin(ya)*Math.cos(pa)*10, cam.position.y + Math.sin(pa)*10, cam.position.z - Math.cos(ya)*Math.cos(pa)*10); cam.lookAt(tgt);
    cam.rotateZ(moving ? Math.sin(ph)*.01 : 0);
    if (moving && o.onStep){ const st = Math.floor(s*f); if (st !== lastStep){ lastStep = st; o.onStep(); } }
    follow.position.set(0, cam.position.y + 6, cam.position.z + 4); follow.target.position.set(0, 0, cam.position.z - 4);
    tunLight.position.set(0, 3, Math.min(86, Math.max(62, cam.position.z - 2)));
    glow.material.opacity = cam.position.z > 62 && cam.position.z < 86 ? .25 + (1 - (cam.position.z - 62)/24)*.6 : 0;
    beams.forEach(([b, i])=>{ b.rotation.z = Math.sin(s*.6 + i*1.3)*.5; b.rotation.x = Math.cos(s*.45 + i)*.35; });
    phM.opacity = .55 + Math.sin(s*9)*.25; ledMat.color.setHSL(0, 1, .42 + Math.sin(s*5)*.12);
    redL.intensity = 200 + Math.sin(s*3.2)*80; redR.intensity = 200 + Math.cos(s*2.7)*80;
    cube.rotation.y = s*.12; ringT.offset.x = -s*.05;
    const si = Math.floor(s*12); if (si !== lastScr){ lastScr = si; drawScreen(s); }
    if (o.onProgress) o.onProgress(t, cam.position.z);
    renderer.render(scene, cam);
  }
  window.addEventListener("resize", size);
  raf = requestAnimationFrame(frame);
  return { stop(){ stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
    scene.traverse(x=>{ if (x.geometry) x.geometry.dispose(); if (x.material){ (Array.isArray(x.material) ? x.material : [x.material]).forEach(m=>{ if (m.map) m.map.dispose(); m.dispose(); }); } });
    renderer.dispose(); try{ renderer.forceContextLoss(); }catch(e){} } };
}
