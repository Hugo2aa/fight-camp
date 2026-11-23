// Entrée en 3D : marche à la première personne dans l'allée, au milieu du public, jusqu'à la cage.
import * as THREE from "./three.module.min.js";

const smooth = t => t*t*(3-2*t);
function rnd(seed){ let s = seed >>> 0; return () => ((s = (s*1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(w, h, draw){ const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function startArena(canvas, o = {}){
  const D = o.duration || 25, r = rnd(7);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const size = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); };
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040203); scene.fog = new THREE.FogExp2(0x080406, .018);
  const cam = new THREE.PerspectiveCamera(66, 1, .1, 400); size();
  const uTime = {value:0};

  // Lumières
  scene.add(new THREE.HemisphereLight(0x553338, 0x080406, .55));
  const cageSpot = new THREE.SpotLight(0xffffff, 380, 60, .55, .5, 1.4); cageSpot.position.set(0, 26, 0); cageSpot.target.position.set(0, 0, 0); scene.add(cageSpot, cageSpot.target);
  const walkSpot = new THREE.SpotLight(0xffd9c0, 150, 40, .38, .6, 1.3); scene.add(walkSpot, walkSpot.target);
  const redL = new THREE.PointLight(0xd7262e, 260, 70, 1.6); redL.position.set(-18, 14, 30); scene.add(redL);
  const redR = new THREE.PointLight(0xd7262e, 260, 70, 1.6); redR.position.set(18, 14, 30); scene.add(redR);
  const blue = new THREE.PointLight(0x3a6dff, 200, 80, 1.6); blue.position.set(0, 18, -24); scene.add(blue);

  // Sol, allée et LED
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({color:0x0b0809, roughness:.85})); floor.rotation.x = -Math.PI/2; scene.add(floor);
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 64), new THREE.MeshStandardMaterial({color:0x151012, roughness:.35, metalness:.3})); aisle.rotation.x = -Math.PI/2; aisle.position.set(0, .01, 41); scene.add(aisle);
  const ledMat = new THREE.MeshBasicMaterial({color:0xff2a32});
  [-1.62, 1.62].forEach(x=>{ const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, 64), ledMat); l.position.set(x, .03, 41); scene.add(l); });
  const barMat = new THREE.MeshStandardMaterial({color:0x0e0a0b, roughness:.6});
  [-2.3, 2.3].forEach(x=>{ const b = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.05, 52), barMat); b.position.set(x, .52, 37); scene.add(b);
    const e = new THREE.Mesh(new THREE.BoxGeometry(.2, .03, 52), new THREE.MeshBasicMaterial({color:0x6a1015})); e.position.set(x, 1.06, 37); scene.add(e); });

  // Public : milliers de spectateurs, animés dans le shader (ils sautent et bougent)
  const spots = [];
  for (let side of [-1, 1]) for (let row=0; row<13; row++) for (let z=11; z<64; z+=.72){
    const x = side*(3.1 + row*.82) + (r()-.5)*.25; spots.push([x, row*.42, z + (r()-.5)*.3]); }
  for (let ring=0; ring<20; ring++){ const R = 15 + ring*1.25, n = Math.floor(2*Math.PI*R/.78);
    for (let i=0;i<n;i++){ const a = i/n*Math.PI*2, x = Math.sin(a)*R, z = Math.cos(a)*R; if (z > 8 && Math.abs(x) < 3.4 + ring*.4) continue; if (z > 10 && Math.abs(x) < 14) continue;
      spots.push([x + (r()-.5)*.2, ring*.55, z + (r()-.5)*.2]); } }
  const N = spots.length;
  const bodyG = new THREE.CapsuleGeometry(.26, .62, 3, 8); bodyG.translate(0, .57, 0);
  const headG = new THREE.SphereGeometry(.16, 10, 8); headG.translate(0, 1.22, 0);
  const phase = new Float32Array(N), energy = new Float32Array(N); for (let i=0;i<N;i++){ phase[i] = r()*6.28; energy[i] = r() < .35 ? 1 : r()*.4; }
  function crowdMat(){ const m = new THREE.MeshLambertMaterial({color:0xffffff});
    m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime;
      sh.vertexShader = "attribute float aPhase; attribute float aEnergy; uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n float j = max(0.0, sin(uTime*7.0 + aPhase)) * 0.28 * aEnergy + sin(uTime*2.0 + aPhase)*0.04; transformed.y += j; transformed.x += sin(uTime*1.3 + aPhase)*0.05;"); };
    return m; }
  const mats = crowdMat(), dummy = new THREE.Object3D(), col = new THREE.Color();
  const bodies = new THREE.InstancedMesh(bodyG, mats, N), heads = new THREE.InstancedMesh(headG, mats, N);
  for (let i=0;i<N;i++){ const [x,y,z] = spots[i]; dummy.position.set(x, y, z); dummy.lookAt(x*.1, y, z*.1 + (z > 9 && Math.abs(x) < 14 ? 30 : 0)); dummy.scale.setScalar(.9 + r()*.25); dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix); heads.setMatrixAt(i, dummy.matrix);
    const v = .04 + r()*.1; col.setRGB(v*(1 + r()*.6), v, v*(.9 + r()*.3)); bodies.setColorAt(i, col); const sk = .07 + r()*.16; col.setRGB(sk*1.35, sk*1.05, sk*.9); heads.setColorAt(i, col); }
  [bodies, heads].forEach(m=>{ m.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1)); m.geometry.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(energy, 1)); scene.add(m); });
  // Gradins sous le public
  const standMat = new THREE.MeshStandardMaterial({color:0x0c0809, roughness:.9});
  for (let side of [-1,1]) for (let row=0; row<13; row++){ const s = new THREE.Mesh(new THREE.BoxGeometry(.82, .42, 53), standMat); s.position.set(side*(3.1 + row*.82), row*.42 - .21, 37.5); scene.add(s); }

  // Flashs de téléphones
  const PH = 900, php = new Float32Array(PH*3); for (let i=0;i<PH;i++){ const s = spots[Math.floor(r()*N)]; php.set([s[0], s[1] + 1.5 + r()*.3, s[2]], i*3); }
  const phG = new THREE.BufferGeometry(); phG.setAttribute("position", new THREE.BufferAttribute(php, 3));
  const dot = canvasTex(64, 64, (g,w)=>{ const gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.25,"rgba(255,250,235,.7)"); gr.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0,0,w,w); });
  const phM = new THREE.PointsMaterial({size:.55, map:dot, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:0xfff6e8});
  const phones = new THREE.Points(phG, phM); scene.add(phones);

  // Faisceaux lumineux (volume) qui balaient la salle
  const beamMat = c => new THREE.ShaderMaterial({transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, uniforms:{c:{value:new THREE.Color(c)}},
    vertexShader:"varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"uniform vec3 c; varying float vY; void main(){ gl_FragColor = vec4(c, pow(vY, 2.2)*0.16); }"});
  const beams = [];
  [[-9, 0xffffff], [-4, 0xff3a3a], [4, 0xffffff], [9, 0xff3a3a], [-14, 0x4a7dff], [14, 0x4a7dff]].forEach(([x, c], i)=>{
    const g = new THREE.ConeGeometry(4.5, 34, 24, 1, true); g.translate(0, -17, 0);
    const piv = new THREE.Object3D(); piv.position.set(x, 32, 8 + (i%3)*10); const m = new THREE.Mesh(g, beamMat(c)); piv.add(m); scene.add(piv); beams.push([piv, i]); });

  // La cage
  const cage = new THREE.Group(); scene.add(cage);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.9, .9, 8), new THREE.MeshStandardMaterial({color:0x111111, roughness:.6})); apron.rotation.y = Math.PI/8; apron.position.y = .45; cage.add(apron);
  const logo = canvasTex(1024, 1024, (g,w)=>{ g.fillStyle = "#b9b9b9"; g.fillRect(0,0,w,w); g.translate(w/2, w/2); g.strokeStyle = "rgba(160,20,26,.85)"; g.lineWidth = 14;
    g.beginPath(); for (let i=0;i<=8;i++){ const a = Math.PI/8 + i*Math.PI/4; g[i?"lineTo":"moveTo"](Math.cos(a)*300, Math.sin(a)*300); } g.stroke();
    g.fillStyle = "rgba(20,20,20,.85)"; g.font = "bold 150px Impact, Anton, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("FIGHT", 0, -70); g.fillStyle = "#b5121b"; g.fillText("CAMP", 0, 80); });
  const mat = new THREE.Mesh(new THREE.CircleGeometry(7.5, 8), new THREE.MeshStandardMaterial({map:logo, roughness:.7})); mat.rotation.x = -Math.PI/2; mat.rotation.z = Math.PI/8; mat.position.y = .91; cage.add(mat);
  const fenceTex = canvasTex(128, 128, (g,w)=>{ g.clearRect(0,0,w,w); g.strokeStyle = "rgba(25,25,25,1)"; g.lineWidth = 7; g.beginPath(); g.moveTo(0,0); g.lineTo(w,w); g.moveTo(w,0); g.lineTo(0,w); g.stroke(); });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping; fenceTex.repeat.set(18, 6);
  const fenceMat = new THREE.MeshStandardMaterial({map:fenceTex, transparent:true, alphaTest:.3, side:THREE.DoubleSide, color:0x333333, roughness:.5, metalness:.6});
  const postMat = new THREE.MeshStandardMaterial({color:0x0d0d0d, roughness:.4, metalness:.3}), padMat = new THREE.MeshStandardMaterial({color:0x0a0a0a, roughness:.5});
  for (let i=0;i<8;i++){ const a = Math.PI/8 + i*Math.PI/4, b = a + Math.PI/4, R = 7.5, A = new THREE.Vector3(Math.cos(a)*R, 0, Math.sin(a)*R), B = new THREE.Vector3(Math.cos(b)*R, 0, Math.sin(b)*R);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 2.1, 10), padMat); post.position.set(A.x, .9 + 1.05, A.z); cage.add(post);
    const mid = A.clone().add(B).multiplyScalar(.5), len = A.distanceTo(B), ang = Math.atan2(B.x - A.x, B.z - A.z);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.7), fenceMat); f.position.set(mid.x, .9 + .95, mid.z); f.rotation.y = ang + Math.PI/2; cage.add(f);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .14, .16), postMat); rail.position.set(mid.x, .9 + 1.85, mid.z); rail.rotation.y = ang + Math.PI/2; cage.add(rail); }
  // Rampe lumineuse au-dessus de la cage
  const rig = new THREE.Mesh(new THREE.BoxGeometry(12, .3, 12), new THREE.MeshStandardMaterial({color:0x080808})); rig.position.y = 18; cage.add(rig);
  for (let i=0;i<16;i++){ const lamp = new THREE.Mesh(new THREE.CircleGeometry(.35, 16), new THREE.MeshBasicMaterial({color:0xffffff})); lamp.rotation.x = Math.PI/2; lamp.position.set(-5.2 + (i%4)*3.45, 17.84, -5.2 + Math.floor(i/4)*3.45); cage.add(lamp); }
  // Écran géant avec ton nom
  const scr = canvasTex(1024, 512, (g,w,h)=>{ g.fillStyle = "#050505"; g.fillRect(0,0,w,h); const gr = g.createLinearGradient(0,0,w,0); gr.addColorStop(0,"#5a0a10"); gr.addColorStop(1,"#120304"); g.fillStyle = gr; g.fillRect(8,8,w-16,h-16);
    g.textAlign = "center"; g.fillStyle = "#d9a43a"; g.font = "600 44px Arial, sans-serif"; g.fillText((o.top || "MAIN EVENT").toUpperCase(), w/2, 110);
    g.fillStyle = "#fff"; g.font = "bold 170px Impact, Anton, sans-serif"; g.fillText((o.name || "FIGHTER").toUpperCase(), w/2, 300);
    if (o.nick){ g.fillStyle = "#ffcf7a"; g.font = "italic 600 54px Arial, sans-serif"; g.fillText("« " + o.nick + " »", w/2, 400); } });
  for (let i=0;i<4;i++){ const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({map:scr, toneMapped:false})); const a = i*Math.PI/2; s.position.set(Math.sin(a)*3.6, 13, Math.cos(a)*3.6); s.rotation.y = a; cage.add(s); }

  // Trajet de la caméra : regards à gauche, à droite, vers les gradins, puis la cage
  const KEYS = [[0,0,0],[.1,0,2],[.18,48,9],[.28,52,12],[.36,-46,9],[.46,-52,12],[.53,0,4],[.6,34,16],[.67,30,15],[.73,-30,12],[.79,-26,12],[.85,0,16],[.92,0,9],[1,0,5]];
  const look = t => { let i = 0; while (i < KEYS.length-2 && KEYS[i+1][0] < t) i++; const [t0,y0,p0] = KEYS[i], [t1,y1,p1] = KEYS[i+1], k = smooth(Math.min(1, Math.max(0, (t-t0)/(t1-t0)))); return [y0 + (y1-y0)*k, p0 + (p1-p0)*k]; };
  let start = performance.now(), raf = 0, stopped = false;
  const tgt = new THREE.Vector3();
  function frame(now){
    if (stopped) return; raf = requestAnimationFrame(frame);
    const s = (now - start)/1000, t = Math.min(1, s/D); uTime.value = s;
    const walk = smooth(Math.min(1, t*1.02)), z = 62 - (62 - 15.5)*walk, bob = Math.sin(s*2*Math.PI*1.75);
    const [yaw, pitch] = look(t), jx = Math.sin(s*1.7)*.4 + Math.sin(s*3.1)*.25, jy = Math.sin(s*1.3)*.3;
    cam.position.set(Math.sin(s*Math.PI*1.75)*.05, 1.72 + bob*.035*(1 - Math.max(0, t-.9)*10), z);
    const ya = THREE.MathUtils.degToRad(yaw + jx), pa = THREE.MathUtils.degToRad(pitch + jy);
    tgt.set(cam.position.x - Math.sin(ya)*Math.cos(pa)*10, cam.position.y + Math.sin(pa)*10, cam.position.z - Math.cos(ya)*Math.cos(pa)*10); cam.lookAt(tgt);
    cam.rotation.z += Math.sin(s*1.75*Math.PI)*.006;
    walkSpot.position.set(0, 9, z + 4); walkSpot.target.position.set(0, 0, z - 3);
    beams.forEach(([p, i])=>{ p.rotation.z = Math.sin(s*.6 + i*1.3)*.5; p.rotation.x = Math.cos(s*.45 + i)*.35; });
    phM.opacity = .55 + Math.sin(s*9)*.25; ledMat.color.setHSL(0, 1, .45 + Math.sin(s*5)*.12);
    redL.intensity = 220 + Math.sin(s*3.2)*80; redR.intensity = 220 + Math.cos(s*2.7)*80;
    if (o.onProgress) o.onProgress(t);
    renderer.render(scene, cam);
  }
  window.addEventListener("resize", size);
  raf = requestAnimationFrame(frame);
  return { stop(){ stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
    scene.traverse(x=>{ if (x.geometry) x.geometry.dispose(); if (x.material){ (Array.isArray(x.material) ? x.material : [x.material]).forEach(m=>{ if (m.map) m.map.dispose(); m.dispose(); }); } });
    renderer.dispose(); try{ renderer.forceContextLoss(); }catch(e){} } };
}
