/**
 * Not Blind · 播放页舞台效果（第二轮）
 * 镜湖 MIRROR LAKE / 声纹沙 CHLADNI / 铜雨 KINETIC RAIN / 谐振 HARMONOGRAPH
 *
 * 接口仿照 MineradioSonicTopography：update(dt, ctx) / onPresetChange(prev, next, ctx) /
 * isActive(fx) / pointer(clientX, clientY, info)。three.js r128，发光全在着色器里做，
 * 不依赖后期 bloom；颜色取自 stageLyrics.coverPalette（封面主色）。
 */
(function (global) {
  'use strict';

  var BASE_INDEX = 13;
  var TAU = Math.PI * 2;

  // ------------------------------------------------------------------ utils
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clamp01(v) { return clamp(Number.isFinite(v) ? v : 0, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth01(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function expBlend(rate, dt) { return clamp01(1 - Math.exp(-rate * Math.max(0.0005, dt || 1 / 60))); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ------------------------------------------------------------------ audio
  // 和音域回响同一套读法：优先吃 sonicAudioFrame 的 8 段频谱，退回 bass/mid/treble/beat。
  function readAudio(raw) {
    raw = raw || {};
    var o;
    if (raw.sonicDetailed || raw.subBass != null || raw.lowMid != null) {
      var treble = clamp01(Number(raw.treble) || Number(raw.brilliance) || 0);
      o = {
        sub: clamp01(Number(raw.subBass) || 0),
        bass: clamp01(Number(raw.bass) || 0),
        lowMid: clamp01(Number(raw.lowMid) || 0),
        mid: clamp01(Number(raw.mid) || 0),
        highMid: clamp01(Number(raw.highMid) || 0),
        presence: clamp01(Number(raw.presence) || 0),
        brilliance: clamp01(Number(raw.brilliance) || 0),
        air: clamp01(Number(raw.air) || 0),
        treble: treble,
        kick: clamp01(raw.kickEnvelope != null ? Number(raw.kickEnvelope) : Number(raw.beat) || 0),
        energy: clamp01(Number(raw.energy) || 0)
      };
    } else {
      var b = clamp01(Number(raw.bass) || 0), m = clamp01(Number(raw.mid) || 0);
      var t = clamp01(Number(raw.treble) || 0), bt = clamp01(Number(raw.beat) || 0);
      var e = clamp01(Number(raw.energy) || 0);
      o = {
        sub: clamp01(b * 0.6 + bt * 0.4), bass: clamp01(b * 0.8 + bt * 0.25),
        lowMid: clamp01(m * 0.55 + b * 0.15), mid: clamp01(m * 0.9),
        highMid: clamp01(t * 0.5 + m * 0.2), presence: clamp01(t * 0.62),
        brilliance: clamp01(t * 0.74), air: clamp01(t * 0.45 + e * 0.1),
        treble: t, kick: bt, energy: e
      };
    }
    o.low = clamp01(o.sub * 0.45 + o.bass * 0.55);
    o.high = clamp01(o.presence * 0.4 + o.brilliance * 0.35 + o.air * 0.25);
    return o;
  }

  // 节拍时钟：鼓点、镲片（高频起音）、段落变化。所有效果共用。
  function MusicClock() {
    this.time = 0;
    this.kickHeld = false;
    this.lastKick = -9;
    this.hiAvg = 0.1;
    this.hiHeld = false;
    this.lastHat = -9;
    this.eSlow = 0;
    this.eFast = 0;
    this.lastPhrase = 0;
    this.kicksSincePhrase = 0;
    this.quietFor = 0;
    this.events = [];
  }
  MusicClock.prototype.update = function (a, dt) {
    var ev = this.events;
    ev.length = 0;
    this.time += dt;
    var now = this.time;
    // 鼓点：kickEnvelope 上升沿（与音域回响一致的门限）
    if (a.kick > 0.56 && !this.kickHeld && now - this.lastKick > 0.16) {
      ev.push({ type: 'kick', strength: clamp(a.kick, 0.3, 1) });
      this.lastKick = now;
      this.kicksSincePhrase++;
    }
    this.kickHeld = a.kick > 0.34;
    // 镲片 / 高频起音
    var hi = Math.max(a.presence, a.brilliance * 0.92, a.air * 0.85);
    this.hiAvg += (hi - this.hiAvg) * expBlend(1.6, dt);
    if (!this.hiHeld && hi > this.hiAvg * 1.18 + 0.05 && now - this.lastHat > 0.085) {
      ev.push({ type: 'hat', strength: clamp01((hi - this.hiAvg) * 3 + 0.2) });
      this.lastHat = now;
    }
    this.hiHeld = hi > this.hiAvg * 1.08 + 0.03;
    // 段落：能量明显抬升（进副歌）/明显回落，或鼓点数够一个乐句，或太久没变
    this.eSlow += (a.energy - this.eSlow) * expBlend(0.11, dt);
    this.eFast += (a.energy - this.eFast) * expBlend(1.3, dt);
    this.quietFor = a.energy < 0.03 ? this.quietFor + dt : 0;
    var since = now - this.lastPhrase;
    var reason = '';
    if (since > 7 && this.eFast - this.eSlow > 0.13) reason = 'lift';
    else if (since > 9 && this.eSlow - this.eFast > 0.16) reason = 'drop';
    else if (since > 10 && this.kicksSincePhrase >= 32) reason = 'bars';
    else if (since > 26) reason = 'time';
    if (reason) {
      ev.push({ type: 'phrase', reason: reason, lift: this.eFast - this.eSlow });
      this.lastPhrase = now;
      this.kicksSincePhrase = 0;
    }
    return ev;
  };

  // ---------------------------------------------------------------- palette
  var paletteCache = { key: '', value: null };
  // 自己解析封面色（不走 lyricPaletteColorToHex：那个会把颜色提亮到歌词可读的亮度，暗色会被抬成粉灰）
  function toHex(value, fallback) {
    if (value && typeof value === 'object') {
      if (value.isColor) return '#' + value.getHexString();
      if (value.r != null && value.g != null && value.b != null) {
        var sc = (value.r > 1 || value.g > 1 || value.b > 1) ? 1 : 255;
        return '#' + [value.r, value.g, value.b].map(function (p) {
          return Math.round(clamp(Number(p) * sc || 0, 0, 255)).toString(16).padStart(2, '0');
        }).join('');
      }
    }
    value = value == null ? '' : String(value).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    if (/^#[0-9a-fA-F]{3}$/.test(value)) return '#' + value.slice(1).split('').map(function (c) { return c + c; }).join('');
    var rgb = value.match(/^rgba?\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,\s*([.\d]+)/i);
    if (rgb) {
      return '#' + [rgb[1], rgb[2], rgb[3]].map(function (p) {
        return Math.round(clamp(Number(p) || 0, 0, 255)).toString(16).padStart(2, '0');
      }).join('');
    }
    if (value && typeof global.lyricPaletteColorToHex === 'function') {
      try { return global.lyricPaletteColorToHex(value, fallback, 0); } catch (e) { }
    }
    return fallback;
  }
  function readPalette(fx) {
    var stage = global.stageLyrics || {};
    var pal = stage.coverPalette || stage.palette || {};
    var tint = (fx && /^#[0-9a-fA-F]{6}$/.test(String(fx.visualTintColor || ''))) ? fx.visualTintColor : '#9db8cf';
    // 软件里 primary/secondary/highlight 是给歌词用的（已提亮）；raw* 才是封面原色
    var src = {
      primary: pal.rawAreaPrimary || pal.rawPrimary || pal.primary,
      secondary: pal.rawAreaAccent || pal.rawAccent || pal.rawAreaCool || pal.rawCool || pal.secondary,
      highlight: pal.rawAreaLight || pal.rawLight || pal.highlight,
      dark: pal.rawAreaBase || pal.rawDark || pal.rawAverage
    };
    var key = [src.primary, src.secondary, src.highlight, src.dark, tint].join('|');
    if (paletteCache.key === key && paletteCache.value) return paletteCache.value;
    var p = {
      primary: new THREE.Color(toHex(src.primary, tint)),
      secondary: new THREE.Color(toHex(src.secondary, '#7d8fc6')),
      highlight: new THREE.Color(toHex(src.highlight, '#e9dcc0')),
      dark: new THREE.Color(toHex(src.dark, '#0d0f14'))
    };
    // 深色保底：封面整体很亮时，暗部也压到够暗
    if (lum(p.dark) > 0.08) p.dark.multiplyScalar(0.08 / lum(p.dark));
    paletteCache.key = key;
    paletteCache.value = p;
    return p;
  }
  function lum(c) { return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722; }
  // 把颜色压到可用的亮度段，避免封面很灰/很黑时效果发不出光
  function lift(c, minL, maxL) {
    var out = c.clone();
    var l = lum(out);
    if (l < minL) out.lerp(new THREE.Color(1, 1, 1), clamp01((minL - l) / Math.max(0.001, 1 - l)));
    else if (l > maxL) out.multiplyScalar(maxL / l);
    return out;
  }
  function saturate(c, amount) {
    var hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, clamp01(hsl.s * amount), hsl.l);
  }
  function lerpColor(uniform, target, t) { uniform.value.lerp(target, t); }

  var GLSL_COMMON = [
    'float nbHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float nbHash1(float n){ return fract(sin(n * 127.1) * 43758.5453); }'
  ].join('\n');

  // 往透明画布上“加光”：颜色相加、不改画布透明度（否则会把下面的封面背景盖黑）
  function additive(mat) {
    mat.blending = THREE.CustomBlending;
    mat.blendEquation = THREE.AddEquation;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneFactor;
    mat.blendEquationAlpha = THREE.AddEquation;
    mat.blendSrcAlpha = THREE.ZeroFactor;
    mat.blendDstAlpha = THREE.OneFactor;
    mat.transparent = true;
    mat.depthWrite = false;
    return mat;
  }

  var kit = {
    additive: additive,
    BASE_INDEX: BASE_INDEX, TAU: TAU,
    clamp: clamp, clamp01: clamp01, lerp: lerp, smooth01: smooth01, expBlend: expBlend, rand: rand,
    readAudio: readAudio, MusicClock: MusicClock, readPalette: readPalette,
    lum: lum, lift: lift, saturate: saturate, lerpColor: lerpColor, GLSL_COMMON: GLSL_COMMON,
    effects: []
  };
  global.__NBStageKit = kit;
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// 镜湖 MIRROR LAKE
// 一面暗色的湖一直铺到地平线，地平线上坐着一个圆（开场那条线和那个圆），
// 圆的下半截是倒影。鼓点落下大涟漪、圆荡出一圈回声；低音让湖面起伏；
// 高频是细雨点；歌词在水里有真正的倒影（把歌词镜像再画一遍，涟漪一过倒影就碎开）。
// 整片湖挂在舞台上：拖动时湖、圆和歌词一起转；水面高度跟着歌词最低那一行走。
// ============================================================
(function (global) {
  'use strict';
  var K = global.__NBStageKit;
  if (!K) return;

  var WATER_Y = -1.62;
  var EDGE_MAX = 90;
  var RIP_BIG = 10;
  var RIP_RAIN = 18;
  var ECHO_MAX = 4;
  var CIRCLE_OFFSET = -0.235; // 圆放在视线右侧一点，把正中让给歌词
  // 圆固定在湖上的这个位置（默认镜头看过去偏右的地平线），跟着舞台一起转
  var CIRCLE_X = 17.6, CIRCLE_Z = -66.5, CIRCLE_R = 6.6;
  var REFL_SCALE = 0.5;   // 倒影贴图用半分辨率
  var REFL_MAX_W = 1400;

  var RING_GLSL = [
    'uniform vec3 uCircC; uniform vec3 uCircN; uniform float uCircR; uniform float uCircW;',
    'uniform float uCircGlow; uniform vec3 uRing; uniform vec2 uEcho[' + ECHO_MAX + ']; uniform float uTime;',
    'float nbRingLine(float r, float R, float w){ float x = (r - R) / w; return exp(-x * x); }',
    'vec3 nbCircleLight(float r){',
    '  float line = nbRingLine(r, uCircR, uCircW);',
    '  float inner = nbRingLine(r, uCircR * 0.62, uCircW * 0.7) * 0.16;',
    '  float halo = exp(-abs(r - uCircR) / (uCircR * 0.20)) * 0.20;',
    '  float fill = (1.0 - smoothstep(uCircR * 0.97, uCircR * 1.005, r)) * (0.035 + 0.02 * uCircGlow);',
    '  float echo = 0.0;',
    '  for (int i = 0; i < ' + ECHO_MAX + '; i++) {',
    '    vec2 e = uEcho[i];',
    '    if (e.y > 0.0) {',
    '      float age = uTime - e.x;',
    '      if (age > 0.0 && age < 6.0) {',
    '        float rr = uCircR * (1.0 + age * 0.42);',
    '        echo += nbRingLine(r, rr, uCircW * (1.2 + age * 1.6)) * e.y * exp(-age * 0.75);',
    '      }',
    '    }',
    '  }',
    '  return uRing * (line * (0.85 + uCircGlow) + inner + halo * (0.6 + uCircGlow * 0.6) + fill + echo * 0.55);',
    '}'
  ].join('\n');

  var SCALE_GLSL = 'vec3 nbScale(){ return vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); }';
  var WATER_VS = [
    'uniform mat4 uReflMat;',
    'varying vec3 vLocal; varying vec4 vReflUv;',
    SCALE_GLSL,
    'void main(){',
    '  vLocal = position * nbScale();',
    '  vReflUv = uReflMat * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var WATER_FS = [
    'uniform float uFade; uniform vec3 uCamLocal; uniform float uEdge;',
    'uniform float uSwell; uniform float uMicro; uniform vec2 uWind;',
    'uniform vec4 uRip[' + RIP_BIG + ']; uniform vec4 uRain[' + RIP_RAIN + '];',
    'uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uWater; uniform vec3 uLamp;',
    'uniform float uLampI; uniform float uLampY; uniform float uLampW;',
    'uniform sampler2D uRefl; uniform float uReflOn; uniform float uReflI;',
    RING_GLSL,
    'varying vec3 vLocal; varying vec4 vReflUv;',
    'vec2 nbWave(vec2 p, vec2 d, float k, float w, float ph, float a){',
    '  float x = dot(d, p) * k - uTime * w + ph;',
    '  return d * (a * k * cos(x));',
    '}',
    'void main(){',
    '  vec2 p = vLocal.xz;',
    '  float dist = length(p - uCamLocal.xz);',
    '  float nearK = 1.0 - smoothstep(10.0, 62.0, dist);',
    '  vec2 w1 = uWind; vec2 w2 = vec2(-uWind.y, uWind.x);',
    '  vec2 g = vec2(0.0);',
    // 长涌：低音
    '  g += nbWave(p, normalize(w1 + w2 * 0.30), 0.42, 0.62, 0.0, uSwell);',
    '  g += nbWave(p, normalize(w1 - w2 * 0.45), 0.61, 0.83, 1.7, uSwell * 0.7);',
    '  g += nbWave(p, normalize(w1 * 0.6 + w2), 0.93, 1.10, 4.1, uSwell * 0.42);',
    // 细纹：高频（远处压平，避免闪烁）
    '  float m = uMicro * (0.25 + 0.75 * nearK);',
    '  g += nbWave(p, normalize(w1 + w2 * 0.9), 2.3, 2.1, 0.3, m);',
    '  g += nbWave(p, normalize(w1 - w2 * 1.3), 3.1, 2.7, 2.2, m * 0.8);',
    '  g += nbWave(p, normalize(-w1 * 0.3 + w2), 4.7, 3.3, 5.0, m * 0.55);',
    '  g += nbWave(p, normalize(w1 * 0.8 - w2 * 0.2), 6.9, 4.4, 1.1, m * 0.4);',
    // 鼓点涟漪
    '  for (int i = 0; i < ' + RIP_BIG + '; i++) {',
    '    vec4 r = uRip[i];',
    '    if (r.w <= 0.0) continue;',
    '    float age = uTime - r.z;',
    '    if (age < 0.0 || age > 7.0) continue;',
    '    vec2 dv = p - r.xy; float d = length(dv) + 1e-4;',
    '    float x = d - age * 2.9;',
    '    float wdt = 0.28 + age * 0.55;',
    '    float env = exp(-x * x / wdt) * exp(-age * 0.42) / (1.0 + age * 0.6) * r.w;',
    '    env *= smoothstep(0.0, 0.12, age);',
    '    g += (dv / d) * env * 0.13 * 6.5 * cos(6.5 * x);',
    '  }',
    // 雨点
    '  for (int i = 0; i < ' + RIP_RAIN + '; i++) {',
    '    vec4 r = uRain[i];',
    '    if (r.w <= 0.0) continue;',
    '    float age = uTime - r.z;',
    '    if (age < 0.0 || age > 2.2) continue;',
    '    vec2 dv = p - r.xy; float d = length(dv) + 1e-4;',
    '    float x = d - age * 1.35;',
    '    float env = exp(-x * x / (0.02 + age * 0.05)) * exp(-age * 1.8) * r.w;',
    '    g += (dv / d) * env * 0.05 * 16.0 * cos(16.0 * x);',
    '  }',
    '  float farK = smoothstep(26.0, 70.0, dist);',
    '  g *= mix(1.0, 0.16, farK);',
    '  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));',
    '  vec3 V = normalize(uCamLocal - vLocal);',
    '  vec3 R = reflect(-V, n);',
    '  R.y = abs(R.y);',
    '  float e = clamp(R.y, 0.0, 1.0);',
    '  vec3 sky = mix(uHorizon, uZenith, pow(e, 0.32));',
    '  sky += uHorizon * exp(-e * 38.0) * 0.9;',
    '  float den = dot(R, uCircN);',
    '  if (abs(den) > 0.0001) {',
    '    float tt = dot(uCircC - vLocal, uCircN) / den;',
    '    vec3 H = vLocal + R * tt;',
    '    if (tt > 0.0 && H.y > 0.0) sky += nbCircleLight(length(H - uCircC));',
    '  }',
    // 歌词的真倒影：镜像画好的歌词贴图，按水面起伏扭一扭，再沿竖直方向拉一点丝
    '  vec3 lyr = vec3(0.0);',
    '  if (uReflOn > 0.5 && vReflUv.w > 0.0) {',
    '    vec2 ruv = vReflUv.xy / vReflUv.w + g * vec2(0.042, 0.062);',
    '    lyr = texture2D(uRefl, ruv).rgb * 0.34',
    '        + (texture2D(uRefl, ruv + vec2(0.0, 0.0045)).rgb + texture2D(uRefl, ruv - vec2(0.0, 0.0045)).rgb) * 0.2',
    '        + (texture2D(uRefl, ruv + vec2(0.0, 0.011)).rgb + texture2D(uRefl, ruv - vec2(0.0, 0.011)).rgb) * 0.13;',
    '  }',
    // 再加一点碎光：歌词当成一盏横灯，涟漪上闪
    '  vec3 lp = vec3(clamp(vLocal.x, -uLampW, uLampW), uLampY, 0.0);',
    '  vec3 L = normalize(lp - vLocal);',
    '  float spec = pow(max(dot(R, L), 0.0), 160.0) * (1.0 - smoothstep(4.0, 30.0, length(vLocal.xz))) * smoothstep(3.0, 7.0, dist);',
    '  float cosT = max(dot(n, V), 0.0);',
    '  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);',
    '  vec3 col = uWater * (0.7 + 0.3 * nearK) + sky * F + uLamp * spec * uLampI * (0.18 + F * 1.2) * (1.0 - uReflOn * 0.45);',
    '  col += lyr * uReflI * mix(0.36, 1.0, F) * mix(vec3(1.0), uLamp, 0.3);',
    // 镜头转到水面下面：只剩暗水和涟漪的亮纹
    '  if (uCamLocal.y < 0.0) col = uWater * 2.2 + uHorizon * (0.08 + clamp(length(g) * 4.0, 0.0, 1.0) * 0.35);',
    '  float edge = uEdge - length(vLocal.xz);',
    '  float aa = max(fwidth(edge), 0.0005);',
    '  col = mix(col, uHorizon * 0.5 + uWater, smoothstep(uEdge * 0.45, uEdge, uEdge - edge) * 0.22);',
    '  col += uRing * exp(-max(edge, 0.0) / (aa * 1.6)) * 0.55;',
    '  float alpha = smoothstep(0.0, aa * 1.5, edge);',
    '  gl_FragColor = vec4(col, alpha * uFade);',
    '}'
  ].join('\n');

  var CIRCLE_VS = [
    'varying vec2 vP;',
    SCALE_GLSL,
    'void main(){ vP = position.xy * nbScale().xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');
  var CIRCLE_FS = [
    'uniform float uFade;',
    RING_GLSL,
    'varying vec2 vP;',
    'void main(){',
    '  vec3 c = nbCircleLight(length(vP));',
    '  gl_FragColor = vec4(c * uFade, 1.0);',
    '}'
  ].join('\n');

  var SKY_VS = [
    'varying vec3 vLocal;',
    SCALE_GLSL,
    'void main(){ vLocal = position * nbScale(); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');
  var SKY_FS = [
    'uniform float uFade; uniform float uTime; uniform vec3 uHorizon; uniform float uStars; uniform float uRadius;',
    K.GLSL_COMMON,
    'varying vec3 vLocal;',
    'void main(){',
    '  float h = max(vLocal.y, 0.0);',
    '  float glow = exp(-h / 5.5) * 0.55 + exp(-h / 1.1) * 0.45;',
    '  vec3 col = uHorizon * glow;',
    '  float az = atan(vLocal.z, vLocal.x);',
    '  vec2 cell = vec2(az * 150.0, h * 5.6);',
    '  vec2 id = floor(cell); vec2 f = fract(cell) - 0.5;',
    '  float rnd = nbHash(id);',
    '  if (rnd > 0.93 && h > 3.0) {',
    '    vec2 o = vec2(nbHash(id + 3.1), nbHash(id + 7.7)) - 0.5;',
    '    float d = length(f - o * 0.6);',
    '    float tw = 0.55 + 0.45 * sin(uTime * (1.3 + rnd * 3.0) + rnd * 40.0);',
    '    col += vec3(0.85, 0.9, 1.0) * smoothstep(0.16, 0.0, d) * (rnd - 0.93) * 14.0 * tw * uStars * smoothstep(3.0, 9.0, h);',
    '  }',
    '  gl_FragColor = vec4(col * uFade, 1.0);',
    '}'
  ].join('\n');

  function vec4Array(n) { var a = []; for (var i = 0; i < n; i++) a.push(new THREE.Vector4(0, 0, -100, 0)); return a; }
  function vec2Array(n) { var a = []; for (var i = 0; i < n; i++) a.push(new THREE.Vector2(-100, 0)); return a; }

  function create(scene) {
    var root = new THREE.Group();
    root.name = 'nb-stage-lake';
    root.position.set(0, WATER_Y, 0);

    var ringUniforms = {
      uTime: { value: 0 },
      uCircC: { value: new THREE.Vector3(18, 0, -70) },
      uCircN: { value: new THREE.Vector3(0, 0, 1) },
      uCircR: { value: 6.6 },
      uCircW: { value: 0.11 },
      uCircGlow: { value: 0.6 },
      uRing: { value: new THREE.Color(0.9, 0.86, 0.78) },
      uEcho: { value: vec2Array(ECHO_MAX) }
    };
    var waterUniforms = Object.assign({
      uFade: { value: 0 },
      uCamLocal: { value: new THREE.Vector3(0, 2.5, 7.4) },
      uEdge: { value: EDGE_MAX },
      uSwell: { value: 0.03 },
      uMicro: { value: 0.012 },
      uWind: { value: new THREE.Vector2(0.2, 0.98).normalize() },
      uRip: { value: vec4Array(RIP_BIG) },
      uRain: { value: vec4Array(RIP_RAIN) },
      uHorizon: { value: new THREE.Color(0.2, 0.16, 0.14) },
      uZenith: { value: new THREE.Color(0.01, 0.012, 0.016) },
      uWater: { value: new THREE.Color(0.006, 0.008, 0.011) },
      uLamp: { value: new THREE.Color(1, 0.9, 0.8) },
      uLampI: { value: 0.5 },
      uLampY: { value: 1.75 },
      uLampW: { value: 3.0 },
      uRefl: { value: null },
      uReflMat: { value: new THREE.Matrix4() },
      uReflOn: { value: 0 },
      uReflI: { value: 0.9 }
    }, ringUniforms);

    var water = new THREE.Mesh(
      new THREE.CircleGeometry(1, 192).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: waterUniforms, vertexShader: WATER_VS, fragmentShader: WATER_FS,
        transparent: true, depthWrite: true, depthTest: true, side: THREE.DoubleSide,
        extensions: { derivatives: true }
      })
    );
    water.renderOrder = -4;
    water.frustumCulled = false;
    root.add(water);

    var circleUniforms = Object.assign({ uFade: { value: 0 } }, ringUniforms);
    var circle = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      K.additive(new THREE.ShaderMaterial({
        uniforms: circleUniforms, vertexShader: CIRCLE_VS, fragmentShader: CIRCLE_FS, depthTest: true, side: THREE.DoubleSide
      }))
    );
    circle.renderOrder = -2;
    circle.frustumCulled = false;
    root.add(circle);

    var skyUniforms = {
      uFade: { value: 0 }, uTime: ringUniforms.uTime, uHorizon: waterUniforms.uHorizon,
      uStars: { value: 1 }, uRadius: { value: 80 }
    };
    var sky = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 128, 1, true).translate(0, 0.5, 0),
      K.additive(new THREE.ShaderMaterial({
        uniforms: skyUniforms, vertexShader: SKY_VS, fragmentShader: SKY_FS, depthTest: true, side: THREE.BackSide
      }))
    );
    sky.renderOrder = -3;
    sky.frustumCulled = false;
    root.add(sky);

    scene.add(root);

    var st = {
      rip: 0, rain: 0, echo: 0, lastRain: -9, windAngle: 1.35, windTarget: 1.35,
      swell: 0.03, micro: 0.012, glow: 0.6, kickFlash: 0, breath: 0,
      camLocal: new THREE.Vector3(), tmp: new THREE.Vector3(), inv: new THREE.Matrix4(),
      bobT: 0, fwd: new THREE.Vector3(), viewYaw: Math.PI, circleYaw: Math.PI + CIRCLE_OFFSET,
      level: WATER_Y, levelTarget: WATER_Y, levelAcc: 1, lyricGroup: null
    };

    // —— 水面高度：放在歌词最低那一行下面一点（行数在软件设置里可调：单行 / 三行 / 电影五行 / 自定义）
    var lv = { inv: new THREE.Matrix4(), v: new THREE.Vector3(), list: [], group: null };
    function opacityOf(m) {
      if (Array.isArray(m)) m = m[0];
      if (!m) return 0;
      if (m.uniforms && m.uniforms.uOpacity) return Number(m.uniforms.uOpacity.value) || 0;
      return m.opacity == null ? 1 : (Number(m.opacity) || 0);
    }
    function shownInGroup(o) {
      for (var p = o; p; p = p.parent) { if (!p.visible) return false; if (p === lv.group) return true; }
      return false;
    }
    // 软件：每句歌词是一个组，userData.lyric.rowLayers[i].mesh 是每一行字的平面（上下留了发光边，取中间 72% 当字高）
    // 预览：每行平面的 userData.lyric 里直接记了字宽 / 字高
    function gatherRow(o) {
      var d = o.userData && o.userData.lyric;
      if (!d) return;
      var rows = d.rowLayers;
      if (rows && rows.length) {
        for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].mesh) lv.list.push(rows[i].mesh, 0.72, 0, 0);
      } else if (d.activeRowMesh || d.textMesh) {
        lv.list.push(d.activeRowMesh || d.textMesh, 0.72, 0, 0);
      } else if (o.isMesh && d.textWorldH) {
        lv.list.push(o, 1, d.textWorldW || 6, d.textWorldH);
      }
    }
    function gatherAny(o) { if (o.isMesh && o.geometry) lv.list.push(o, 1, 0, 0); }
    function lowestLyricY(group) {
      if (!group || !group.visible || !root.parent) return null;
      lv.group = group;
      group.updateWorldMatrix(true, true);
      lv.inv.copy(root.parent.matrixWorld).invert();
      lv.list.length = 0;
      group.traverseVisible(gatherRow);
      if (!lv.list.length) group.traverseVisible(gatherAny);
      var minY = Infinity;
      for (var i = 0; i < lv.list.length; i += 4) {
        var o = lv.list[i], hs = lv.list[i + 1], tw = lv.list[i + 2], th = lv.list[i + 3];
        if (!o.geometry || !shownInGroup(o) || opacityOf(o.material) < 0.16) continue;
        var x0, x1, y0, y1;
        if (th) { x0 = -tw / 2; x1 = tw / 2; y0 = -th / 2; y1 = th / 2; }
        else {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          var bb = o.geometry.boundingBox, cy = (bb.min.y + bb.max.y) / 2, hh = (bb.max.y - bb.min.y) / 2 * hs;
          x0 = bb.min.x; x1 = bb.max.x; y0 = cy - hh; y1 = cy + hh;
        }
        for (var c = 0; c < 4; c++) {
          lv.v.set(c & 1 ? x1 : x0, c & 2 ? y1 : y0, 0).applyMatrix4(o.matrixWorld).applyMatrix4(lv.inv);
          if (lv.v.y < minY) minY = lv.v.y;
        }
      }
      lv.group = null;
      return isFinite(minY) ? minY : null;
    }

    // —— 歌词倒影：每帧画水之前，用镜像镜头把歌词单独画到一张贴图里
    var RF = {
      rt: null, cam: new THREE.PerspectiveCamera(), busy: false,
      n: new THREE.Vector3(), p: new THREE.Vector3(), c: new THREE.Vector3(), rot: new THREE.Matrix4(),
      look: new THREE.Vector3(), target: new THREE.Vector3(), view: new THREE.Vector3(),
      plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4(),
      size: new THREE.Vector2(), clear: new THREE.Color()
    };
    function renderReflection(renderer, camera) {
      waterUniforms.uReflOn.value = 0;
      var group = st.lyricGroup;
      if (RF.busy || !renderer || !camera || !group || !group.parent || !group.visible) return;
      if (waterUniforms.uFade.value < 0.01) return;
      RF.rot.extractRotation(water.matrixWorld);
      RF.n.set(0, 1, 0).applyMatrix4(RF.rot).normalize();
      RF.p.setFromMatrixPosition(water.matrixWorld);
      RF.c.setFromMatrixPosition(camera.matrixWorld);
      RF.view.subVectors(RF.p, RF.c);
      if (RF.view.dot(RF.n) > -0.02) return; // 镜头在水面下 / 贴着水面
      RF.view.reflect(RF.n).negate().add(RF.p);
      RF.rot.extractRotation(camera.matrixWorld);
      RF.look.set(0, 0, -1).applyMatrix4(RF.rot).add(RF.c);
      RF.target.subVectors(RF.p, RF.look).reflect(RF.n).negate().add(RF.p);
      var mc = RF.cam;
      mc.position.copy(RF.view);
      mc.up.set(0, 1, 0).applyMatrix4(RF.rot).reflect(RF.n);
      mc.lookAt(RF.target);
      mc.near = camera.near; mc.far = camera.far;
      mc.updateMatrixWorld();
      mc.projectionMatrix.copy(camera.projectionMatrix);
      var tm = waterUniforms.uReflMat.value;
      tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      tm.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse).multiply(water.matrixWorld);
      // 斜近裁剪面：水面以下的东西不进倒影
      RF.plane.setFromNormalAndCoplanarPoint(RF.n, RF.p).applyMatrix4(mc.matrixWorldInverse);
      RF.clip.set(RF.plane.normal.x, RF.plane.normal.y, RF.plane.normal.z, RF.plane.constant);
      var pm = mc.projectionMatrix.elements;
      RF.q.set((Math.sign(RF.clip.x) + pm[8]) / pm[0], (Math.sign(RF.clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
      RF.clip.multiplyScalar(2 / RF.clip.dot(RF.q));
      pm[2] = RF.clip.x; pm[6] = RF.clip.y; pm[10] = RF.clip.z + 1 - 0.003; pm[14] = RF.clip.w;
      if (mc.projectionMatrixInverse) mc.projectionMatrixInverse.copy(mc.projectionMatrix).invert();

      renderer.getDrawingBufferSize(RF.size);
      var w = Math.max(64, Math.round(RF.size.x * REFL_SCALE)), h = Math.max(64, Math.round(RF.size.y * REFL_SCALE));
      if (w > REFL_MAX_W) { h = Math.round(h * REFL_MAX_W / w); w = REFL_MAX_W; }
      if (!RF.rt) RF.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false });
      else if (RF.rt.width !== w || RF.rt.height !== h) RF.rt.setSize(w, h);

      var prevRT = renderer.getRenderTarget();
      var prevXr = renderer.xr ? renderer.xr.enabled : false;
      var prevShadow = renderer.shadowMap ? renderer.shadowMap.autoUpdate : false;
      var prevAuto = renderer.autoClear;
      var prevInfo = renderer.info ? renderer.info.autoReset : true;
      renderer.getClearColor(RF.clear);
      var prevAlpha = renderer.getClearAlpha();
      RF.busy = true;
      try {
        if (renderer.xr) renderer.xr.enabled = false;
        if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
        if (renderer.info) renderer.info.autoReset = false;
        renderer.setRenderTarget(RF.rt);
        renderer.setClearColor(0x000000, 0);
        renderer.state.buffers.depth.setMask(true);
        renderer.clear(true, true, false);
        renderer.autoClear = false;
        renderer.render(group, mc);
      } finally {
        renderer.autoClear = prevAuto;
        renderer.setClearColor(RF.clear, prevAlpha);
        if (renderer.xr) renderer.xr.enabled = prevXr;
        if (renderer.shadowMap) renderer.shadowMap.autoUpdate = prevShadow;
        if (renderer.info) renderer.info.autoReset = prevInfo;
        renderer.setRenderTarget(prevRT);
        if (camera.viewport !== undefined) renderer.state.viewport(camera.viewport);
        RF.busy = false;
      }
      waterUniforms.uRefl.value = RF.rt.texture;
      waterUniforms.uReflOn.value = 1;
    }
    water.onBeforeRender = function (renderer, sc, camera) { renderReflection(renderer, camera); };

    function addRipple(x, z, strength, time) {
      var r = waterUniforms.uRip.value[st.rip];
      r.set(x, z, time, strength);
      st.rip = (st.rip + 1) % RIP_BIG;
    }
    function addRain(x, z, strength, time) {
      var r = waterUniforms.uRain.value[st.rain];
      r.set(x, z, time, strength);
      st.rain = (st.rain + 1) % RIP_RAIN;
    }
    function addEcho(strength, time) {
      ringUniforms.uEcho.value[st.echo].set(time, strength);
      st.echo = (st.echo + 1) % ECHO_MAX;
    }
    // 在镜头前方扇形里挑一个水面位置（baseYaw 不给就是镜头正前方）
    function pickWaterPoint(minD, maxD, spread, baseYaw) {
      var cam = st.camLocal;
      var base = baseYaw == null ? st.viewYaw : baseYaw;
      var a = base + (Math.random() - 0.5) * spread;
      var d = minD + Math.pow(Math.random(), 0.8) * (maxD - minD);
      return { x: cam.x + Math.sin(a) * d, z: cam.z + Math.cos(a) * d };
    }

    return {
      root: root,
      update: function (dt, s) {
        var t = s.time;
        var a = s.audio;
        var pal = s.palette;
        ringUniforms.uTime.value = t;
        waterUniforms.uFade.value = s.fade;
        circleUniforms.uFade.value = s.fade;
        skyUniforms.uFade.value = s.fade;

        // —— 镜头：像停在一条小船上，随涌轻轻起伏
        st.bobT += dt * (0.8 + a.low * 0.6);
        root.rotation.x = Math.sin(st.bobT * 0.41) * 0.0045 * (1 + a.low * 1.4);
        root.rotation.z = Math.sin(st.bobT * 0.33 + 1.3) * 0.0065 * (1 + a.low * 1.4);
        st.lyricGroup = s.lyricGroup || null;
        st.levelAcc += dt;
        if (st.levelAcc > 0.2) {
          st.levelAcc = 0;
          // 歌词锁定在镜头前（软件设置「歌词跟随镜头」）时不跟，免得转动时水面忽上忽下
          var low = s.fx && s.fx.lyricCameraLock ? null : lowestLyricY(st.lyricGroup);
          st.levelTarget = low == null ? WATER_Y : K.clamp(low - 0.16, -3.6, -0.3);
        }
        // 往下让得快（新的一行出现时水面不能盖住字），往上回得很慢（换句滚动时水面不跟着一上一下）
        var lvRate = s.fade < 0.05 ? 20 : (st.levelTarget < st.level ? 2.2 : 0.22);
        st.level += (st.levelTarget - st.level) * K.expBlend(lvRate, dt);
        root.position.y = st.level + Math.sin(st.bobT * 0.52) * 0.028 * (1 + a.low) - st.kickFlash * 0.018;
        waterUniforms.uLampY.value = K.clamp(0.1 - st.level, 0.3, 3.8); // 碎光的“灯”= 正在唱的那行，离水面多高

        root.updateMatrixWorld(true);
        st.inv.copy(root.matrixWorld).invert();
        st.camLocal.copy(s.camera.position).applyMatrix4(st.inv);
        waterUniforms.uCamLocal.value.copy(st.camLocal);

        // 湖面半径跟镜头距离走，保证地平线不被远裁剪面切掉
        var camFlat = Math.sqrt(st.camLocal.x * st.camLocal.x + st.camLocal.z * st.camLocal.z);
        var edge = K.clamp(96 - camFlat, 40, EDGE_MAX);
        waterUniforms.uEdge.value = edge;
        water.scale.set(edge, 1, edge);
        sky.scale.set(edge - 1.5, 46, edge - 1.5);
        skyUniforms.uRadius.value = edge - 1.5;

        // 圆：固定在湖上（默认镜头看过去偏右的地平线），下半截沉进水里；拖动时跟着湖一起转
        s.camera.getWorldDirection(st.fwd).transformDirection(st.inv);
        if (st.fwd.x * st.fwd.x + st.fwd.z * st.fwd.z > 1e-4) st.viewYaw = Math.atan2(st.fwd.x, st.fwd.z);
        var cFull = Math.sqrt(CIRCLE_X * CIRCLE_X + CIRCLE_Z * CIRCLE_Z);
        var cPull = Math.min(1, Math.max(8, edge - 8 - camFlat * 0.2) / cFull);
        var cx = CIRCLE_X * cPull, cz = CIRCLE_Z * cPull;
        ringUniforms.uCircC.value.set(cx, 0, cz);
        var nx = -cx, nz = 7.5 - cz;
        var nl = Math.sqrt(nx * nx + nz * nz) || 1;
        ringUniforms.uCircN.value.set(nx / nl, 0, nz / nl);
        circle.position.set(cx, 0, cz);
        circle.rotation.set(0, Math.atan2(nx, nz), 0);
        st.circleYaw = Math.atan2(cx - st.camLocal.x, cz - st.camLocal.z);
        st.breath += ((s.phraseBreath || 0) - st.breath) * K.expBlend(0.8, dt);
        var R = CIRCLE_R * cPull * (1 + st.breath * 0.04);
        ringUniforms.uCircR.value = R;
        circle.scale.set(R * 6.4, R * 6.4, 1);
        ringUniforms.uCircW.value = 0.095 * Math.max(0.6, cPull) * (1 + a.low * 0.9 + st.kickFlash * 0.6);

        // —— 声音 → 湖
        st.swell += ((0.022 + a.low * 0.055 + a.lowMid * 0.02) - st.swell) * K.expBlend(2.2, dt);
        st.micro += ((0.008 + a.high * 0.03 + a.highMid * 0.01) - st.micro) * K.expBlend(4, dt);
        st.kickFlash *= Math.pow(0.02, dt);
        st.glow += ((0.35 + a.energy * 0.35 + st.kickFlash * 1.25) - st.glow) * K.expBlend(9, dt);
        waterUniforms.uSwell.value = st.swell;
        waterUniforms.uMicro.value = st.micro;
        ringUniforms.uCircGlow.value = st.glow;
        waterUniforms.uLampI.value = 0.42 + a.mid * 0.5 + a.energy * 0.25 + st.kickFlash * 0.3;
        st.windAngle += (st.windTarget - st.windAngle) * K.expBlend(0.25, dt);
        waterUniforms.uWind.value.set(Math.cos(st.windAngle), Math.sin(st.windAngle));

        for (var i = 0; i < s.events.length; i++) {
          var ev = s.events[i];
          if (ev.type === 'kick') {
            var pt = Math.random() < 0.45
              ? pickWaterPoint(14, 40, 0.18, st.circleYaw)
              : pickWaterPoint(7, 30, 1.2);
            addRipple(pt.x, pt.z, 0.55 + ev.strength * 0.75, t);
            addEcho(0.5 + ev.strength * 0.7, t);
            st.kickFlash = Math.max(st.kickFlash, ev.strength);
          } else if (ev.type === 'hat') {
            if (t - st.lastRain > 0.05) {
              var n = ev.strength > 0.6 ? 2 : 1;
              for (var j = 0; j < n; j++) {
                var rp = pickWaterPoint(4, 26, 1.5);
                addRain(rp.x, rp.z, 0.4 + ev.strength * 0.8, t);
              }
              st.lastRain = t;
            }
          } else if (ev.type === 'phrase') {
            st.windTarget = st.windAngle + (Math.random() < 0.5 ? -1 : 1) * K.rand(0.4, 0.9);
            addEcho(1.1, t);
          }
        }
        // 很安静的时候也偶尔落一滴
        if (a.energy < 0.04 && Math.random() < dt * 0.25) {
          var q = pickWaterPoint(6, 22, 1.4);
          addRain(q.x, q.z, 0.7, t);
        }

        // —— 颜色：取封面主色
        var k = K.expBlend(2.5, dt);
        var prim = K.saturate(pal.primary, 0.85);
        var horizon = K.lift(prim, 0.10, 0.22).multiplyScalar(0.62);
        var zenith = pal.dark.clone().multiplyScalar(0.35).lerp(prim, 0.035);
        var waterC = pal.dark.clone().multiplyScalar(0.22).lerp(prim, 0.012);
        var ring = K.lift(pal.highlight.clone().lerp(new THREE.Color(1, 1, 1), 0.35), 0.6, 0.82);
        var lamp = K.lift(pal.highlight.clone().lerp(pal.primary, 0.3), 0.5, 0.75);
        K.lerpColor(waterUniforms.uHorizon, horizon, k);
        K.lerpColor(waterUniforms.uZenith, zenith, k);
        K.lerpColor(waterUniforms.uWater, waterC, k);
        K.lerpColor(ringUniforms.uRing, ring, k);
        K.lerpColor(waterUniforms.uLamp, lamp, k);
        skyUniforms.uStars.value = 0.55 + a.air * 1.2;
        waterUniforms.uReflI.value = 0.82 + a.mid * 0.25 + st.kickFlash * 0.12;
      },
      pointer: function (ray, strength, time) {
        root.updateMatrixWorld(true);
        st.inv.copy(root.matrixWorld).invert();
        var local = ray.clone().applyMatrix4(st.inv);
        var hit = new THREE.Vector3();
        if (!local.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return false;
        if (Math.sqrt(hit.x * hit.x + hit.z * hit.z) > waterUniforms.uEdge.value - 2) return false;
        addRipple(hit.x, hit.z, K.clamp(strength, 0.6, 2.2), time);
        return true;
      },
      dispose: function () {
        scene.remove(root);
        [water, circle, sky].forEach(function (m) { m.geometry.dispose(); m.material.dispose(); });
        if (RF.rt) RF.rt.dispose();
      }
    };
  }

  K.effects.push({
    key: 'lake',
    name: '镜湖',
    nameEn: 'MIRROR LAKE',
    desc: '地平线 · 落圆倒影',
    accent: '#e9dcc0', accent2: '#7fa3b8',
    orbit: { theta: 0.0, phi: 0.16, radius: 8.4 },
    starRiverAlpha: 0,
    starRiver: false,
    create: create
  });
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// 声纹沙 CHLADNI
// 悬着一块金属板，上面撒着细沙。声音让板振动，沙子从振得最凶的地方跑开，
// 停在不动的节线上，排出克拉尼图形。鼓点让沙粒跳；段落变化换振动模式，
// 段落越激烈、纹样越复杂。
// ============================================================
(function (global) {
  'use strict';
  var K = global.__NBStageKit;
  if (!K) return;

  var HALF = 3.15;              // 板子半边长（世界单位）
  var TABLE = 1024;
  var PI = Math.PI;
  // (n, m, 符号)：按复杂度分三档
  var MODES = [
    [[2, 5, -1], [3, 5, 1], [1, 4, 1], [2, 3, 1]],
    [[3, 7, 1], [2, 7, -1], [4, 7, -1], [1, 5, -1], [3, 4, -1]],
    [[5, 7, 1], [3, 8, -1], [5, 8, 1], [4, 9, -1], [6, 9, 1], [7, 10, -1]]
  ];
  var GRAIN_COUNT = { eco: 16000, balanced: 26000, high: 34000, ultra: 40000 };
  var GLOW_SHARE = 0.4;
  var SHOCK_SPEED = 2.4;   // 冲击环在板面上的传播速度（板半宽/秒）

  var MODE_GLSL = [
    'uniform vec3 uMode; uniform vec3 uModePrev; uniform float uModeMix;',
    'float nbChladni(vec2 q, vec3 md){',
    '  vec2 x = (q + 1.0) * 0.5;',
    '  return cos(md.x * 3.14159265 * x.x) * cos(md.y * 3.14159265 * x.y) + md.z * cos(md.y * 3.14159265 * x.x) * cos(md.x * 3.14159265 * x.y);',
    '}',
    'float nbField(vec2 q){ return mix(nbChladni(q, uModePrev), nbChladni(q, uMode), uModeMix); }'
  ].join('\n');

  var PLATE_VS = [
    'varying vec2 vQ; varying vec3 vP;',
    'uniform float uHalf;',
    'void main(){',
    '  vQ = position.xz / uHalf; vP = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');
  var PLATE_FS = [
    'uniform float uFade; uniform float uTime; uniform float uHalf;',
    'uniform vec3 uCamP; uniform vec3 uLightP; uniform vec3 uMetal; uniform vec3 uGlow; uniform vec3 uEdgeCol;',
    'uniform float uAmp; uniform float uHum; uniform float uFlash; uniform float uGuide; uniform float uShockT; uniform float uShockS;',
    MODE_GLSL,
    K.GLSL_COMMON,
    'varying vec2 vQ; varying vec3 vP;',
    'void main(){',
    '  vec2 q = vQ;',
    '  float r = length(q);',
    '  vec3 P = vec3(vP.x, 0.0, vP.z);',
    '  vec3 V = normalize(uCamP - P);',
    '  vec3 L = normalize(uLightP - P);',
    '  vec3 Hh = normalize(V + L);',
    // 以中心为圆心的拉丝：切向各向异性高光
    '  vec3 T = vec3(1.0, 0.0, 0.0);',
    '  float th = dot(T, Hh);',
    '  float aniso = pow(sqrt(max(0.0, 1.0 - th * th)), 22.0);',
    '  float brush = 0.78 + 0.22 * nbHash(vec2(floor((q.y + 1.0) * 700.0), 1.0));',
    '  float fres = pow(1.0 - max(dot(V, vec3(0.0, 1.0, 0.0)), 0.0), 4.0);',
    '  vec3 col = uMetal * (0.45 + 0.35 * brush) + uEdgeCol * aniso * brush * 0.17 + uEdgeCol * fres * 0.05;',
    // 振动场：很淡的余温，鼓点时腹点处亮一下
    '  float f = abs(nbField(q));',
    '  col += uGlow * (f * f * 0.25) * (0.025 + uAmp * 0.9 + uHum * 0.09);',
    // 边缘刻度（标尺感）
    '  float edgeD = 1.0 - max(abs(q.x), abs(q.y));',
    '  float along = abs(q.x) > abs(q.y) ? q.y : q.x;',
    '  float tick = step(fract(along * 16.0 + 0.5), 0.07) * step(edgeD, 0.035) * step(0.012, edgeD);',
    '  float major = step(fract(along * 4.0 + 0.5), 0.02) * step(edgeD, 0.06) * step(0.012, edgeD);',
    '  col += uEdgeCol * max(tick * 0.18, major * 0.3);',
    '  float rim = smoothstep(0.012, 0.0, edgeD);',
    '  col += uEdgeCol * rim * 0.35;',
    // 目标纹样的光线：换模式时先亮出新纹样，沙子再流过去
    '  float ft = nbChladni(q, uMode);',
    '  col += uGlow * exp(-ft * ft / 0.0022) * uGuide * 0.55;',
    // 鼓点：冲击环从中心扫过板面
    '  float sAge = uTime - uShockT;',
    '  float sFront = sAge * ' + SHOCK_SPEED.toFixed(2) + ';',
    '  col += uGlow * exp(-pow((r - sFront) / 0.07, 2.0)) * uShockS * exp(-sAge * 2.2) * step(0.0, sAge) * 0.28;',
    // 换模式时从中心荡开一圈
    '  col += uGlow * exp(-pow((r - uFlash * 1.6) / 0.05, 2.0)) * (1.0 - uFlash) * 0.35;',
    '  gl_FragColor = vec4(col, uFade);',
    '}'
  ].join('\n');

  var SAND_VS_BODY = [
    'uniform float uHalf; uniform float uHop; uniform float uSize; uniform float uViewH; uniform float uTime;',
    'uniform float uShockT; uniform float uShockS; uniform float uSizeMul; uniform float uMaxPx;',
    MODE_GLSL,
    'varying float vSeed; varying float vF; varying float vLift;',
    'void main(){',
    '  vec2 q = position.xy; float seed = position.z;',
    '  float f = abs(nbField(q));',
    '  float rnd = fract(seed * 7.31);',
    '  float jump = uHop * f * (0.35 + rnd);',
    // 冲击环经过时，节线上的沙也被掀起一下
    '  float sAge = uTime - uShockT;',
    '  float wave = exp(-pow((length(q) - sAge * ' + SHOCK_SPEED.toFixed(2) + ') / 0.09, 2.0)) * uShockS * exp(-sAge * 2.2) * step(0.0, sAge);',
    '  jump += wave * (0.045 + rnd * 0.07);',
    '  vec3 p = vec3(q.x * uHalf, 0.014 + jump, q.y * uHalf);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float s = uSize * uSizeMul * (0.7 + 0.6 * fract(seed * 13.7));',
    '  gl_PointSize = clamp(s * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z, 1.0, uMaxPx);',
    '  vSeed = seed; vF = f; vLift = wave + jump * 6.0;',
    '}'
  ].join('\n');
  var SAND_VS = SAND_VS_BODY;
  var SAND_FS = [
    'uniform float uFade; uniform vec3 uSand; uniform vec3 uSandDark; uniform float uGlint; uniform vec3 uGlintCol;',
    'varying float vSeed; varying float vF; varying float vLift;',
    'void main(){',
    '  vec2 pc = gl_PointCoord * 2.0 - 1.0;',
    '  float r2 = dot(pc, pc);',
    '  if (r2 > 1.0) discard;',
    '  vec3 n = vec3(pc.x, sqrt(1.0 - r2), -pc.y);',
    '  float lam = clamp(dot(n, normalize(vec3(-0.45, 0.75, 0.5))), 0.0, 1.0);',
    '  vec3 base = mix(uSand, uSandDark, fract(vSeed * 3.31) * 0.6);',
    '  vec3 col = base * (0.38 + 0.72 * lam);',
    '  float g = step(0.968, fract(vSeed * 91.7)) * uGlint;',
    '  col += uGlintCol * g * pow(lam, 6.0) * 1.6;',
    '  col *= 0.85 + 0.3 * smoothstep(0.6, 0.0, vF);',
    '  col += uGlintCol * clamp(vLift, 0.0, 1.0) * 0.45;',
    '  gl_FragColor = vec4(col, uFade);',
    '}'
  ].join('\n');

  // 沙粒的柔光层：同一批点，放大、叠加发光，让纹样远看也清楚
  var GLOW_FS = [
    'uniform float uFade; uniform vec3 uGlowSand; uniform float uGlowAmt; uniform float uGlowGain;',
    'varying float vSeed; varying float vF; varying float vLift;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  float a = exp(-d * d * 3.2) * (uGlowAmt + clamp(vLift, 0.0, 1.0) * 0.10) * smoothstep(0.7, 0.0, vF) * uFade * uGlowGain;',
    '  gl_FragColor = vec4(uGlowSand * a, a);',
    '}'
  ].join('\n');

  function metalMaterial(color, opts) {
    return new THREE.ShaderMaterial({
      uniforms: { uFade: { value: 0 }, uCol: { value: color }, uCamP: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uFade; uniform vec3 uCol; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(normalize(vN), V), 0.0), 3.0); float l = clamp(dot(normalize(vN), normalize(vec3(-0.4,0.8,0.45))), 0.0, 1.0); vec3 c = uCol * (0.25 + 0.75 * l) + vec3(1.0) * fr * 0.07; gl_FragColor = vec4(c, uFade); }',
      transparent: !!(opts && opts.transparent), depthWrite: true
    });
  }

  function create(scene) {
    var root = new THREE.Group();
    root.name = 'nb-stage-chladni';
    root.position.set(0, -3.1, -4.8);
    root.rotation.x = 0.56;
    root.scale.setScalar(0.94);
    var spin = new THREE.Group();
    root.add(spin);

    var fxq = (global.fx && global.fx.performanceQuality) || 'balanced';
    var N = GRAIN_COUNT[fxq] || GRAIN_COUNT.balanced;

    var modeU = { value: new THREE.Vector3(2, 5, -1) };
    var modePrevU = { value: new THREE.Vector3(2, 5, -1) };
    var modeMixU = { value: 1 };
    var fadeP = { value: 0 };

    var plateUniforms = {
      uFade: fadeP, uTime: { value: 0 }, uHalf: { value: HALF },
      uCamP: { value: new THREE.Vector3() }, uLightP: { value: new THREE.Vector3(-4, 6, -3) },
      uMetal: { value: new THREE.Color(0.03, 0.032, 0.036) },
      uGlow: { value: new THREE.Color(0.9, 0.6, 0.4) },
      uEdgeCol: { value: new THREE.Color(0.85, 0.85, 0.82) },
      uAmp: { value: 0 }, uHum: { value: 0 }, uFlash: { value: 1 },
      uGuide: { value: 1 }, uShockT: { value: -10 }, uShockS: { value: 0 },
      uMode: modeU, uModePrev: modePrevU, uModeMix: modeMixU
    };
    var plate = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2, HALF * 2, 1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: plateUniforms, vertexShader: PLATE_VS, fragmentShader: PLATE_FS, transparent: true, depthWrite: true })
    );
    plate.renderOrder = -2;
    spin.add(plate);

    var sideCol = new THREE.Color(0.05, 0.05, 0.055);
    var side = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.02, 0.07, HALF * 2 + 0.02).translate(0, -0.036, 0), metalMaterial(sideCol));
    side.renderOrder = -3;
    spin.add(side);
    var boltCol = new THREE.Color(0.2, 0.2, 0.21);
    var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 40).translate(0, 0.03, 0), metalMaterial(boltCol));
    spin.add(bolt);
    var stemCol = new THREE.Color(0.06, 0.06, 0.065);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 7, 24, 1, true).translate(0, -3.55, 0), metalMaterial(stemCol, { transparent: true }));
    spin.add(stem);

    // 沙粒
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i * 3] = Math.random() * 1.96 - 0.98;
      pos[i * 3 + 1] = Math.random() * 1.96 - 0.98;
      pos[i * 3 + 2] = Math.random();
    }
    var sandGeo = new THREE.BufferGeometry();
    var posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    sandGeo.setAttribute('position', posAttr);
    var sandUniforms = {
      uFade: fadeP, uHalf: { value: HALF }, uHop: { value: 0 }, uSize: { value: 0.028 },
      uViewH: { value: 900 }, uTime: plateUniforms.uTime,
      uShockT: plateUniforms.uShockT, uShockS: plateUniforms.uShockS, uSizeMul: { value: 1 }, uMaxPx: { value: 7 },
      uSand: { value: new THREE.Color(0.86, 0.8, 0.7) }, uSandDark: { value: new THREE.Color(0.5, 0.45, 0.4) },
      uGlint: { value: 0 }, uGlintCol: { value: new THREE.Color(1, 1, 1) },
      uMode: modeU, uModePrev: modePrevU, uModeMix: modeMixU
    };
    var sand = new THREE.Points(sandGeo, new THREE.ShaderMaterial({
      uniforms: sandUniforms, vertexShader: SAND_VS, fragmentShader: SAND_FS, transparent: true, depthWrite: true
    }));
    sand.frustumCulled = false;
    sand.renderOrder = -1;
    spin.add(sand);
    var glowUniforms = Object.assign({}, sandUniforms, {
      uSizeMul: { value: 3.6 }, uMaxPx: { value: 26 },
      uGlowSand: { value: new THREE.Color(1, 0.85, 0.6) }, uGlowAmt: { value: 0.05 },
      uGlowGain: { value: 1 / GLOW_SHARE * 0.9 }
    });
    // 柔光只用四成沙粒来画（沙粒顺序本来就是乱的，等于随机抽一部分），亮度补回来；
    // 拉近时光晕变大，全部沙粒都画一层光晕会很吃显卡
    var glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', posAttr);
    glowGeo.setDrawRange(0, Math.floor(N * GLOW_SHARE));
    var glow = new THREE.Points(glowGeo, K.additive(new THREE.ShaderMaterial({
      uniforms: glowUniforms, vertexShader: SAND_VS, fragmentShader: GLOW_FS, depthTest: true
    })));
    glow.frustumCulled = false;
    glow.renderOrder = 0;
    spin.add(glow);
    scene.add(root);

    // 查表：cos/sin(kπx), x ∈ [0,1]
    var tabs = {};
    function table(k) {
      if (tabs[k]) return tabs[k];
      var c = new Float32Array(TABLE + 1), s = new Float32Array(TABLE + 1);
      for (var j = 0; j <= TABLE; j++) { var x = j / TABLE; c[j] = Math.cos(k * PI * x); s[j] = Math.sin(k * PI * x); }
      tabs[k] = { c: c, s: s };
      return tabs[k];
    }

    var st = {
      level: 0, modeIdx: 0, mode: MODES[0][0], transition: 1.2, hum: 0, hop: 0, glint: 0,
      camLocal: new THREE.Vector3(), inv: new THREE.Matrix4(), yaw: 0, simAcc: 0, shake: 0, flash: 0,
      guide: 1, kicks: 0, lastChange: -99, bounce: 0, bounceV: 0
    };
    function setMode(md) {
      modePrevU.value.copy(modeU.value);
      modeU.value.set(md[0], md[1], md[2]);
      modeMixU.value = 0;
      st.mode = md;
      st.transition = 1;
      st.flash = 0;
      st.guide = 1;
      st.kicks = 0;
      st.lastChange = st.now || 0;
    }
    function nextMode(level) {
      var list = MODES[level];
      var idx = (st.level === level ? st.modeIdx + 1 : Math.floor(Math.random() * list.length)) % list.length;
      if (list[idx] === st.mode) idx = (idx + 1) % list.length;
      st.level = level; st.modeIdx = idx;
      setMode(list[idx]);
    }
    setMode(MODES[0][0]);
    modeMixU.value = 1;

    function simulate(dt, a) {
      var md = st.mode;
      var n = md[0], m = md[1], sg = md[2];
      var Tn = table(n), Tm = table(m);
      var Cn = Tn.c, Sn = Tn.s, Cm = Tm.c, Sm = Tm.s;
      var npi = n * PI * 0.5, mpi = m * PI * 0.5;
      var steps = dt * 60;
      var amp = (0.004 + a.low * 0.010 + st.hop * 0.034 + st.transition * 0.04 + a.energy * 0.004) * Math.sqrt(steps);
      var pull = 0.0016 * steps * (0.6 + st.transition);
      var arr = posAttr.array;
      for (var i = 0, k = 0; i < N; i++, k += 3) {
        var u = arr[k], v = arr[k + 1];
        var ix = ((u + 1) * 0.5 * TABLE) | 0, iy = ((v + 1) * 0.5 * TABLE) | 0;
        var cnx = Cn[ix], cmy = Cm[iy], cmx = Cm[ix], cny = Cn[iy];
        var f = cnx * cmy + sg * cmx * cny;
        var af = f < 0 ? -f : f;
        var dfu = -npi * Sn[ix] * cmy - sg * mpi * Sm[ix] * cny;
        var dfv = -mpi * cnx * Sm[iy] - sg * npi * cmx * Sn[iy];
        var step = amp * af;
        u += (Math.random() - 0.5) * step - pull * f * dfu * 0.25;
        v += (Math.random() - 0.5) * step - pull * f * dfv * 0.25;
        if (u > 0.985) u = 1.97 - u; else if (u < -0.985) u = -1.97 - u;
        if (v > 0.985) v = 1.97 - v; else if (v < -0.985) v = -1.97 - v;
        arr[k] = u; arr[k + 1] = v;
      }
      posAttr.needsUpdate = true;
    }

    return {
      root: root,
      update: function (dt, s) {
        var a = s.audio, t = s.time, pal = s.palette;
        fadeP.value = s.fade;
        plateUniforms.uTime.value = t;
        st.now = t;
        var eSlow = global.NotBlindStageFx && NotBlindStageFx._clock ? NotBlindStageFx._clock.eSlow : a.energy;
        var lvlNow = eSlow < 0.2 ? 0 : (eSlow < 0.36 ? 1 : 2);
        for (var i = 0; i < s.events.length; i++) {
          var ev = s.events[i];
          if (ev.type === 'kick') {
            st.hop = Math.max(st.hop, ev.strength); st.hum = Math.max(st.hum, ev.strength); st.shake = Math.max(st.shake, ev.strength);
            plateUniforms.uShockT.value = t; plateUniforms.uShockS.value = 0.55 + ev.strength * 0.65;
            st.bounceV -= 0.22 * ev.strength;
            st.kicks++;
            // 每 16 个鼓点（约 4 小节）换一个纹样
            if (st.kicks >= 16 && t - st.lastChange > 6) nextMode(lvlNow);
          }
          else if (ev.type === 'hat') st.glint = Math.max(st.glint, 0.4 + ev.strength * 0.6);
          else if (ev.type === 'phrase') {
            if (t - st.lastChange > 5) nextMode(ev.reason === 'lift' ? Math.min(2, lvlNow + 1) : lvlNow);
          }
        }
        // 没有鼓点的歌：过一阵也换
        if (t - st.lastChange > 24) nextMode(lvlNow);
        st.guide = Math.max(0, st.guide - dt / 2.6);
        plateUniforms.uGuide.value = 0.10 + K.smooth01(st.guide) * 0.9;
        st.hop *= Math.pow(0.004, dt);
        st.hum *= Math.pow(0.05, dt);
        st.glint *= Math.pow(0.02, dt);
        st.shake *= Math.pow(0.0005, dt);
        st.transition = Math.max(0, st.transition - dt / 2.6);
        modeMixU.value = Math.min(1, modeMixU.value + dt / 0.9);
        st.flash = Math.min(1, st.flash + dt / 1.6);

        // 模拟（上限 60 次/秒）
        st.simAcc += dt;
        if (st.simAcc >= 1 / 62) { simulate(Math.min(st.simAcc, 1 / 20), a); st.simAcc = 0; }

        // 视角：板子绕自己的法线慢慢转；鼓点时整块板被“敲”一下（弹簧回弹）
        // 拖动时整块板随舞台（和歌词一起）转，由管理器的舞台组负责
        st.yaw += dt * (0.018 + a.mid * 0.02);
        spin.rotation.y = st.yaw;
        st.bounceV += (-st.bounce * 180 - st.bounceV * 14) * dt;
        st.bounce += st.bounceV * dt;
        spin.position.y = st.bounce * 0.35;
        root.rotation.x = 0.56;
        root.rotation.z = Math.sin(t * 0.13) * 0.012;

        root.updateMatrixWorld(true);
        st.inv.copy(spin.matrixWorld).invert();
        st.camLocal.copy(s.camera.position).applyMatrix4(st.inv);
        plateUniforms.uCamP.value.copy(st.camLocal);
        plateUniforms.uLightP.value.set(-4, 7, -2).applyMatrix4(st.inv);
        plateUniforms.uAmp.value = a.low * 0.12 + a.mid * 0.05;
        plateUniforms.uHum.value = st.hum;
        plateUniforms.uFlash.value = st.flash;
        sandUniforms.uHop.value = st.hop * 0.16 + a.sub * 0.008;
        plateUniforms.uShockS.value *= Math.pow(0.35, dt);
        sandUniforms.uGlint.value = st.glint;
        var ctx = s.ctx || {};
        var dprS = ctx.dpr || global.devicePixelRatio || 1;
        sandUniforms.uViewH.value = (ctx.screenHeight || global.innerHeight || 900) * dprS;
        sandUniforms.uMaxPx.value = 7 * dprS;
        glowUniforms.uMaxPx.value = 20 * dprS;
        // 离得越远，柔光越强一点，纹样远看也清楚
        glowUniforms.uGlowAmt.value = K.clamp(0.035 + (s.camDist - 7) * 0.004, 0.03, 0.075) * (1 + st.hum * 0.6);
        [side, bolt, stem].forEach(function (m) { m.material.uniforms.uFade.value = s.fade; });

        var k = K.expBlend(2.5, dt);
        var sandC = K.lift(pal.highlight.clone().lerp(new THREE.Color(0.95, 0.9, 0.82), 0.45), 0.7, 0.88);
        K.lerpColor(glowUniforms.uGlowSand, K.lift(pal.highlight.clone().lerp(pal.primary, 0.35), 0.6, 0.8), k);
        K.lerpColor(sandUniforms.uSand, sandC, k);
        K.lerpColor(sandUniforms.uSandDark, sandC.clone().multiplyScalar(0.55).lerp(pal.primary, 0.12), k);
        K.lerpColor(plateUniforms.uGlow, K.lift(K.saturate(pal.primary, 1.1), 0.35, 0.6), k);
        K.lerpColor(plateUniforms.uMetal, pal.dark.clone().multiplyScalar(0.25).add(new THREE.Color(0.022, 0.023, 0.026)), k);
        K.lerpColor(plateUniforms.uEdgeCol, K.lift(pal.highlight, 0.6, 0.8), k);
        K.lerpColor(sandUniforms.uGlintCol, K.lift(pal.highlight, 0.8, 0.95), k);
      },
      pointer: function (ray) {
        root.updateMatrixWorld(true);
        var nrm = new THREE.Vector3(0, 1, 0).transformDirection(spin.matrixWorld);
        var ptOn = new THREE.Vector3().setFromMatrixPosition(spin.matrixWorld);
        var plane = new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, ptOn);
        var hit = new THREE.Vector3();
        if (!ray.intersectPlane(plane, hit)) return false;
        hit.applyMatrix4(st.inv);
        if (Math.abs(hit.x) > HALF * 1.15 || Math.abs(hit.z) > HALF * 1.15) return false;
        var lvl = st.level;
        nextMode(lvl);
        st.hop = 1; st.hum = 1;
        plateUniforms.uShockT.value = st.now || 0; plateUniforms.uShockS.value = 1.3;
        st.bounceV -= 0.3;
        return true;
      },
      dispose: function () {
        scene.remove(root);
        [plate, side, bolt, stem, sand].forEach(function (m) { m.geometry.dispose(); m.material.dispose(); });
        glow.material.dispose(); glowGeo.dispose();
      }
    };
  }

  K.effects.push({
    key: 'chladni',
    name: '声纹沙',
    nameEn: 'CHLADNI',
    desc: '振板细沙 · 节线成纹',
    accent: '#eadcc4', accent2: '#c98a5c',
    orbit: { theta: 0.0, phi: 0.28, radius: 7.4 },
    starRiverAlpha: 0.08,
    starRiver: false,
    create: create
  });
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// 铜雨 KINETIC RAIN
// 头顶悬着几百颗铜滴，每颗挂在一根细丝上，一起升降，组成会变形的曲面。
// 低音让曲面起伏更大；鼓点从某处荡开一圈波；高音让一部分铜滴闪一下；
// 段落变化时换一个造型（斜浪 / 圆波 / 马鞍 / 穹底 / 螺旋 / 交织）。
// ============================================================
(function (global) {
  'use strict';
  var K = global.__NBStageKit;
  if (!K) return;

  var NX = 32, NZ = 19;
  var SPACING = 0.5;
  var HALF_W = (NX - 1) * SPACING / 2;
  var HALF_D = (NZ - 1) * SPACING / 2;
  var RIP = 8;
  var SHAPES = 6;
  var CEIL = 15;

  var HEIGHT_GLSL = [
    'uniform float uPhase; uniform float uAmp; uniform float uShapeA; uniform float uShapeB; uniform float uMix;',
    'uniform vec4 uRip[' + RIP + ']; uniform float uTime;',
    'mat2 nbRot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }',
    'float nbShape(float id, vec2 p, float t){',
    '  if (id < 0.5) return sin(p.x * 3.0 + p.y * 2.2 - t * 0.8) * 0.85;',
    '  if (id < 1.5) { float r = length(p * vec2(1.0, 1.55)); return cos(r * 6.5 - t * 1.25) * exp(-r * 0.45) * 0.9; }',
    '  if (id < 2.5) { vec2 q = nbRot(t * 0.11) * p; return (q.x * q.x - q.y * q.y * 1.7) * 1.05; }',
    '  if (id < 3.5) { return (dot(p * vec2(1.0, 1.3), p * vec2(1.0, 1.3)) - 0.62) * 1.05 * (0.86 + 0.14 * sin(t * 0.9)); }',
    '  if (id < 4.5) { float r = length(p * vec2(1.0, 1.4)); return sin(atan(p.y * 1.4, p.x) * 2.0 + r * 6.0 - t * 1.0) * smoothstep(0.0, 0.35, r) * 0.85; }',
    '  return 0.55 * (sin(p.x * 4.2 - t * 0.9) + sin(p.y * 5.0 + t * 0.7));',
    '}',
    'float nbHeight(vec2 p){',
    '  float h = mix(nbShape(uShapeA, p, uPhase), nbShape(uShapeB, p, uPhase), uMix) * uAmp;',
    '  vec2 w = p * vec2(' + HALF_W.toFixed(4) + ', ' + HALF_D.toFixed(4) + ');',
    '  for (int i = 0; i < ' + RIP + '; i++) {',
    '    vec4 r = uRip[i];',
    '    if (r.w <= 0.0) continue;',
    '    float age = uTime - r.z;',
    '    if (age < 0.0 || age > 5.0) continue;',
    '    float d = length(w - r.xy) - age * 4.2;',
    '    h -= r.w * exp(-d * d / 0.9) * exp(-age * 0.75) * 0.75;',
    '  }',
    '  return h;',
    '}'
  ].join('\n');

  var DROP_VS = [
    'attribute vec2 aGrid; attribute float aSeed;',
    HEIGHT_GLSL,
    'varying vec3 vN; varying vec3 vW; varying float vSeed; varying float vH;',
    'void main(){',
    '  float h = nbHeight(aGrid);',
    '  vec3 off = vec3(aGrid.x * ' + HALF_W.toFixed(4) + ' + sin(uTime * 0.7 + aSeed * 20.0) * 0.012, h, aGrid.y * ' + HALF_D.toFixed(4) + ' + cos(uTime * 0.6 + aSeed * 13.0) * 0.012);',
    '  vec4 wp = modelMatrix * vec4(position + off, 1.0);',
    '  vN = normalize(mat3(modelMatrix) * normal);',
    '  vW = wp.xyz; vSeed = aSeed; vH = h;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');
  var DROP_FS = [
    'uniform float uFade; uniform vec3 uMetal; uniform vec3 uFloor; uniform vec3 uHorizon; uniform vec3 uCeil;',
    'uniform vec3 uKey; uniform vec3 uFog; uniform float uGlint; uniform float uGlintT; uniform float uGlintSeed; uniform float uTime;',
    'uniform float uKick;',
    'varying vec3 vN; varying vec3 vW; varying float vSeed; varying float vH;',
    'vec3 nbEnv(vec3 R){',
    '  float y = R.y;',
    '  vec3 c = mix(uFloor, uHorizon, smoothstep(-0.55, 0.02, y));',
    '  c = mix(c, uCeil, smoothstep(0.02, 0.75, y));',
    '  c += uKey * smoothstep(0.90, 0.985, dot(R, normalize(vec3(-0.35, 0.50, 0.79)))) * 1.5;',
    '  c += uKey * smoothstep(0.95, 0.995, dot(R, normalize(vec3(0.58, 0.30, 0.76)))) * 0.7;',
    '  c += uHorizon * pow(max(dot(R, normalize(vec3(0.0, -0.35, 0.94))), 0.0), 5.0) * 0.9;',
    '  return c;',
    '}',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  vec3 R = reflect(-V, N);',
    '  float ct = max(dot(N, V), 0.0);',
    '  vec3 F = uMetal + (1.0 - uMetal) * pow(1.0 - ct, 5.0);',
    '  vec3 col = nbEnv(R) * F + uMetal * 0.025;',
    '  float g = step(0.88, fract(vSeed * 53.1 + uGlintSeed)) * uGlint * exp(-(uTime - uGlintT) * 5.0);',
    '  col += uKey * g * (0.6 + 1.2 * pow(max(dot(R, normalize(vec3(-0.35, 0.5, 0.79))), 0.0), 3.0));',
    '  col *= 1.0 + uKick * 0.25 * smoothstep(0.2, -0.8, vH);',
    '  float d = length(vW - cameraPosition);',
    '  col = mix(col, uFog, smoothstep(9.0, 24.0, d) * 0.72);',
    '  gl_FragColor = vec4(col, uFade);',
    '}'
  ].join('\n');

  var WIRE_VS = [
    'attribute vec2 aGrid; attribute float aSeed; attribute float aEnd;',
    HEIGHT_GLSL,
    'varying float vEnd; varying float vDist;',
    'void main(){',
    '  float h = nbHeight(aGrid);',
    '  vec3 p = vec3(aGrid.x * ' + HALF_W.toFixed(4) + ' + (1.0 - aEnd) * sin(uTime * 0.7 + aSeed * 20.0) * 0.012, mix(h + 0.005, ' + CEIL.toFixed(1) + ', aEnd), aGrid.y * ' + HALF_D.toFixed(4) + ');',
    '  vec4 wp = modelMatrix * vec4(p, 1.0);',
    '  vEnd = aEnd; vDist = length(wp.xyz - cameraPosition);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');
  var WIRE_FS = [
    'uniform float uFade; uniform vec3 uWire;',
    'varying float vEnd; varying float vDist;',
    'void main(){',
    '  float a = (1.0 - smoothstep(0.0, 0.55, vEnd)) * (1.0 - smoothstep(10.0, 24.0, vDist) * 0.7) * 0.11 * uFade;',
    '  gl_FragColor = vec4(uWire * a, a);',
    '}'
  ].join('\n');

  function dropGeometry() {
    var pts = [];
    var H = 0.3, R = 0.092, S = 16;
    for (var i = 0; i <= S; i++) {
      var s = i / S;
      var r;
      if (s < 0.5) r = R * Math.pow(s / 0.5, 0.85) * (0.35 + 0.65 * (s / 0.5));
      else r = R * Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.5) / 0.5, 2)));
      pts.push(new THREE.Vector2(Math.max(0.0001, r), -s * H));
    }
    pts[0].x = 0.0001;
    return new THREE.LatheGeometry(pts, 18);
  }

  function create(scene) {
    var root = new THREE.Group();
    root.name = 'nb-stage-kinetic-rain';
    root.position.set(0, 2.7, -6.2);

    var N = NX * NZ;
    var grid = new Float32Array(N * 2), seed = new Float32Array(N);
    var k = 0;
    for (var iz = 0; iz < NZ; iz++) {
      for (var ix = 0; ix < NX; ix++) {
        grid[k * 2] = ix / (NX - 1) * 2 - 1;
        grid[k * 2 + 1] = iz / (NZ - 1) * 2 - 1;
        seed[k] = Math.random();
        k++;
      }
    }

    var shared = {
      uTime: { value: 0 }, uPhase: { value: 0 }, uAmp: { value: 0.9 },
      uShapeA: { value: 0 }, uShapeB: { value: 0 }, uMix: { value: 1 },
      uRip: { value: (function () { var a = []; for (var i = 0; i < RIP; i++) a.push(new THREE.Vector4(0, 0, -100, 0)); return a; })() },
      uFade: { value: 0 }
    };

    var base = dropGeometry();
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('normal', base.getAttribute('normal'));
    geo.setAttribute('aGrid', new THREE.InstancedBufferAttribute(grid, 2));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    geo.instanceCount = N;
    var dropUniforms = Object.assign({
      uMetal: { value: new THREE.Color(0.95, 0.64, 0.54) },
      uFloor: { value: new THREE.Color(0.02, 0.015, 0.012) },
      uHorizon: { value: new THREE.Color(0.35, 0.22, 0.16) },
      uCeil: { value: new THREE.Color(0.015, 0.014, 0.014) },
      uKey: { value: new THREE.Color(1, 0.95, 0.88) },
      uFog: { value: new THREE.Color(0.03, 0.02, 0.02) },
      uGlint: { value: 0 }, uGlintT: { value: -10 }, uGlintSeed: { value: 0 }, uKick: { value: 0 }
    }, shared);
    var drops = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: dropUniforms, vertexShader: DROP_VS, fragmentShader: DROP_FS,
      transparent: true, depthWrite: true
    }));
    drops.frustumCulled = false;
    drops.renderOrder = -2;
    root.add(drops);

    var wGrid = new Float32Array(N * 4), wSeed = new Float32Array(N * 2), wEnd = new Float32Array(N * 2), wPos = new Float32Array(N * 6);
    for (var i = 0; i < N; i++) {
      wGrid[i * 4] = wGrid[i * 4 + 2] = grid[i * 2];
      wGrid[i * 4 + 1] = wGrid[i * 4 + 3] = grid[i * 2 + 1];
      wSeed[i * 2] = wSeed[i * 2 + 1] = seed[i];
      wEnd[i * 2] = 0; wEnd[i * 2 + 1] = 1;
    }
    var wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wgeo.setAttribute('aGrid', new THREE.BufferAttribute(wGrid, 2));
    wgeo.setAttribute('aSeed', new THREE.BufferAttribute(wSeed, 1));
    wgeo.setAttribute('aEnd', new THREE.BufferAttribute(wEnd, 1));
    var wireUniforms = Object.assign({ uWire: { value: new THREE.Color(0.9, 0.85, 0.8) } }, shared);
    var wires = new THREE.LineSegments(wgeo, K.additive(new THREE.ShaderMaterial({
      uniforms: wireUniforms, vertexShader: WIRE_VS, fragmentShader: WIRE_FS
    })));
    wires.frustumCulled = false;
    wires.renderOrder = -3;
    root.add(wires);
    scene.add(root);

    var st = {
      phase: 0, shape: 0, amp: 0.9, rip: 0, kick: 0, yaw: 0, order: [0, 1, 2, 3, 4, 5], orderIdx: 0,
      inv: new THREE.Matrix4()
    };
    function addRipple(x, z, s, t) {
      shared.uRip.value[st.rip].set(x, z, t, s);
      st.rip = (st.rip + 1) % RIP;
    }
    function nextShape() {
      if (st.mixT < 0.8) return;
      st.orderIdx = (st.orderIdx + 1) % SHAPES;
      shared.uShapeA.value = shared.uShapeB.value;
      shared.uShapeB.value = st.order[st.orderIdx];
      shared.uMix.value = 0;
      st.mixT = 0;
    }
    st.mixT = 1;

    return {
      root: root,
      update: function (dt, s) {
        var a = s.audio, t = s.time, pal = s.palette;
        shared.uFade.value = s.fade;
        shared.uTime.value = t;
        st.phase += dt * (0.55 + a.mid * 0.9 + a.energy * 0.3);
        shared.uPhase.value = st.phase;
        st.amp += ((0.62 + a.low * 0.75 + a.lowMid * 0.2) - st.amp) * K.expBlend(2.4, dt);
        shared.uAmp.value = st.amp;
        st.mixT = Math.min(1, st.mixT + dt / 3.6);
        shared.uMix.value = K.smooth01(st.mixT);
        st.kick *= Math.pow(0.03, dt);
        dropUniforms.uKick.value = st.kick;

        for (var i = 0; i < s.events.length; i++) {
          var ev = s.events[i];
          if (ev.type === 'kick') {
            var cx = (Math.random() * 2 - 1) * HALF_W * 0.75, cz = (Math.random() * 2 - 1) * HALF_D * 0.7;
            if (Math.random() < 0.35) { cx = 0; cz = 0; }
            addRipple(cx, cz, 0.5 + ev.strength * 0.6, t);
            st.kick = Math.max(st.kick, ev.strength);
          } else if (ev.type === 'hat') {
            dropUniforms.uGlint.value = 0.5 + ev.strength * 0.8;
            dropUniforms.uGlintT.value = t;
            dropUniforms.uGlintSeed.value = Math.random();
          } else if (ev.type === 'phrase') {
            nextShape();
          }
        }
        // 视角：像在装置下面慢慢走
        st.yaw += dt * 0.05;
        root.rotation.y = Math.sin(st.yaw) * 0.16;
        root.position.y = 2.7 - st.kick * 0.03;

        var k = K.expBlend(2.5, dt);
        var copper = new THREE.Color(0.95, 0.64, 0.54);
        var metal = copper.lerp(K.lift(pal.highlight, 0.55, 0.8), 0.42);
        K.lerpColor(dropUniforms.uMetal, metal, k);
        K.lerpColor(dropUniforms.uHorizon, K.lift(K.saturate(pal.primary, 0.9), 0.14, 0.28).multiplyScalar(1.3), k);
        K.lerpColor(dropUniforms.uFloor, pal.dark.clone().multiplyScalar(0.4), k);
        K.lerpColor(dropUniforms.uCeil, pal.dark.clone().multiplyScalar(0.3).lerp(pal.secondary, 0.03), k);
        K.lerpColor(dropUniforms.uKey, K.lift(pal.highlight.clone().lerp(new THREE.Color(1, 1, 1), 0.5), 0.85, 0.97), k);
        K.lerpColor(dropUniforms.uFog, pal.dark.clone().multiplyScalar(0.5).lerp(pal.primary, 0.05), k);
        K.lerpColor(wireUniforms.uWire, K.lift(pal.highlight, 0.7, 0.9), k);
      },
      pointer: function (ray, strength, time) {
        root.updateMatrixWorld(true);
        st.inv.copy(root.matrixWorld).invert();
        var local = ray.clone().applyMatrix4(st.inv);
        var hit = new THREE.Vector3();
        if (!local.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.3), hit)) return false;
        if (Math.abs(hit.x) > HALF_W * 1.2 || Math.abs(hit.z) > HALF_D * 1.3) return false;
        addRipple(hit.x, hit.z, K.clamp(strength, 0.6, 1.8), time);
        st.kick = 1;
        return true;
      },
      dispose: function () {
        scene.remove(root);
        base.dispose(); geo.dispose(); drops.material.dispose(); wgeo.dispose(); wires.material.dispose();
      }
    };
  }

  K.effects.push({
    key: 'rain',
    name: '铜雨',
    nameEn: 'KINETIC RAIN',
    desc: '悬丝铜滴 · 曲面起伏',
    accent: '#f0b48e', accent2: '#e9dcc0',
    orbit: { theta: 0.0, phi: 0.0, radius: 7.6 },
    starRiverAlpha: 0.22,
    starRiver: true,
    create: create
  });
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// 谐振 HARMONOGRAPH
// 一台看不见的摆锤画图仪：笔尖按音程比例（五度 3:2、四度 4:3、三度 5:4……）摆动，
// 在空中一笔一笔画出图形，摆幅慢慢衰减；画完一幅换一个音程再画。外圈是一把刻度尺。
// 鼓点让笔尖加速、一道光沿刚画的线往回跑；低音让线更粗更亮；高音让笔尖掉光屑。
// ============================================================
(function (global) {
  'use strict';
  var K = global.__NBStageKit;
  if (!K) return;

  var SAMPLES = 8400;
  var DUST = 320;
  var RING_R = 3.55;
  var INTERVALS = [
    { r: 2, name: '八度' }, { r: 1.5, name: '纯五度' }, { r: 4 / 3, name: '纯四度' },
    { r: 5 / 3, name: '大六度' }, { r: 1.25, name: '大三度' }, { r: 1.2, name: '小三度' }
  ];

  // 旋转式摆锤画图仪：两只做圆周摆动的摆锤叠加，画出带中空的花环（中间留给歌词）
  var CURVE_GLSL = [
    'uniform vec4 uW; uniform vec4 uPh; uniform vec4 uAmp; uniform vec3 uZ; uniform float uDamp; uniform float uScale;',
    'vec3 nbCurve(float t){',
    '  float e = exp(-uDamp * t);',
    '  float a1 = uW.x * t + uPh.x, a2 = uW.y * t + uPh.y;',
    '  float x = uAmp.x * cos(a1) + uAmp.y * cos(a2);',
    '  float y = uAmp.x * sin(a1) + uAmp.y * sin(a2);',
    '  float z = uAmp.z * sin(uW.z * t + uPh.z);',
    '  return vec3(x, y, z) * e * uScale;',
    '}'
  ].join('\n');

  var LINE_VS = [
    'attribute float aIdx; attribute float aSide;',
    'uniform float uT; uniform float uPen; uniform vec2 uViewport; uniform float uWidth;',
    CURVE_GLSL,
    'varying float vTau; varying float vSide; varying float vDepth;',
    'void main(){',
    '  float tau = aIdx * uT;',
    '  vec3 p0 = nbCurve(tau);',
    '  vec3 p1 = nbCurve(tau + 0.03);',
    '  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);',
    '  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(p1, 1.0);',
    '  vec2 s0 = c0.xy / c0.w, s1 = c1.xy / c1.w;',
    '  vec2 d = (s1 - s0) * uViewport;',
    '  d = d / max(length(d), 1e-5);',
    '  vec2 n = vec2(-d.y, d.x);',
    '  float w = uWidth + 11.0;',
    '  c0.xy += n * w / uViewport * c0.w * aSide;',
    '  gl_Position = c0;',
    '  vTau = tau; vSide = aSide * w * 0.5; vDepth = c0.w;',
    '}'
  ].join('\n');
  var LINE_FS = [
    'uniform float uT; uniform float uPen; uniform float uFade; uniform float uFig; uniform float uTime; uniform float uDamp;',
    'uniform float uPulseT; uniform float uPulseS; uniform float uBright; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uHead;',
    'uniform float uWidth;',
    'varying float vTau; varying float vSide; varying float vDepth;',
    'void main(){',
    '  if (vTau > uPen) discard;',
    '  float px = abs(vSide);',
    '  float core = 1.0 - smoothstep(uWidth * 0.5 - 0.4, uWidth * 0.5 + 0.8, px);',
    '  float halo = exp(-px * px / 9.0) * 0.22;',
    '  float edge = core + halo * (1.0 - core);',
    '  float env = exp(-uDamp * vTau * 2.0);',
    '  float age = uPen - vTau;',
    '  float recent = exp(-age / 5.0);',
    '  float pAge = uTime - uPulseT;',
    '  float pPos = uPen - pAge * 14.0;',
    '  float pulse = exp(-pow(vTau - pPos, 2.0) / 1.2) * uPulseS * exp(-pAge * 0.9) * step(0.0, pAge);',
    '  float depth = smoothstep(16.0, 9.0, vDepth) * 0.55 + 0.45;',
    '  float a = (0.10 + 0.30 * env) * uBright + recent * 0.7 + pulse * 0.62;',
    '  vec3 col = mix(uColA, uColB, clamp(vTau / uT, 0.0, 1.0));',
    '  col = mix(col, uHead, clamp(recent * 0.8 + pulse * 0.7, 0.0, 1.0));',
    '  a *= edge * depth * uFade * uFig;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var RING_VS = [
    'attribute float aAng; attribute float aMajor;',
    'varying float vAng; varying float vMajor;',
    'void main(){ vAng = aAng; vMajor = aMajor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');
  var RING_FS = [
    'uniform float uFade; uniform float uPenAng; uniform vec3 uCol; uniform vec3 uHot; uniform float uMid;',
    'varying float vAng; varying float vMajor;',
    'void main(){',
    '  float d = abs(atan(sin(vAng - uPenAng), cos(vAng - uPenAng)));',
    '  float hot = exp(-d * d / 0.004) * (0.5 + uMid);',
    '  float a = (0.13 + vMajor * 0.2) + hot * 0.7;',
    '  vec3 c = mix(uCol, uHot, clamp(hot * 1.4, 0.0, 1.0));',
    '  gl_FragColor = vec4(c * a * uFade, a * uFade);',
    '}'
  ].join('\n');

  var DUST_VS = [
    'attribute float aLife; attribute float aSize;',
    'uniform float uViewH;',
    'varying float vLife;',
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vLife = aLife;',
    '  gl_PointSize = max(1.0, aSize * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z); }'
  ].join('\n');
  var DUST_FS = [
    'uniform float uFade; uniform vec3 uCol; varying float vLife;',
    'void main(){ float d = length(gl_PointCoord - 0.5); if (vLife <= 0.0) discard; float a = smoothstep(0.5, 0.0, d) * vLife * uFade; gl_FragColor = vec4(uCol * a, a); }'
  ].join('\n');

  function curveJS(fig, t, out) {
    var e = Math.exp(-fig.damp * t) * fig.scale;
    var a1 = fig.w[0] * t + fig.ph[0], a2 = fig.w[1] * t + fig.ph[1];
    out.set(
      (fig.amp[0] * Math.cos(a1) + fig.amp[1] * Math.cos(a2)) * e,
      (fig.amp[0] * Math.sin(a1) + fig.amp[1] * Math.sin(a2)) * e,
      fig.amp[2] * Math.sin(fig.w[2] * t + fig.ph[2]) * e
    );
    return out;
  }

  // 音程 p:q → 第二只摆锤转速 = p/q（反向转），图形有 p+q 瓣；再加一点点失谐让花环慢慢转开
  function makeFigure(level) {
    var pool = level === 0 ? [0, 1, 2] : (level === 1 ? [1, 2, 3] : [3, 4, 5]);
    var iv = INTERVALS[pool[Math.floor(Math.random() * pool.length)]];
    var dir = Math.random() < 0.75 ? -1 : 1;
    var eps = (Math.random() < 0.5 ? -1 : 1) * K.rand(0.0028, 0.0055);
    var revs = 38;
    var T = Math.PI * 2 * revs;
    var damp = K.rand(0.34, 0.46) / T;
    var a2 = K.rand(0.36, 0.46);
    return {
      interval: iv,
      w: [1, dir * (iv.r + eps), K.rand(2.0, 3.0), 0],
      ph: [Math.random() * 6.283, Math.random() * 6.283, Math.random() * 6.283, 0],
      amp: [1.0, a2, K.rand(0.14, 0.22), 0],
      damp: damp, T: T, scale: 2.3
    };
  }

  function create(scene) {
    var root = new THREE.Group();
    root.name = 'nb-stage-harmonograph';
    root.position.set(0, 0.12, -4.4);
    var tumble = new THREE.Group();
    root.add(tumble);

    // ribbon geometry（两份：当前 + 上一幅）
    var idx = new Float32Array(SAMPLES * 2), side = new Float32Array(SAMPLES * 2), posArr = new Float32Array(SAMPLES * 6);
    var index = [];
    for (var i = 0; i < SAMPLES; i++) {
      idx[i * 2] = idx[i * 2 + 1] = i / (SAMPLES - 1);
      side[i * 2] = -1; side[i * 2 + 1] = 1;
      if (i < SAMPLES - 1) { var a0 = i * 2; index.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    lineGeo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
    lineGeo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    lineGeo.setIndex(index);

    var fadeU = { value: 0 }, timeU = { value: 0 }, viewportU = { value: new THREE.Vector2(1600, 900) }, widthU = { value: 1.4 };
    var colA = { value: new THREE.Color(0.9, 0.6, 0.4) }, colB = { value: new THREE.Color(0.6, 0.5, 0.9) }, headC = { value: new THREE.Color(1, 0.95, 0.9) };
    var brightU = { value: 1 };
    function makeRibbon() {
      var u = {
        uW: { value: new THREE.Vector4() }, uPh: { value: new THREE.Vector4() }, uAmp: { value: new THREE.Vector4() },
        uZ: { value: new THREE.Vector3() }, uDamp: { value: 0.012 }, uScale: { value: 1.5 },
        uT: { value: 100 }, uPen: { value: 0 }, uFig: { value: 1 }, uPulseT: { value: -10 }, uPulseS: { value: 0 },
        uFade: fadeU, uTime: timeU, uViewport: viewportU, uWidth: widthU, uColA: colA, uColB: colB, uHead: headC, uBright: brightU
      };
      var m = new THREE.Mesh(lineGeo, K.additive(new THREE.ShaderMaterial({
        uniforms: u, vertexShader: LINE_VS, fragmentShader: LINE_FS, depthTest: true, side: THREE.DoubleSide
      })));
      m.frustumCulled = false;
      m.renderOrder = -2;
      tumble.add(m);
      return { mesh: m, u: u, fig: null, pen: 0, state: 'idle', fade: 0, hold: 0 };
    }
    var ribbons = [makeRibbon(), makeRibbon()];
    function loadFig(rb, fig) {
      rb.fig = fig;
      rb.u.uW.value.set(fig.w[0], fig.w[1], fig.w[2], fig.w[3]);
      rb.u.uPh.value.set(fig.ph[0], fig.ph[1], fig.ph[2], fig.ph[3]);
      rb.u.uAmp.value.set(fig.amp[0], fig.amp[1], fig.amp[2], fig.amp[3]);
      rb.u.uZ.value.set(0, 0, 0);
      rb.u.uDamp.value = fig.damp; rb.u.uScale.value = fig.scale; rb.u.uT.value = fig.T;
      rb.pen = 0; rb.state = 'draw'; rb.fade = 1; rb.hold = 0;
      rb.u.uFig.value = 1; rb.mesh.scale.setScalar(1);
    }

    // 刻度尺
    var ringPos = [], ringAng = [], ringMajor = [];
    var SEG = 256, TICKS = 180;
    for (var s2 = 0; s2 < SEG; s2++) {
      var t0 = s2 / SEG * Math.PI * 2, t1 = (s2 + 1) / SEG * Math.PI * 2;
      ringPos.push(Math.cos(t0) * RING_R, Math.sin(t0) * RING_R, 0, Math.cos(t1) * RING_R, Math.sin(t1) * RING_R, 0);
      ringAng.push(t0, t1); ringMajor.push(0.3, 0.3);
    }
    for (var tk = 0; tk < TICKS; tk++) {
      var ang = tk / TICKS * Math.PI * 2;
      var major = tk % 15 === 0 ? 1 : (tk % 5 === 0 ? 0.55 : 0);
      var len = major === 1 ? 0.22 : (major > 0 ? 0.13 : 0.065);
      ringPos.push(Math.cos(ang) * RING_R, Math.sin(ang) * RING_R, 0, Math.cos(ang) * (RING_R - len), Math.sin(ang) * (RING_R - len), 0);
      ringAng.push(ang, ang); ringMajor.push(major, major);
    }
    var ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPos, 3));
    ringGeo.setAttribute('aAng', new THREE.Float32BufferAttribute(ringAng, 1));
    ringGeo.setAttribute('aMajor', new THREE.Float32BufferAttribute(ringMajor, 1));
    var ringU = { uFade: fadeU, uPenAng: { value: 0 }, uCol: { value: new THREE.Color(0.85, 0.85, 0.8) }, uHot: { value: new THREE.Color(1, 0.4, 0.2) }, uMid: { value: 0 } };
    var ring = new THREE.LineSegments(ringGeo, K.additive(new THREE.ShaderMaterial({
      uniforms: ringU, vertexShader: RING_VS, fragmentShader: RING_FS
    })));
    ring.frustumCulled = false;
    ring.renderOrder = -3;
    root.add(ring);

    // 笔尖 + 光屑
    var dPos = new Float32Array(DUST * 3), dLife = new Float32Array(DUST), dSize = new Float32Array(DUST);
    var dVel = new Float32Array(DUST * 3), dMax = new Float32Array(DUST);
    var dustGeo = new THREE.BufferGeometry();
    var dPosAttr = new THREE.BufferAttribute(dPos, 3); dPosAttr.setUsage(THREE.DynamicDrawUsage);
    var dLifeAttr = new THREE.BufferAttribute(dLife, 1); dLifeAttr.setUsage(THREE.DynamicDrawUsage);
    dustGeo.setAttribute('position', dPosAttr);
    dustGeo.setAttribute('aLife', dLifeAttr);
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dSize, 1));
    var dustU = { uFade: fadeU, uCol: headC, uViewH: { value: 900 } };
    var dust = new THREE.Points(dustGeo, K.additive(new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VS, fragmentShader: DUST_FS
    })));
    dust.frustumCulled = false;
    tumble.add(dust);
    var headGeo = new THREE.BufferGeometry();
    headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    headGeo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array([1]), 1));
    headGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([0.16]), 1));
    var head = new THREE.Points(headGeo, K.additive(new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VS, fragmentShader: DUST_FS
    })));
    head.frustumCulled = false;
    tumble.add(head);
    scene.add(root);

    var st = { cur: 0, speedKick: 0, dustIdx: 0, tmp: new THREE.Vector3(), tmp2: new THREE.Vector3(), yaw: 0, level: 0, punch: 0, widthS: 1.4, dustAcc: 0 };
    loadFig(ribbons[0], makeFigure(0));
    ribbons[0].pen = ribbons[0].fig.T * 0.32;
    ribbons[1].state = 'idle'; ribbons[1].u.uFig.value = 0;

    function spawnDust(p, n, speed) {
      for (var i = 0; i < n; i++) {
        var j = st.dustIdx; st.dustIdx = (st.dustIdx + 1) % DUST;
        dPos[j * 3] = p.x; dPos[j * 3 + 1] = p.y; dPos[j * 3 + 2] = p.z;
        var th = Math.random() * 6.283, ph = Math.random() * 3.1416;
        var v = speed * (0.3 + Math.random());
        dVel[j * 3] = Math.cos(th) * Math.sin(ph) * v; dVel[j * 3 + 1] = Math.cos(ph) * v - 0.05; dVel[j * 3 + 2] = Math.sin(th) * Math.sin(ph) * v;
        dMax[j] = 1.2 + Math.random() * 1.8; dLife[j] = 1; dSize[j] = 0.018 + Math.random() * 0.03;
      }
      dustGeo.getAttribute('aSize').needsUpdate = true;
    }
    function startNext(level) {
      var old = ribbons[st.cur];
      if (old.state !== 'idle') old.state = 'fade';
      st.cur = 1 - st.cur;
      loadFig(ribbons[st.cur], makeFigure(level));
    }

    return {
      root: root,
      update: function (dt, s) {
        var a = s.audio, t = s.time, pal = s.palette;
        fadeU.value = s.fade;
        timeU.value = t;
        var ctx = s.ctx || {};
        var dpr = ctx.dpr || global.devicePixelRatio || 1;
        var vh = (ctx.screenHeight || global.innerHeight || 900);
        var vw = vh * (s.camera.aspect || 16 / 9);
        viewportU.value.set(vw * dpr, vh * dpr);
        dustU.uViewH.value = vh * dpr;
        st.widthS += ((1.15 + a.low * 1.5 + st.punch * 0.8) - st.widthS) * K.expBlend(6, dt);
        widthU.value = st.widthS * dpr * K.clamp(7.2 / Math.max(0.5, s.camDist || 7.2), 0.65, 1.35);
        brightU.value = 0.85 + a.low * 0.5 + a.energy * 0.3;

        var energyLvl = global.NotBlindStageFx && NotBlindStageFx._clock ? NotBlindStageFx._clock.eSlow : a.energy;
        var level = energyLvl < 0.2 ? 0 : (energyLvl < 0.36 ? 1 : 2);
        var cur = ribbons[st.cur];
        for (var i = 0; i < s.events.length; i++) {
          var ev = s.events[i];
          if (ev.type === 'kick') {
            st.speedKick = Math.max(st.speedKick, 5 + ev.strength * 9);
            cur.u.uPulseT.value = t; cur.u.uPulseS.value = 0.6 + ev.strength * 0.8;
            st.punch = Math.max(st.punch, ev.strength);
          } else if (ev.type === 'hat') {
            if (cur.fig) spawnDust(curveJS(cur.fig, cur.pen, st.tmp), 2 + Math.round(ev.strength * 5), 0.25 + ev.strength * 0.35);
          } else if (ev.type === 'phrase') {
            if (cur.fig && cur.pen > cur.fig.T * 0.45) startNext(level);
          }
        }
        st.speedKick *= Math.pow(0.05, dt);
        st.punch *= Math.pow(0.03, dt);

        // 笔
        cur = ribbons[st.cur];
        if (cur.fig) {
          var base = cur.fig.T / 36;
          var v = base * (0.55 + a.energy * 0.9 + a.low * 0.35) + st.speedKick;
          if (cur.state === 'draw') {
            cur.pen = Math.min(cur.fig.T, cur.pen + v * dt);
            if (cur.pen >= cur.fig.T) { cur.state = 'hold'; cur.hold = 0; }
          } else if (cur.state === 'hold') {
            cur.hold += dt;
            if (cur.hold > 2.5) startNext(level);
          }
          cur.u.uPen.value = cur.pen;
          curveJS(cur.fig, cur.pen, st.tmp);
          headGeo.getAttribute('position').setXYZ(0, st.tmp.x, st.tmp.y, st.tmp.z);
          headGeo.getAttribute('position').needsUpdate = true;
          headGeo.getAttribute('aSize').setX(0, 0.1 + a.low * 0.08 + st.punch * 0.1);
          headGeo.getAttribute('aSize').needsUpdate = true;
          head.visible = cur.state === 'draw';
          st.dustAcc += dt * (4 + a.high * 30) * (cur.state === 'draw' ? 1 : 0);
          while (st.dustAcc > 1) { spawnDust(st.tmp, 1, 0.12); st.dustAcc -= 1; }
          // 刻度尺上跟着笔的那一格
          st.tmp2.copy(st.tmp).applyMatrix4(tumble.matrix);
          ringU.uPenAng.value = Math.atan2(st.tmp2.y, st.tmp2.x);
        }
        for (var r = 0; r < 2; r++) {
          var rb = ribbons[r];
          if (rb.state === 'fade') {
            rb.fade = Math.max(0, rb.fade - dt / 2.8);
            rb.u.uFig.value = K.smooth01(rb.fade);
            rb.mesh.scale.setScalar(1 + (1 - rb.fade) * 0.08);
            if (rb.fade <= 0) rb.state = 'idle';
          }
          rb.mesh.visible = rb.state !== 'idle';
        }
        ringU.uMid.value = a.mid;

        // 光屑
        for (var j = 0; j < DUST; j++) {
          if (dLife[j] <= 0) continue;
          dLife[j] -= dt / dMax[j];
          dPos[j * 3] += dVel[j * 3] * dt; dPos[j * 3 + 1] += dVel[j * 3 + 1] * dt; dPos[j * 3 + 2] += dVel[j * 3 + 2] * dt;
          dVel[j * 3 + 1] -= dt * 0.08;
        }
        dPosAttr.needsUpdate = true; dLifeAttr.needsUpdate = true;

        // 视角：图形在空中缓慢翻转，看得见它的纵深；鼓点时轻轻推近
        st.yaw += dt * (0.05 + a.mid * 0.04);
        tumble.rotation.set(Math.sin(st.yaw * 0.63 + 1.0) * 0.22, Math.sin(st.yaw * 0.9) * 0.3, st.yaw * 0.35);
        tumble.updateMatrix();
        root.scale.setScalar(1 + st.punch * 0.025);

        var k = K.expBlend(2.5, dt);
        K.lerpColor(colA, K.lift(K.saturate(pal.primary, 1.1), 0.32, 0.55), k);
        K.lerpColor(colB, K.lift(K.saturate(pal.secondary, 1.15), 0.26, 0.5), k);
        K.lerpColor(headC, K.lift(pal.highlight.clone().lerp(new THREE.Color(1, 1, 1), 0.4), 0.85, 0.97), k);
        K.lerpColor(ringU.uCol, K.lift(pal.highlight, 0.6, 0.8), k);
        K.lerpColor(ringU.uHot, new THREE.Color(1, 0.29, 0.11).lerp(K.lift(pal.primary, 0.5, 0.7), 0.3), k);
      },
      pointer: function () {
        var cur = ribbons[st.cur];
        if (!cur.fig) return false;
        // 推一下摆锤：相位整体错开一点，从当前笔位继续画
        cur.fig.ph = cur.fig.ph.map(function (p) { return p + K.rand(-0.35, 0.35); });
        cur.u.uPh.value.set(cur.fig.ph[0], cur.fig.ph[1], cur.fig.ph[2], cur.fig.ph[3]);
        st.speedKick = 14; st.punch = 1;
        cur.u.uPulseT.value = timeU.value; cur.u.uPulseS.value = 1.4;
        return true;
      },
      dispose: function () {
        scene.remove(root);
        lineGeo.dispose(); ringGeo.dispose(); dustGeo.dispose(); headGeo.dispose();
        ribbons.forEach(function (rb) { rb.mesh.material.dispose(); });
        ring.material.dispose(); dust.material.dispose(); head.material.dispose();
      }
    };
  }

  K.effects.push({
    key: 'harmonograph',
    name: '谐振',
    nameEn: 'HARMONOGRAPH',
    desc: '摆锤笔迹 · 音程成画',
    accent: '#e9dcc0', accent2: '#ff4a1c',
    orbit: { theta: 0.0, phi: 0.08, radius: 7.2 },
    starRiverAlpha: 0.2,
    starRiver: true,
    create: create
  });
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// 管理器：按 fx.preset 挂载 / 卸载效果，淡入淡出，派发节拍事件，处理点击。
// 对外：window.NotBlindStageFx
// ============================================================
(function (global) {
  'use strict';
  var K = global.__NBStageKit;
  if (!K) return;

  var clock = new K.MusicClock();
  var live = []; // { def, inst, fade, target }
  var sceneRef = null;
  var cameraRef = null;
  var phraseBreath = 0;
  var lastTime = 0;
  var visualRot = { x: 0, y: 0 };
  // 舞台：所有效果都挂在这个组下面。它的位置和朝向每帧照抄软件的“舞台”
  // （封面粒子 particles，歌词也是跟着它摆的），拖动时效果和歌词一起转，相对位置不变。
  var stage = null;
  var tmpP = null, tmpQ = null, tmpS = null, tmpE = null;
  function ensureStage(scene) {
    if (!stage) {
      stage = new THREE.Group();
      stage.name = 'nb-stage-fx-stage';
      tmpP = new THREE.Vector3(); tmpQ = new THREE.Quaternion(); tmpS = new THREE.Vector3(); tmpE = new THREE.Euler();
    }
    if (scene && stage.parent !== scene) scene.add(stage);
    return stage;
  }
  function syncStage(ctx) {
    var f = ctx.stageFrame;
    if (f && f.isObject3D) {
      f.updateWorldMatrix(true, false);
      f.matrixWorld.decompose(tmpP, tmpQ, tmpS);
      stage.position.copy(tmpP);
      stage.quaternion.copy(tmpQ);
    } else {
      stage.position.set(0, 0, 0);
      tmpE.set(visualRot.x, visualRot.y, 0, 'XYZ');
      stage.quaternion.setFromEuler(tmpE);
    }
    stage.updateMatrixWorld(true);
  }
  function resolveLyricGroup(ctx) {
    if (ctx && ctx.lyricGroup) return ctx.lyricGroup;
    try { if (typeof stageLyrics !== 'undefined' && stageLyrics && stageLyrics.group) return stageLyrics.group; } catch (e) { }
    return global.stageLyrics && global.stageLyrics.group ? global.stageLyrics.group : null;
  }
  // 这几款的节奏交给画面本身，镜头律动压到三成，歌词更稳、看着不累
  var SHAKE_SCALE = 0.3;

  function defForPreset(p) {
    p = Number(p);
    var i = p - K.BASE_INDEX;
    return i >= 0 && i < K.effects.length ? K.effects[i] : null;
  }
  function isActive(fx) { return !!(fx && defForPreset(fx.preset)); }

  function findLive(def) {
    for (var i = 0; i < live.length; i++) if (live[i].def === def) return live[i];
    return null;
  }

  function ensure(def, scene) {
    var item = findLive(def);
    if (item) { item.target = 1; return item; }
    item = { def: def, inst: def.create(ensureStage(scene)), fade: 0, target: 1 };
    live.push(item);
    return item;
  }

  function resolveCamera(ctx) {
    if (ctx && ctx.camera) return ctx.camera;
    if (typeof global.camera !== 'undefined' && global.camera && global.camera.isCamera) return global.camera;
    try { if (typeof camera !== 'undefined' && camera && camera.isCamera) return camera; } catch (e) { }
    return cameraRef;
  }

  function update(dt, ctx) {
    ctx = ctx || {};
    var fx = ctx.fx || {};
    var scene = ctx.scene || sceneRef;
    if (!scene) return;
    sceneRef = scene;
    var cam = resolveCamera(ctx);
    if (!cam) return;
    cameraRef = cam;
    dt = K.clamp(Number(dt) || 1 / 60, 0.0005, 0.1);
    var def = defForPreset(fx.preset);
    var i;
    for (i = 0; i < live.length; i++) live[i].target = live[i].def === def ? 1 : 0;
    if (def) ensure(def, scene);
    if (!live.length) return;

    var audio = K.readAudio(ctx.audio);
    var events = clock.update(audio, dt);
    for (i = 0; i < events.length; i++) if (events[i].type === 'phrase') phraseBreath = 1;
    phraseBreath *= Math.pow(0.35, dt);
    var palette = K.readPalette(fx);
    lastTime = clock.time;
    // 拖动画面时软件转的是“舞台”（封面粒子 / 歌词），效果整组跟着转
    var vrSrc = ctx.visualRotation || null;
    visualRot.x = vrSrc && Number.isFinite(Number(vrSrc.x)) ? Number(vrSrc.x) : 0;
    visualRot.y = vrSrc && Number.isFinite(Number(vrSrc.y)) ? Number(vrSrc.y) : 0;
    ensureStage(scene);
    syncStage(ctx);
    var camDist = cam.position.distanceTo(stage.position);
    var lyricGroup = resolveLyricGroup(ctx);

    for (i = live.length - 1; i >= 0; i--) {
      var it = live[i];
      it.fade += (it.target - it.fade) * K.expBlend(it.target > it.fade ? 2.2 : 3.2, dt);
      if (it.target === 0 && it.fade < 0.01) {
        it.inst.dispose();
        live.splice(i, 1);
        continue;
      }
      it.inst.root.visible = it.fade > 0.004;
      it.inst.update(dt, {
        time: clock.time,
        audio: audio,
        events: it.target > 0 ? events : [],
        palette: palette,
        fx: fx,
        camera: cam,
        fade: K.smooth01(it.fade),
        phraseBreath: phraseBreath,
        visualRot: visualRot,
        camDist: camDist,
        lyricGroup: lyricGroup,
        ctx: ctx
      });
    }
  }

  function onPresetChange(prev, next, ctx) {
    if (ctx && ctx.scene) sceneRef = ctx.scene;
    var def = defForPreset(next);
    if (def && sceneRef) ensure(def, sceneRef);
    if (stage && def) syncStage(ctx || {});
  }

  // 点击舞台：clientX/Y 是窗口坐标；info.pressMs 按住时长
  var raycaster = null;
  function pointer(clientX, clientY, info) {
    info = info || {};
    var cam = info.camera || cameraRef;
    if (!cam || !live.length) return false;
    var item = null;
    for (var i = 0; i < live.length; i++) if (live[i].target > 0) item = live[i];
    if (!item || !item.inst.pointer) return false;
    var w = info.width || global.innerWidth || 1;
    var h = info.height || global.innerHeight || 1;
    if (!raycaster) raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(clientX / w * 2 - 1, -(clientY / h) * 2 + 1), cam);
    var strength = 0.8 + Math.min(1.6, (info.pressMs || 0) / 600);
    return !!item.inst.pointer(raycaster.ray, strength, lastTime);
  }

  function cameraShake(fx) {
    var base = K.clamp(Number(fx && fx.cinemaShake) || 0, 0, 1.8);
    return isActive(fx) ? base * SHAKE_SCALE : base;
  }
  function starRiverAlpha(fx) {
    var def = defForPreset(fx && fx.preset);
    return def ? (def.starRiverAlpha || 0) : 0;
  }
  function orbitFor(p) {
    var def = defForPreset(p);
    return def && def.orbit ? { theta: def.orbit.theta, phi: def.orbit.phi, radius: def.orbit.radius } : null;
  }

  function clear() {
    for (var i = 0; i < live.length; i++) live[i].inst.dispose();
    live.length = 0;
  }

  function meta() {
    return K.effects.map(function (d, i) {
      return {
        index: K.BASE_INDEX + i, key: d.key, name: d.name, nameEn: d.nameEn, desc: d.desc,
        accent: d.accent, accent2: d.accent2, orbit: d.orbit, starRiver: !!d.starRiver
      };
    });
  }

  // ---- 「视觉」面板（灵动岛 › 视觉 › 播放页效果）里四张卡片的小图标动效 ----
  // 平时是静止的图标；鼠标放上去、键盘选中、或者它就是当前效果（面板打开时）才动。系统设了“减少动态”就不动。
  var CARD_CSS = [
    '.nbfx-ic *{transform-box:fill-box}',
    '.nbfx-ic .nbfx-e{opacity:0;transform-origin:50% 100%}',
    '.nbfx-ic .nbfx-p{transform-origin:50% 50%}',
    '.nbfx-ic .nbfx-s1,.nbfx-ic .nbfx-s2,.nbfx-ic .nbfx-s3{transform-origin:50% 0}',
    '.nbfx-ic .nbfx-h{transform-origin:50% 50%}',
    // 镜湖：圆荡出回声圈，水里的两道倒影一闪一闪
    '.preset-card:hover .nbfx-ic-lake .nbfx-e,.preset-card:focus-visible .nbfx-ic-lake .nbfx-e,#nb-visual.show .preset-card.active .nbfx-ic-lake .nbfx-e{animation:nbfx-echo 2.4s cubic-bezier(.2,.7,.3,1) infinite}',
    '.preset-card:hover .nbfx-ic-lake .nbfx-r1,.preset-card:focus-visible .nbfx-ic-lake .nbfx-r1,#nb-visual.show .preset-card.active .nbfx-ic-lake .nbfx-r1{animation:nbfx-glint 1.8s ease-in-out infinite}',
    '.preset-card:hover .nbfx-ic-lake .nbfx-r2,.preset-card:focus-visible .nbfx-ic-lake .nbfx-r2,#nb-visual.show .preset-card.active .nbfx-ic-lake .nbfx-r2{animation:nbfx-glint 1.8s ease-in-out -.9s infinite reverse}',
    '@keyframes nbfx-echo{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}',
    '@keyframes nbfx-glint{0%,100%{transform:translateX(0);opacity:.6}50%{transform:translateX(1px);opacity:.2}}',
    // 声纹沙：纹样散开 → 板子被敲一下 → 新纹样一笔一笔长出来
    '.preset-card:hover .nbfx-ic-sand .nbfx-n,.preset-card:focus-visible .nbfx-ic-sand .nbfx-n,#nb-visual.show .preset-card.active .nbfx-ic-sand .nbfx-n{stroke-dasharray:1 1;animation:nbfx-sand 3.2s ease-in-out infinite}',
    '.preset-card:hover .nbfx-ic-sand .nbfx-p,.preset-card:focus-visible .nbfx-ic-sand .nbfx-p,#nb-visual.show .preset-card.active .nbfx-ic-sand .nbfx-p{animation:nbfx-knock 3.2s ease-out infinite}',
    '@keyframes nbfx-sand{0%,28%{stroke-dashoffset:0;opacity:.75}38%{stroke-dashoffset:0;opacity:0}39%{stroke-dashoffset:1;opacity:.75}86%,100%{stroke-dashoffset:0;opacity:.75}}',
    '@keyframes nbfx-knock{0%,38%,62%,100%{transform:scale(1)}43%{transform:scale(.92)}50%{transform:scale(1.03)}56%{transform:scale(.99)}}',
    // 铜雨：三颗铜滴依次沉下去再弹回，丝跟着拉长
    '.preset-card:hover .nbfx-ic-rain [class^=nbfx-],.preset-card:focus-visible .nbfx-ic-rain [class^=nbfx-],#nb-visual.show .preset-card.active .nbfx-ic-rain [class^=nbfx-]{animation-duration:1.7s;animation-timing-function:ease-in-out;animation-iteration-count:infinite}',
    '.preset-card:hover .nbfx-ic-rain .nbfx-d1,.preset-card:focus-visible .nbfx-ic-rain .nbfx-d1,#nb-visual.show .preset-card.active .nbfx-ic-rain .nbfx-d1{animation-name:nbfx-drop}',
    '.preset-card:hover .nbfx-ic-rain .nbfx-d2,.preset-card:focus-visible .nbfx-ic-rain .nbfx-d2,#nb-visual.show .preset-card.active .nbfx-ic-rain .nbfx-d2{animation-name:nbfx-drop;animation-delay:.2s}',
    '.preset-card:hover .nbfx-ic-rain .nbfx-d3,.preset-card:focus-visible .nbfx-ic-rain .nbfx-d3,#nb-visual.show .preset-card.active .nbfx-ic-rain .nbfx-d3{animation-name:nbfx-drop;animation-delay:.4s}',
    '.preset-card:hover .nbfx-ic-rain .nbfx-s1,.preset-card:focus-visible .nbfx-ic-rain .nbfx-s1,#nb-visual.show .preset-card.active .nbfx-ic-rain .nbfx-s1{animation-name:nbfx-str7}',
    '.preset-card:hover .nbfx-ic-rain .nbfx-s2,.preset-card:focus-visible .nbfx-ic-rain .nbfx-s2,#nb-visual.show .preset-card.active .nbfx-ic-rain .nbfx-s2{animation-name:nbfx-str11;animation-delay:.2s}',
    '.preset-card:hover .nbfx-ic-rain .nbfx-s3,.preset-card:focus-visible .nbfx-ic-rain .nbfx-s3,#nb-visual.show .preset-card.active .nbfx-ic-rain .nbfx-s3{animation-name:nbfx-str6;animation-delay:.4s}',
    '@keyframes nbfx-drop{0%,100%{transform:translateY(0)}42%{transform:translateY(2.2px)}68%{transform:translateY(-.5px)}84%{transform:translateY(.15px)}}',
    '@keyframes nbfx-str7{0%,100%{transform:scaleY(1)}42%{transform:scaleY(1.314)}68%{transform:scaleY(.93)}84%{transform:scaleY(1.02)}}',
    '@keyframes nbfx-str11{0%,100%{transform:scaleY(1)}42%{transform:scaleY(1.2)}68%{transform:scaleY(.955)}84%{transform:scaleY(1.014)}}',
    '@keyframes nbfx-str6{0%,100%{transform:scaleY(1)}42%{transform:scaleY(1.367)}68%{transform:scaleY(.917)}84%{transform:scaleY(1.025)}}',
    // 谐振：一笔一笔画出花环，画完停一下、淡掉再画；整幅慢慢转
    '.preset-card:hover .nbfx-ic-harmo .nbfx-h,.preset-card:focus-visible .nbfx-ic-harmo .nbfx-h,#nb-visual.show .preset-card.active .nbfx-ic-harmo .nbfx-h{stroke-dasharray:1 1;animation:nbfx-pen 3.6s cubic-bezier(.45,.1,.4,1) infinite,nbfx-turn 20s linear infinite}',
    '@keyframes nbfx-pen{0%{stroke-dashoffset:1;opacity:1}68%{stroke-dashoffset:0;opacity:1}86%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}',
    '@keyframes nbfx-turn{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion: reduce){.nbfx-ic *{animation:none!important;stroke-dasharray:none!important}}'
  ].join('\n');
  function injectCardStyle() {
    try {
      var doc = global.document;
      if (!doc || doc.getElementById('nbfx-card-style')) return;
      var st = doc.createElement('style');
      st.id = 'nbfx-card-style';
      st.textContent = CARD_CSS;
      (doc.head || doc.documentElement).appendChild(st);
    } catch (e) { }
  }
  injectCardStyle();

  global.NotBlindStageFx = {
    BASE_INDEX: K.BASE_INDEX,
    get COUNT() { return K.effects.length; },
    meta: meta,
    isActive: isActive,
    update: update,
    onPresetChange: onPresetChange,
    pointer: pointer,
    clear: clear,
    starRiverAlpha: starRiverAlpha,
    cameraShake: cameraShake,
    orbitFor: orbitFor,
    _clock: clock
  };
})(typeof window !== 'undefined' ? window : globalThis);
