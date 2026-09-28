;
// ============================================================
// [二改] 平面歌单（平面歌词时，右键呼出）
// 平面歌词（NotBlindLyricFx 2d）打开时：
//   · 右键不再弹 3D 玻璃卡片书架，改成右侧一张和当前平面效果同一画风的歌单：
//     回声大字 / 连星成词 / 网点 / 光斑 各一套皮肤
//   · 左边自动弹出的歌单 / 播放队列面板不再出现，它的「当前队列」也收进这里
// 右键：呼出 → 从歌曲列表返回 → 收起；滚轮 / ↑↓ 翻；点当前那张 = 打开；Esc 返回。
// 歌曲列表里：点歌 = 播放，右键 = 下一首播放。
// 3D 舞台模式下一切照旧。
// ============================================================
(function () {
  var CSS = "/* ============ 平面歌单 · 公共骨架 ============ */\n#nbfs{position:fixed;right:40px;top:118px;bottom:132px;width:min(520px,44vw);z-index:5;pointer-events:none;-webkit-app-region:no-drag;--mono:Consolas,\"Cascadia Mono\",\"Microsoft YaHei UI\",monospace;--sans:\"Microsoft YaHei UI\",\"Microsoft YaHei\",\"PingFang SC\",\"Noto Sans CJK SC\",sans-serif;--serif:\"Noto Serif SC\",\"Source Han Serif SC\",\"思源宋体\",\"STZhongsong\",\"华文中宋\",\"SimSun\",\"宋体\",serif;font-family:var(--sans);text-align:left;line-height:normal}\n#nbfs .fs-scrim{position:absolute;pointer-events:none;opacity:0;transition:opacity .45s ease}\n#nbfs .fs-sheet{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s ease,transform .55s cubic-bezier(.2,.8,.2,1)}\n#nbfs.open .fs-scrim{opacity:1}\n#nbfs.open .fs-sheet{opacity:1;pointer-events:auto}\n#nbfs .fs-head{position:absolute;left:0;right:0;top:0;height:64px;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;padding:0 28px}\n#nbfs .fs-label{font:500 11px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase}\n#nbfs .fs-tabs{display:flex;gap:18px}\n#nbfs .fs-tabs button{all:unset;cursor:pointer;font:500 13px/1 var(--sans);opacity:.5;display:flex;gap:6px;align-items:baseline}\n#nbfs .fs-tabs button b{font:400 10px var(--mono);font-weight:400}\n#nbfs .fs-tabs button.on{opacity:1}\n#nbfs .fs-tabs button:focus-visible{outline:1px dashed currentColor;outline-offset:4px}\n#nbfs .fs-view{position:absolute;left:0;right:0;top:78px;bottom:40px;transition:opacity .38s ease,transform .5s cubic-bezier(.2,.8,.2,1)}\n#nbfs .fs-list{overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 13%,#000 80%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 13%,#000 80%,transparent 100%)}\n#nbfs .fs-track{position:absolute;left:0;right:0;top:0;transition:transform .5s cubic-bezier(.2,.8,.2,1)}\n#nbfs .it{position:relative;cursor:pointer;opacity:max(.14,calc(1 - var(--d,0) * .19));transition:opacity .35s ease}\n#nbfs .it .it-cover img{display:block;width:100%;height:100%;object-fit:cover}\n#nbfs .it .it-acts{display:none}\n#nbfs .it .it-star,#nbfs .it .it-uline{display:none}\n#nbfs .it.f .it-acts{display:flex}\n#nbfs .it-title{position:relative;white-space:nowrap}\n#nbfs .it-title .e1,#nbfs .it-title .e2{position:absolute;left:0;top:0;pointer-events:none;display:none}\n#nbfs .it-acts button{all:unset;cursor:pointer}\n#nbfs .it-acts button:focus-visible{outline:1px dashed currentColor;outline-offset:3px}\n#nbfs .fs-detail{opacity:0;pointer-events:none}\n#nbfs.lv2 .fs-detail{opacity:1;pointer-events:auto}\n#nbfs.lv2 .fs-list{opacity:0;pointer-events:none}\n#nbfs .dt-head{display:flex;flex-direction:column;gap:10px;padding:0 28px 14px}\n#nbfs .dt-back{all:unset;cursor:pointer;font:500 12px/1 var(--mono);letter-spacing:.08em;opacity:.7;align-self:flex-start}\n#nbfs .dt-back:hover{opacity:1}\n#nbfs .dt-title{position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#nbfs .dt-row2{display:flex;align-items:center;gap:16px}\n#nbfs .dt-play{all:unset;cursor:pointer}\n#nbfs .dt-rows{position:absolute;left:0;right:0;bottom:0;overflow-y:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(180deg,#000 0,#000 88%,transparent);mask-image:linear-gradient(180deg,#000 0,#000 88%,transparent)}\n#nbfs .dt-rows::-webkit-scrollbar{display:none}\n#nbfs .sr{position:relative;display:grid;grid-template-columns:34px 1fr auto;align-items:baseline;gap:12px;padding:0 28px;cursor:pointer;font-variant-numeric:tabular-nums}\n#nbfs .sr .sr-n{font:400 11px var(--mono)}\n#nbfs .sr .sr-a,#nbfs .sr .sr-m{display:block}\n#nbfs .sr .sr-dot{display:none}\n#nbfs .sr .sr-t{font:400 11px var(--mono)}\n#nbfs .fs-hint{position:absolute;left:28px;right:28px;bottom:0;height:30px;display:flex;align-items:center;justify-content:space-between;font:400 10.5px/1 var(--mono);letter-spacing:.08em;opacity:.55}\n#nbfs .fs-toast{position:absolute;left:28px;bottom:40px;font:500 12px/1.4 var(--sans);opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s;pointer-events:none}\n#nbfs .fs-toast.show{opacity:1;transform:none}\n@media (prefers-reduced-motion:reduce){#nbfs *,#nbfs{transition-duration:.01s!important;animation:none!important}}\n/* ============ 回声大字 ECHO ============ */\n#nbfs[data-skin=echo]{--c:#eceee8;--v:#e5502f;--mut:rgba(236,238,232,.46)}\n#nbfs[data-skin=echo] .fs-scrim{top:-118px;bottom:-134px;right:-44px;left:-260px;background:linear-gradient(90deg,rgba(24,33,40,0) 0,rgba(20,28,35,.86) 30%,rgba(16,23,29,.95) 100%)}\n#nbfs[data-skin=echo] .fs-sheet{transform:translateX(36px);color:var(--c)}\n#nbfs[data-skin=echo].open .fs-sheet{transform:none}\n#nbfs[data-skin=echo] .fs-label{color:var(--mut)}\n#nbfs[data-skin=echo] .fs-tabs button.on{color:var(--c)}\n#nbfs[data-skin=echo] .fs-tabs button.on::before{content:\"\";width:6px;height:6px;border-radius:50%;background:var(--v);align-self:center}\n#nbfs[data-skin=echo] .fs-line{position:absolute;left:0;right:0;height:1px;background:rgba(236,238,232,.2);pointer-events:none}\n#nbfs[data-skin=echo] .fs-line::after{content:\"\";position:absolute;left:28px;width:64px;top:-1px;height:3px;background:var(--v)}\n#nbfs[data-skin=echo] .it{display:grid;grid-template-columns:40px 1fr;align-items:center;padding:9px 28px;column-gap:6px}\n#nbfs[data-skin=echo] .it-idx{font:400 11px var(--mono);color:var(--mut)}\n#nbfs[data-skin=echo] .it-cover,#nbfs[data-skin=echo] .it-meta{display:none}\n#nbfs[data-skin=echo] .it-title{font:800 28px/1.15 var(--sans);color:transparent;-webkit-text-stroke:1px rgba(236,238,232,.52)}\n#nbfs[data-skin=echo] .it.now .it-idx::after{content:\" ●\";color:var(--v)}\n#nbfs[data-skin=echo] .it.f{grid-template-columns:40px 1fr;padding:30px 28px 26px}\n#nbfs[data-skin=echo] .it.f .it-title{font-size:var(--fz,54px);font-weight:900;color:var(--c);-webkit-text-stroke:0;line-height:1.05}\n#nbfs[data-skin=echo] .it.f .it-title .e1,#nbfs[data-skin=echo] .it.f .it-title .e2{display:block;color:transparent;-webkit-text-stroke:1px rgba(236,238,232,.34);transition:transform .7s cubic-bezier(.2,.9,.25,1),opacity .6s}\n#nbfs[data-skin=echo] .it.f .it-title .e1{transform:translateY(-58%);opacity:.9}\n#nbfs[data-skin=echo] .it.f .it-title .e2{transform:translateY(58%);opacity:.55;transition-delay:.095s}\n#nbfs[data-skin=echo] .it.f.enter .it-title .e1,#nbfs[data-skin=echo] .it.f.enter .it-title .e2{transform:none;opacity:0;transition:none}\n#nbfs[data-skin=echo] .it.f .it-body{display:flex;flex-direction:column;gap:14px}\n#nbfs[data-skin=echo] .it.f .it-title .t{position:relative;z-index:1}\n#nbfs[data-skin=echo] .it-sub{display:none}\n#nbfs[data-skin=echo] .it.f .it-sub{display:flex;align-items:center;gap:14px;order:-1}\n#nbfs[data-skin=echo] .it.f .it-cover{display:block;width:46px;height:46px;box-shadow:0 2px 0 var(--v)}\n#nbfs[data-skin=echo] .it.f .it-meta{display:block;font:400 11px/1.6 var(--mono);color:var(--mut);letter-spacing:.06em}\n#nbfs[data-skin=echo] .it.f .it-idx{align-self:start;padding-top:8px;color:var(--v)}\n#nbfs[data-skin=echo] .it-acts{gap:22px;font:500 13px/1 var(--mono);letter-spacing:.06em}\n#nbfs[data-skin=echo] .it-acts .play{color:var(--v)}\n#nbfs[data-skin=echo] .it-acts .play::before{content:\"▶ \"}\n#nbfs[data-skin=echo] .it-acts .open{color:var(--c);opacity:.8}\n#nbfs[data-skin=echo] .it-acts button:hover{text-decoration:underline;text-underline-offset:5px}\n#nbfs[data-skin=echo] .fs-detail{transform:translateY(18px)}\n#nbfs[data-skin=echo].lv2 .fs-detail{transform:none}\n#nbfs[data-skin=echo].lv2 .fs-list{transform:translateY(-18px)}\n#nbfs[data-skin=echo] .dt-back{color:var(--mut)}\n#nbfs[data-skin=echo] .dt-title{font:900 40px/1.1 var(--sans);color:var(--c);overflow:visible}\n#nbfs[data-skin=echo] .dt-title::after{content:attr(data-t);position:absolute;left:0;top:0;color:transparent;-webkit-text-stroke:1px rgba(236,238,232,.3);transform:translateY(52%);z-index:-1}\n#nbfs[data-skin=echo] .dt-row2{font:400 11px var(--mono);color:var(--mut);margin-top:16px}\n#nbfs[data-skin=echo] .dt-play{color:var(--v);font:500 12px var(--mono)}\n#nbfs[data-skin=echo] .dt-play::before{content:\"▶ \"}\n#nbfs[data-skin=echo] .dt-rows{top:132px}\n#nbfs[data-skin=echo] .sr{padding-block:11px;border-top:1px solid rgba(236,238,232,.08)}\n#nbfs[data-skin=echo] .sr-n{color:var(--mut)}\n#nbfs[data-skin=echo] .sr-m{font:700 18px/1.3 var(--sans);color:var(--c)}\n#nbfs[data-skin=echo] .sr-a{font:400 12px/1.6 var(--sans);color:var(--mut)}\n#nbfs[data-skin=echo] .sr-t{color:var(--mut)}\n#nbfs[data-skin=echo] .sr:hover .sr-m{color:transparent;-webkit-text-stroke:1px var(--c)}\n#nbfs[data-skin=echo] .sr.cur .sr-m,#nbfs[data-skin=echo] .sr.cur .sr-n{color:var(--v);-webkit-text-stroke:0}\n#nbfs[data-skin=echo] .fs-hint,#nbfs[data-skin=echo] .fs-toast{color:var(--c)}\n#nbfs[data-skin=echo] .fs-toast{color:var(--v)}\n/* ============ 连星成词 STAR ============ */\n#nbfs[data-skin=star]{--c:#eef0f6;--g:#dcc591;--mut:rgba(214,220,238,.5);--ax:78px}\n#nbfs[data-skin=star] .fs-scrim{top:-118px;bottom:-134px;right:-44px;left:-300px;background:radial-gradient(90% 75% at 100% 48%,rgba(3,5,11,.9) 0,rgba(3,5,11,.72) 45%,rgba(3,5,11,0) 80%)}\n#nbfs[data-skin=star] .fs-sheet{color:var(--c);transform:scale(1.015)}\n#nbfs[data-skin=star].open .fs-sheet{transform:none}\n#nbfs[data-skin=star] .fs-label{color:var(--g);letter-spacing:.3em}\n#nbfs[data-skin=star] .fs-tabs button{font-family:var(--serif);font-weight:300;letter-spacing:.16em}\n#nbfs[data-skin=star] .fs-tabs button.on{color:var(--c)}\n#nbfs[data-skin=star] .fs-tabs button.on::after{content:\"✦\";font-size:9px;color:var(--g)}\n#nbfs[data-skin=star] .fs-axis{position:absolute;left:var(--ax);top:78px;bottom:40px;width:1px;background:linear-gradient(180deg,transparent,rgba(214,220,238,.26) 12%,rgba(214,220,238,.26) 82%,transparent);pointer-events:none}\n#nbfs[data-skin=star] .fs-axis::before{content:\"\";position:absolute;left:-4px;top:0;bottom:0;width:9px;background:repeating-linear-gradient(180deg,rgba(214,220,238,.22) 0 1px,transparent 1px 22px);-webkit-mask-image:linear-gradient(90deg,transparent 0 4px,#000 4px);mask-image:linear-gradient(90deg,transparent 0 4px,#000 4px)}\n#nbfs[data-skin=star] .it{display:grid;grid-template-columns:calc(var(--ax) - 30px) 60px 1fr;align-items:center;padding:12px 28px 12px 0;min-height:24px}\n#nbfs[data-skin=star] .it-idx{font:400 10px var(--mono);color:rgba(220,197,145,.55);text-align:right;letter-spacing:.08em;padding-right:10px}\n#nbfs[data-skin=star] .it-star{display:block;position:absolute;left:var(--ax);top:50%;width:var(--sz,4px);height:var(--sz,4px);margin:calc(var(--sz,4px) / -2) 0 0 calc(var(--sz,4px) / -2);border-radius:50%;background:#f4f1ea;box-shadow:0 0 6px rgba(200,215,255,.8)}\n#nbfs[data-skin=star] .it-cover,#nbfs[data-skin=star] .it-meta{display:none}\n#nbfs[data-skin=star] .it-body{grid-column:3}\n#nbfs[data-skin=star] .it-title{font:300 19px/1.4 var(--serif);letter-spacing:.14em;color:rgba(233,236,244,.72)}\n#nbfs[data-skin=star] .it.now .it-star{background:var(--g);box-shadow:0 0 10px rgba(220,197,145,.9)}\n#nbfs[data-skin=star] .it.f{padding:26px 28px 24px 0}\n#nbfs[data-skin=star] .it.f .it-star{background:#fff;box-shadow:0 0 10px #fff,0 0 26px rgba(170,195,255,.7)}\n#nbfs[data-skin=star] .it.f .it-star::before{content:\"\";position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px;border:1px solid rgba(220,197,145,.75);border-radius:50%;animation:nbfs-sa-ret 4s linear infinite}\n#nbfs[data-skin=star] .it.f .it-star::after{content:\"\";position:absolute;left:calc(50% + 17px);top:50%;width:40px;height:1px;background:linear-gradient(90deg,rgba(220,197,145,.8),rgba(220,197,145,0))}\n@keyframes nbfs-sa-ret{0%{transform:scale(.92);opacity:.9}50%{transform:scale(1.06);opacity:.55}100%{transform:scale(.92);opacity:.9}}\n#nbfs[data-skin=star] .it.f .it-body{display:grid;grid-template-columns:auto 1fr;column-gap:16px;row-gap:8px;align-items:center}\n#nbfs[data-skin=star] .it.f .it-cover{display:block;grid-column:1;grid-row:1 / span 3;width:70px;height:70px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 1px rgba(220,197,145,.6),0 0 0 5px rgba(3,5,11,.9),0 0 0 6px rgba(214,220,238,.18);filter:saturate(.75)}\n#nbfs[data-skin=star] .it.f .it-title{grid-column:2;grid-row:1;font-size:var(--fz,30px);font-weight:500;color:var(--c);letter-spacing:.1em}\n#nbfs[data-skin=star] .it-sub{display:contents}\n#nbfs[data-skin=star] .it.f .it-acts{grid-column:2;grid-row:3}\n#nbfs[data-skin=star] .it.f .it-meta{grid-column:2;grid-row:2;display:block;font:400 10.5px/1.5 var(--mono);color:var(--mut);letter-spacing:.08em}\n#nbfs[data-skin=star] .it-acts{gap:20px;font:400 12.5px/1 var(--serif);letter-spacing:.14em;color:var(--g)}\n#nbfs[data-skin=star] .it-acts .play::before{content:\"▸ \"}\n#nbfs[data-skin=star] .it-acts .open{color:var(--c);opacity:.72}\n#nbfs[data-skin=star] .it-acts button:hover{text-shadow:0 0 10px rgba(220,197,145,.8)}\n#nbfs[data-skin=star] .fs-detail{transform:scale(.985)}\n#nbfs[data-skin=star].lv2 .fs-detail{transform:none}\n#nbfs[data-skin=star] .dt-back{color:var(--g)}\n#nbfs[data-skin=star] .dt-title{font:500 30px/1.2 var(--serif);letter-spacing:.12em;color:var(--c)}\n#nbfs[data-skin=star] .dt-row2{font:400 10.5px var(--mono);color:var(--mut);letter-spacing:.08em}\n#nbfs[data-skin=star] .dt-play{font:400 12.5px var(--serif);color:var(--g);letter-spacing:.14em}\n#nbfs[data-skin=star] .dt-play::before{content:\"▸ \"}\n#nbfs[data-skin=star] .dt-rows{top:112px}\n#nbfs[data-skin=star] .dt-svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}\n#nbfs[data-skin=star] .sr{grid-template-columns:1fr auto;padding:9px 28px 9px 96px}\n#nbfs[data-skin=star] .sr-n{position:absolute;left:24px;top:14px;color:rgba(220,197,145,.5);font-size:10px}\n#nbfs[data-skin=star] .sr-dot{display:block;position:absolute;left:var(--x);top:18px;width:var(--sz);height:var(--sz);margin:calc(var(--sz) / -2);border-radius:50%;background:#f1f0ec;box-shadow:0 0 6px rgba(190,210,255,.7);transition:transform .3s}\n#nbfs[data-skin=star] .sr-m{font:400 16px/1.4 var(--serif);letter-spacing:.08em;color:rgba(233,236,244,.85)}\n#nbfs[data-skin=star] .sr-a{font:300 11.5px/1.5 var(--serif);color:var(--mut);letter-spacing:.06em}\n#nbfs[data-skin=star] .sr-t{color:var(--mut)}\n#nbfs[data-skin=star] .sr:hover .sr-dot{transform:scale(1.8)}\n#nbfs[data-skin=star] .sr:hover .sr-m{color:#fff}\n#nbfs[data-skin=star] .sr.cur .sr-dot{background:var(--g);box-shadow:0 0 12px var(--g);transform:scale(1.6)}\n#nbfs[data-skin=star] .sr.cur .sr-m{color:var(--g)}\n#nbfs[data-skin=star] .fs-hint{color:var(--c)}\n#nbfs[data-skin=star] .fs-toast{color:var(--g);font-family:var(--serif);letter-spacing:.1em}\n/* ============ 网点 HALFTONE ============ */\n#nbfs[data-skin=riso]{--paper:#f4ede0;--b:#2c4c9c;--p:#ff4d97;--ink:#1c2644;--mut:rgba(44,76,156,.62)}\n#nbfs[data-skin=riso] .fs-scrim{top:-118px;bottom:-134px;right:-44px;left:-120px;background:linear-gradient(90deg,rgba(244,237,224,0),rgba(244,237,224,.35))}\n#nbfs[data-skin=riso] .fs-sheet{color:var(--b);transform:translateX(112%) rotate(3deg);transition:opacity .2s,transform .7s cubic-bezier(.2,.85,.15,1)}\n#nbfs[data-skin=riso].open .fs-sheet{transform:rotate(-1deg)}\n#nbfs[data-skin=riso] .fs-paper{position:absolute;inset:-10px -6px;background:   radial-gradient(circle at 50% 50%,rgba(255,77,151,.24) 0 1.1px,transparent 1.7px) 0 0/7px 7px,var(--paper);   -webkit-mask-image:none;box-shadow:0 1px 0 rgba(0,0,0,.05),0 22px 40px -18px rgba(28,38,68,.45);pointer-events:none}\n#nbfs[data-skin=riso] .fs-paper::before{content:\"\";position:absolute;inset:0;background:linear-gradient(160deg,var(--paper) 0 52%,rgba(244,237,224,.55) 75%,rgba(244,237,224,.15))}\n#nbfs[data-skin=riso] .fs-paper::after{content:\"\";position:absolute;left:14px;top:14px;width:15px;height:15px;border:1px solid var(--b);border-radius:50%;background:linear-gradient(var(--b),var(--b)) 50% 50%/1px 25px no-repeat,linear-gradient(var(--b),var(--b)) 50% 50%/25px 1px no-repeat;opacity:.8}\n#nbfs[data-skin=riso] .fs-reg2{position:absolute;right:8px;bottom:-4px;width:15px;height:15px;border:1px solid var(--p);border-radius:50%;background:linear-gradient(var(--p),var(--p)) 50% 50%/1px 25px no-repeat,linear-gradient(var(--p),var(--p)) 50% 50%/25px 1px no-repeat;opacity:.8;pointer-events:none}\n#nbfs[data-skin=riso] .fs-head{padding-left:40px}\n#nbfs[data-skin=riso] .fs-label{color:var(--b)}\n#nbfs[data-skin=riso] .fs-label::after{content:\"\";display:inline-block;width:10px;height:10px;background:var(--p);margin-left:10px;vertical-align:-1px;box-shadow:12px 0 0 var(--b)}\n#nbfs[data-skin=riso] .fs-tabs button{font-weight:900;color:var(--b)}\n#nbfs[data-skin=riso] .fs-tabs button b{color:var(--p)}\n#nbfs[data-skin=riso] .fs-tabs button.on{box-shadow:0 3px 0 var(--p)}\n#nbfs[data-skin=riso] .it{display:grid;grid-template-columns:44px 1fr;align-items:center;column-gap:0;padding:10px 26px 10px 28px;border-bottom:1.5px dashed rgba(44,76,156,.28)}\n#nbfs[data-skin=riso] .it-idx{font:500 11px var(--mono);color:var(--p)}\n#nbfs[data-skin=riso] .it-idx::before{content:\"Nº\"}\n#nbfs[data-skin=riso] .it-cover{width:44px;height:44px;background:var(--b);overflow:hidden;position:relative}\n#nbfs[data-skin=riso] .it-cover img{filter:grayscale(1) contrast(1.25) brightness(1.05);mix-blend-mode:screen}\n#nbfs[data-skin=riso] .it-cover::after{content:\"\";position:absolute;inset:0;background:radial-gradient(circle,rgba(244,237,224,.55) 0 .9px,transparent 1.4px) 0 0/4px 4px;mix-blend-mode:overlay}\n#nbfs[data-skin=riso] .it-title{font:900 20px/1.2 var(--sans);color:var(--b)}\n#nbfs[data-skin=riso] .it-body{display:grid;grid-template-columns:44px 1fr;column-gap:14px;row-gap:3px;align-items:center}\n#nbfs[data-skin=riso] .it-sub{display:contents}\n#nbfs[data-skin=riso] .it-cover{grid-column:1;grid-row:1 / span 2}\n#nbfs[data-skin=riso] .it-title{grid-column:2;grid-row:1}\n#nbfs[data-skin=riso] .it-meta{grid-column:2;grid-row:2}\n#nbfs[data-skin=riso] .it-acts{grid-column:2;grid-row:3;margin-top:8px}\n#nbfs[data-skin=riso] .it-meta{font:400 10.5px/1.6 var(--mono);color:var(--mut);letter-spacing:.04em}\n#nbfs[data-skin=riso] .it.now .it-meta::before{content:\"ON AIR \";color:var(--p)}\n#nbfs[data-skin=riso] .it.f{padding:18px 26px 18px 28px;background:radial-gradient(circle,rgba(255,77,151,.32) 0 1.5px,transparent 2.1px) 0 0/6px 6px}\n#nbfs[data-skin=riso] .it.f .it-cover{width:104px;height:104px;box-shadow:4px 3px 0 var(--p)}\n#nbfs[data-skin=riso] .it.f .it-title{font-size:var(--fz,30px);isolation:isolate}\n#nbfs[data-skin=riso] .it.f .it-title .t{position:relative;z-index:1;mix-blend-mode:multiply}\n#nbfs[data-skin=riso] .it.f .it-title .e1{display:block;color:var(--p);transform:translate(3px,2px);mix-blend-mode:multiply;transition:transform .5s cubic-bezier(.3,1.6,.4,1)}\n#nbfs[data-skin=riso] .it.f.enter .it-title .e1{transform:translate(12px,-6px);transition:none}\n#nbfs[data-skin=riso] .it.f .it-body{grid-template-columns:104px 1fr;row-gap:6px}\n#nbfs[data-skin=riso] .it.f .it-cover{grid-row:1 / span 3}\n#nbfs[data-skin=riso] .it-acts{gap:14px;align-items:center}\n#nbfs[data-skin=riso] .it-acts .play{font:900 13px/1 var(--sans);color:var(--p);border:2px solid var(--p);padding:6px 10px 5px;transform:rotate(-4deg);letter-spacing:.1em}\n#nbfs[data-skin=riso] .it-acts .play::before{content:\"PLAY \";font:500 10px var(--mono)}\n#nbfs[data-skin=riso] .it-acts .open{font:700 12.5px/1 var(--sans);color:var(--b);border-bottom:1.5px solid var(--b);padding-bottom:3px}\n#nbfs[data-skin=riso] .it-acts .play:hover{background:var(--p);color:var(--paper)}\n#nbfs[data-skin=riso] .fs-detail{transform:translateX(40px)}\n#nbfs[data-skin=riso].lv2 .fs-detail{transform:none}\n#nbfs[data-skin=riso].lv2 .fs-list{transform:translateX(-30px)}\n#nbfs[data-skin=riso] .dt-head{padding-left:40px}\n#nbfs[data-skin=riso] .dt-back{color:var(--b)}\n#nbfs[data-skin=riso] .dt-title{font:900 30px/1.15 var(--sans);color:var(--b)}\n#nbfs[data-skin=riso] .dt-title::before{content:attr(data-t);position:absolute;left:3px;top:2px;color:var(--p);mix-blend-mode:multiply}\n#nbfs[data-skin=riso] .dt-title span{position:relative;mix-blend-mode:multiply}\n#nbfs[data-skin=riso] .dt-row2{font:400 10.5px var(--mono);color:var(--mut)}\n#nbfs[data-skin=riso] .dt-play{font:900 12px var(--sans);color:var(--p);border:2px solid var(--p);padding:5px 9px 4px;transform:rotate(-3deg);letter-spacing:.1em}\n#nbfs[data-skin=riso] .dt-rows{top:118px}\n#nbfs[data-skin=riso] .sr{grid-template-columns:34px 1fr;padding:8px 26px 8px 40px}\n#nbfs[data-skin=riso] .sr-n{color:var(--p)}\n#nbfs[data-skin=riso] .sr-main{display:flex;align-items:baseline;gap:8px;min-width:0}\n#nbfs[data-skin=riso] .sr-m{font:700 15.5px/1.4 var(--sans);color:var(--b);white-space:nowrap}\n#nbfs[data-skin=riso] .sr-a{font:400 11px var(--mono);color:var(--mut);white-space:nowrap}\n#nbfs[data-skin=riso] .sr-lead{flex:1;border-bottom:1.5px dotted rgba(44,76,156,.4);transform:translateY(-3px);min-width:12px}\n#nbfs[data-skin=riso] .sr-t{color:var(--b)}\n#nbfs[data-skin=riso] .sr:hover .sr-m{text-decoration:underline;text-decoration-color:var(--p);text-underline-offset:4px}\n#nbfs[data-skin=riso] .sr.cur .sr-m{background:linear-gradient(transparent 52%,rgba(255,77,151,.45) 52% 92%,transparent 92%)}\n#nbfs[data-skin=riso] .fs-hint{color:var(--b);opacity:.7;left:40px}\n#nbfs[data-skin=riso] .fs-toast{color:var(--p);font-weight:900;left:40px}\n/* ============ 光斑 SUNLIT WALL ============ */\n#nbfs[data-skin=sun]{--paper:#f1ebe0;--ink:#2d2723;--t:#a8553a;--mut:rgba(45,39,35,.5)}\n#nbfs[data-skin=sun] .fs-scrim{display:none}\n#nbfs[data-skin=sun] .fs-sheet{color:var(--ink);transform:translateY(-22px) rotate(1.4deg);transform-origin:50% 0}\n#nbfs[data-skin=sun].open .fs-sheet{transform:rotate(.7deg)}\n#nbfs[data-skin=sun] .fs-paper{position:absolute;inset:0 18px 0 0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(0,0,0,.02)),var(--paper);box-shadow:-22px 26px 34px -10px rgba(60,44,30,.3),-2px 3px 6px rgba(60,44,30,.12)}\n#nbfs[data-skin=sun] .fs-paper::before{content:\"\";position:absolute;left:54px;top:0;bottom:0;width:1px;background:rgba(168,85,58,.28)}\n#nbfs[data-skin=sun] .fs-paper::after{content:\"\";position:absolute;left:50%;top:-14px;width:96px;height:28px;margin-left:-48px;background:rgba(236,226,202,.72);box-shadow:0 1px 2px rgba(0,0,0,.08);transform:rotate(-3deg)}\n#nbfs[data-skin=sun] .fs-light{position:absolute;inset:0 18px 0 0;pointer-events:none;overflow:hidden;mix-blend-mode:soft-light}\n#nbfs[data-skin=sun] .fs-light::before{content:\"\";position:absolute;left:-30%;top:-20%;width:90%;height:150%;background:linear-gradient(90deg,transparent,rgba(255,244,214,.95) 30%,rgba(255,244,214,.95) 62%,transparent);transform:skewX(-24deg);filter:blur(14px);animation:nbfs-sun-drift 26s ease-in-out infinite alternate}\n@keyframes nbfs-sun-drift{from{transform:translateX(-6%) skewX(-24deg)}to{transform:translateX(26%) skewX(-24deg)}}\n#nbfs[data-skin=sun] .fs-head{padding-left:70px;padding-right:46px}\n#nbfs[data-skin=sun] .fs-label{font-family:var(--serif);font-weight:500;letter-spacing:.3em;color:var(--mut);text-transform:none}\n#nbfs[data-skin=sun] .fs-tabs button{font-family:var(--serif);font-weight:500}\n#nbfs[data-skin=sun] .fs-tabs button b{font-family:var(--serif);font-style:italic}\n#nbfs[data-skin=sun] .fs-tabs button.on{box-shadow:0 2px 0 var(--t)}\n#nbfs[data-skin=sun] .fs-view{right:18px}\n#nbfs[data-skin=sun] .it{display:grid;grid-template-columns:42px 1fr;align-items:baseline;padding:11px 30px 11px 26px;border-bottom:1px solid rgba(120,100,80,.16)}\n#nbfs[data-skin=sun] .it-idx{font:italic 400 13px var(--serif);color:var(--t);opacity:.7;text-align:right;padding-right:14px}\n#nbfs[data-skin=sun] .it-idx::after{content:\".\"}\n#nbfs[data-skin=sun] .it-cover,#nbfs[data-skin=sun] .it-meta{display:none}\n#nbfs[data-skin=sun] .it-title{font:400 20px/1.4 var(--serif);color:rgba(45,39,35,.62)}\n#nbfs[data-skin=sun] .it.now .it-title::after{content:\"  ♪\";color:var(--t);font-size:14px}\n#nbfs[data-skin=sun] .it.f{padding:22px 30px 22px 26px}\n#nbfs[data-skin=sun] .it.f .it-body{display:grid;grid-template-columns:1fr auto;column-gap:14px;row-gap:10px;align-items:center}\n#nbfs[data-skin=sun] .it.f .it-title{font-size:var(--fz,30px);font-weight:500;color:var(--ink);grid-column:1;grid-row:1}\n#nbfs[data-skin=sun] .it.f .it-meta{grid-column:1;grid-row:2}\n#nbfs[data-skin=sun] .it.f .it-acts{grid-column:1;grid-row:3}\n#nbfs[data-skin=sun] .it.f .it-uline{display:block;position:absolute;left:0;bottom:-8px;width:100%;height:10px;overflow:visible}\n#nbfs[data-skin=sun] .it.f .it-uline path{fill:none;stroke:var(--t);stroke-width:2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset .8s cubic-bezier(.4,0,.2,1) .15s}\n#nbfs[data-skin=sun] .it.f.enter .it-uline path{stroke-dashoffset:1;transition:none}\n#nbfs[data-skin=sun] .it-sub{display:contents}\n#nbfs[data-skin=sun] .it.f .it-cover{display:block;grid-column:2;grid-row:1 / span 3;width:92px;height:106px;padding:6px 6px 16px;background:#fbf8f2;box-shadow:-8px 10px 14px -4px rgba(60,44,30,.32);transform:rotate(4deg);position:relative;transition:transform .5s cubic-bezier(.3,1.5,.4,1)}\n#nbfs[data-skin=sun] .it.f.enter .it-cover{transform:rotate(12deg) translateY(-10px);transition:none}\n#nbfs[data-skin=sun] .it.f .it-cover img{height:80px}\n#nbfs[data-skin=sun] .it.f .it-cover::after{content:\"\";position:absolute;left:24px;top:-8px;width:46px;height:15px;background:rgba(236,226,202,.8);transform:rotate(-6deg)}\n#nbfs[data-skin=sun] .it.f .it-meta{display:block;font:italic 400 12.5px/1.5 var(--serif);color:var(--mut)}\n#nbfs[data-skin=sun] .it-acts{gap:22px;font:500 14px/1 var(--serif)}\n#nbfs[data-skin=sun] .it-acts .play{color:var(--t)}\n#nbfs[data-skin=sun] .it-acts .play::before{content:\"▸ \"}\n#nbfs[data-skin=sun] .it-acts .open{color:var(--ink);opacity:.7}\n#nbfs[data-skin=sun] .it-acts button:hover{text-decoration:underline wavy;text-decoration-color:var(--t);text-underline-offset:5px}\n#nbfs[data-skin=sun] .fs-detail{transform:translateY(14px) rotate(-.6deg)}\n#nbfs[data-skin=sun].lv2 .fs-detail{transform:none}\n#nbfs[data-skin=sun].lv2 .fs-list{transform:translateY(-10px)}\n#nbfs[data-skin=sun] .dt-head{padding-left:70px;padding-right:46px}\n#nbfs[data-skin=sun] .dt-back{font-family:var(--serif);letter-spacing:.1em;color:var(--t)}\n#nbfs[data-skin=sun] .dt-title{font:500 28px/1.3 var(--serif);color:var(--ink)}\n#nbfs[data-skin=sun] .dt-row2{font:italic 400 12.5px var(--serif);color:var(--mut)}\n#nbfs[data-skin=sun] .dt-play{font:500 13.5px var(--serif);color:var(--t)}\n#nbfs[data-skin=sun] .dt-play::before{content:\"▸ \"}\n#nbfs[data-skin=sun] .dt-rows{top:120px}\n#nbfs[data-skin=sun] .sr{grid-template-columns:28px 1fr auto;padding:9px 30px 9px 26px;border-bottom:1px solid rgba(120,100,80,.16)}\n#nbfs[data-skin=sun] .sr-n{font:italic 400 12px var(--serif);color:var(--t);opacity:.7;text-align:right;padding-right:6px}\n#nbfs[data-skin=sun] .sr-m{font:400 16.5px/1.4 var(--serif);color:var(--ink)}\n#nbfs[data-skin=sun] .sr-a{font:italic 400 12px/1.5 var(--serif);color:var(--mut)}\n#nbfs[data-skin=sun] .sr-t{font:italic 400 12px var(--serif);color:var(--mut)}\n#nbfs[data-skin=sun] .sr:hover .sr-m{text-decoration:underline;text-decoration-color:rgba(168,85,58,.5);text-underline-offset:5px}\n#nbfs[data-skin=sun] .sr.cur .sr-m{color:var(--t)}\n#nbfs[data-skin=sun] .sr.cur .sr-n::before{content:\"♪ \";font-style:normal}\n#nbfs[data-skin=sun] .fs-hint{color:var(--ink);font-family:var(--serif);letter-spacing:.14em;left:70px;right:46px}\n#nbfs[data-skin=sun] .fs-toast{color:var(--t);font-family:var(--serif);left:70px}";
  var SKINS = {
    echo: { label: 'PLAYLISTS · 歌单', hint: ['滚轮 翻', '右键 / 点空白 收起'], play: '播放', open: '打开 →', back: '← 返回歌单', dplay: '播放整张', fz: [54, 430],
      idx: function (i) { return pad2(i + 1); }, meta: function (p) { return p.src + ' · ' + p.n + ' 首' + (p.plays ? ' · ' + p.plays : ''); } },
    star: { label: '星表 · CATALOGUE', hint: ['滚轮 巡天', '右键 / 点空白 收起'], play: '播放', open: '展开星座', back: '← 回到星表', dplay: '播放整个星座', fz: [30, 300],
      idx: function (i) { return 'NB ' + pad2(i + 1); }, meta: function (p) { return '星等 ' + (6 - Math.min(5.2, (p.n || 0) / 12)).toFixed(1) + ' · ' + p.n + ' 首 · ' + p.src; } },
    riso: { label: 'TICKETS · 票夹', hint: ['WHEEL 翻', 'R-CLICK / 点空白 收起'], play: '播放', open: '曲目单', back: '← 返回票夹', dplay: '播放', fz: [30, 300],
      idx: function (i) { return pad2(i + 1); }, meta: function (p) { return p.src + ' / ' + p.n + ' TRACKS' + (p.plays ? ' / ' + p.plays : ''); } },
    sun: { label: '墙上的歌单', hint: ['滚轮 翻', '右键 / 点空白 收起'], play: '播放', open: '翻开 →', back: '← 放回去', dplay: '从头放', fz: [30, 280],
      idx: function (i) { return String(i + 1); }, meta: function (p) { return p.src + ' · ' + p.n + ' 首'; } }
  };
  var FX_TO_SKIN = { 'echo-type': 'echo', 'star-constellation': 'star', 'riso-halftone': 'riso', 'window-komorebi': 'sun' };
  var TAB_NAMES = { queue: '队列', mine: '我的歌单', fav: '收藏', pod: '播客' };
  var TAB_STORE = 'notblind-flat-shelf-tab-v1';

  var st = { open: false, lv: 1, tab: '', focus: 0, skin: 'echo', items: [], detail: null, lastPlayed: '', sig: '', built: false, flat: false };
  var root = null, els = {};

  function pad2(n) { return String(n).padStart(2, '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function weightLen(s) { var n = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) n += /[⺀-鿿가-힯]/.test(s[i]) ? 1 : 0.56; return n; }
  function g(name) { try { return window[name]; } catch (_) { return undefined; } }
  function compact(n) { n = Number(n) || 0; if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿'; if (n >= 1e4) return (n / 1e4).toFixed(1) + '万'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return String(n); }
  function fmtDur(ms) { ms = Number(ms) || 0; if (ms > 0 && ms < 10000) ms *= 1000; if (!ms) return ''; var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  function coverSrc(url, size) {
    if (!url) return '';
    try {
      var u = typeof coverUrlWithSize === 'function' ? coverUrlWithSize(url, size || 200) : url;
      var p = typeof coverProxySrc === 'function' ? coverProxySrc(u) : '';
      return p || u;
    } catch (_) { return url; }
  }
  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.classList.remove('show'); }, 1900);
  }

  // ---------- 什么时候接管 ----------
  function lyricFxState() {
    try { var api = window.NotBlindLyricFx; return api && api.state ? api.state() : null; } catch (_) { return null; }
  }
  function flatActive() {
    var s = lyricFxState();
    if (!s || s.mode !== '2d') return false;
    if (s.phase !== 'on' && s.phase !== 'in' && s.phase !== 'prep') return false;
    var b = document.body;
    if (b.classList.contains('splash-active')) return false;
    try { if (typeof emptyHomeActive !== 'undefined' && emptyHomeActive) return false; } catch (_) { }
    try { if (typeof homeThemeHost !== 'undefined' && homeThemeHost.visible) return false; } catch (_) { }
    return true;
  }
  function currentSkin() {
    var s = lyricFxState();
    return (s && FX_TO_SKIN[s.active || s.choice]) || 'echo';
  }

  // ---------- 数据 ----------
  function playlistItems() {
    var ups = g('userPlaylists') || [];
    var mine = [], fav = [];
    ups.forEach(function (pl) {
      if (!pl) return;
      var pane = pl.shelfPane || pl.shelf_pane;
      if (pane === 'mine' || pane === 'fav') (pane === 'fav' ? fav : mine).push(pl);
      else (pl.subscribed ? fav : mine).push(pl);
    });
    function map(pl) {
      var pv = pl.provider;
      var provider = pv === 'mineradio' ? 'mineradio' : (pv === 'qq' ? 'qq' : (pv === 'kugou' ? 'kugou' : (pv === 'qishui' ? 'qishui' : (pv === 'spotify' ? 'spotify' : 'netease'))));
      var src = { mineradio: '内置', qq: 'QQ', kugou: '酷狗', qishui: '汽水', spotify: 'Spotify', netease: '网易云' }[provider];
      var id = String(pl.id);
      if (provider === 'spotify' && id.indexOf('spotify:') !== 0) id = 'spotify:' + id;
      var pid = (provider === 'mineradio' ? 'mineradio:' : (provider === 'qq' ? 'qq:' : (provider === 'kugou' ? 'kugou:' : (provider === 'qishui' ? 'qishui:' : '')))) + id;
      return { kind: 'playlist', name: pl.name || '未命名歌单', n: Number(pl.trackCount) || 0, src: src, plays: pl.playCount ? '播放 ' + compact(pl.playCount) : '', cover: pl.cover || pl.coverImgUrl || '', pid: pid };
    }
    var pods = (g('myPodcastCollections') || []).map(function (pc) {
      return { kind: 'podcast', name: pc.title || '播客', n: Number(pc.count) || 0, src: '播客', plays: '', cover: pc.cover || '', pid: 'podcast:' + pc.key };
    });
    return { mine: mine.map(map), fav: fav.map(map), pod: pods };
  }
  function queueList() { var q = g('playQueue'); return Array.isArray(q) ? q : []; }
  function currentIndex() { var c = g('currentIdx'); return typeof c === 'number' ? c : -1; }
  function currentSong() { var q = queueList(), c = currentIndex(); return c >= 0 && c < q.length ? q[c] : null; }
  function songKey(s) { if (!s) return ''; try { if (typeof queueItemKey === 'function') return queueItemKey(s) || ''; } catch (_) { } return String(s.id || '') + '|' + (s.name || ''); }
  function availableTabs(lists) {
    var t = [];
    if (queueList().length) t.push('queue');
    if (lists.mine.length) t.push('mine');
    if (lists.fav.length) t.push('fav');
    if (lists.pod.length) t.push('pod');
    return t;
  }

  // ---------- 界面 ----------
  function build() {
    if (st.built) return;
    st.built = true;
    var style = document.createElement('style');
    style.id = 'nbfs-style';
    style.textContent = CSS + '\n' +
      'body.nbfs-flat #playlist-panel{opacity:0!important;visibility:hidden!important;pointer-events:none!important}\n' +
      '#nbfs .dt-empty{padding:18px 28px;font:400 13px/1.7 var(--sans);opacity:.7}\n' +
      '#nbfs .fs-empty{position:absolute;left:28px;right:28px;top:30%;font:400 14px/1.8 var(--sans);opacity:.75}\n' +
      '#nbfs[data-skin=riso] .fs-empty,#nbfs[data-skin=riso] .dt-empty{padding-left:40px}\n' +
      '#nbfs[data-skin=sun] .fs-empty,#nbfs[data-skin=sun] .dt-empty{padding-left:70px}\n' +
      '#nbfs.lv2.q .dt-back{visibility:hidden}\n';
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'nbfs';
    root.setAttribute('data-skin', 'echo');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="fs-scrim"></div>' +
      '<div class="fs-sheet" role="dialog" aria-label="歌单">' +
      '<div class="fs-paper"></div><div class="fs-light"></div><div class="fs-reg2"></div><div class="fs-axis"></div>' +
      '<div class="fs-head"><div class="fs-label"></div><div class="fs-tabs"></div></div>' +
      '<div class="fs-view fs-list"><div class="fs-line"></div><div class="fs-track"></div></div>' +
      '<div class="fs-view fs-detail"><div class="dt-head"><button class="dt-back" type="button"></button><div class="dt-title"></div>' +
      '<div class="dt-row2"><span class="dt-meta"></span><button class="dt-play" type="button"></button></div></div><div class="dt-rows"></div></div>' +
      '<div class="fs-toast"></div><div class="fs-hint"></div></div>';
    var shell = document.getElementById('desktop-window-shell') || document.body;
    var cc = document.getElementById('canvas-container');
    if (cc && cc.parentNode === shell && cc.nextSibling) shell.insertBefore(root, cc.nextSibling);
    else shell.appendChild(root);
    ['label', 'tabs', 'list', 'line', 'track', 'detail', 'back', 'title', 'meta', 'play', 'rows', 'toast', 'hint'].forEach(function (k) {
      var sel = { label: '.fs-label', tabs: '.fs-tabs', list: '.fs-list', line: '.fs-line', track: '.fs-track', detail: '.fs-detail', back: '.dt-back', title: '.dt-title', meta: '.dt-meta', play: '.dt-play', rows: '.dt-rows', toast: '.fs-toast', hint: '.fs-hint' }[k];
      els[k] = root.querySelector(sel);
    });
    bindUi();
    try { if (typeof UI_HIT_SELECTOR === 'string' && UI_HIT_SELECTOR.indexOf('#nbfs') < 0) UI_HIT_SELECTOR += ',#nbfs'; } catch (_) { }
  }

  function applySkin() {
    var k = currentSkin();
    st.skin = k;
    root.setAttribute('data-skin', k);
    var S = SKINS[k];
    els.label.textContent = S.label;
    els.hint.innerHTML = '<span>' + S.hint[0] + '</span><span>' + S.hint[1] + '</span>';
  }

  function renderTabs(tabs) {
    els.tabs.innerHTML = tabs.map(function (k) {
      var n = k === 'queue' ? queueList().length : (st.lists[k] || []).length;
      return '<button type="button" data-tab="' + k + '" class="' + (k === st.tab ? 'on' : '') + '">' + TAB_NAMES[k] + '<b>' + n + '</b></button>';
    }).join('');
  }

  function refreshData(keepTab) {
    st.lists = playlistItems();
    var tabs = availableTabs(st.lists);
    if (!keepTab || tabs.indexOf(st.tab) < 0) {
      var saved = '';
      try { saved = localStorage.getItem(TAB_STORE) || ''; } catch (_) { }
      st.tab = tabs.indexOf(saved) >= 0 ? saved : (tabs.indexOf('mine') >= 0 ? 'mine' : (tabs[0] || 'mine'));
    }
    renderTabs(tabs);
    return tabs;
  }

  function renderList() {
    var S = SKINS[st.skin];
    var arr = st.items = (st.tab === 'queue') ? [] : (st.lists[st.tab] || []);
    if (!arr.length) {
      els.track.innerHTML = '<div class="fs-empty">' + (queueList().length ? '这里还没有歌单。' : '还没有歌单，登录网易云 / QQ 音乐后会出现在这里。') + '</div>';
      els.track.style.transform = '';
      return;
    }
    var h = '';
    arr.forEach(function (p, i) {
      var sz = (2.4 + Math.min(6, p.n / 14)).toFixed(1);
      var cov = coverSrc(p.cover, 200);
      h += '<div class="it' + (st.lastPlayed && st.lastPlayed === p.pid ? ' now' : '') + '" data-i="' + i + '" style="--sz:' + sz + 'px"><i class="it-star"></i><div class="it-idx">' + S.idx(i) + '</div>' +
        '<div class="it-body"><div class="it-sub"><div class="it-cover">' + (cov ? '<img alt="" loading="lazy" decoding="async" src="' + esc(cov) + '">' : '') + '</div><div class="it-meta">' + esc(S.meta(p)) + '</div></div>' +
        '<div class="it-title"><span class="e1" aria-hidden="true">' + esc(p.name) + '</span><span class="e2" aria-hidden="true">' + esc(p.name) + '</span><span class="t">' + esc(p.name) + '</span>' +
        '<svg class="it-uline" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M1 6 C 20 3, 40 8, 60 5 S 90 4, 99 6"/></svg></div>' +
        '<div class="it-acts">' + (p.kind === 'playlist' ? '<button type="button" class="play">' + S.play + '</button>' : '') + '<button type="button" class="open">' + S.open + '</button></div></div></div>';
    });
    els.track.innerHTML = h;
    setFocus(Math.min(st.focus, arr.length - 1), true);
  }

  function layoutFocus(instant) {
    var f = els.track.children[st.focus];
    if (!f || !f.classList.contains('it')) return;
    var anchor = els.list.clientHeight * 0.42;
    var y = anchor - (f.offsetTop + f.offsetHeight / 2);
    if (instant) {
      els.track.style.transition = 'none';
      els.track.style.transform = 'translateY(' + y + 'px)';
      void els.track.offsetWidth;
      els.track.style.transition = '';
    } else els.track.style.transform = 'translateY(' + y + 'px)';
    els.line.style.top = (anchor + f.offsetHeight / 2 - 2) + 'px';
  }

  function setFocus(i, instant) {
    var arr = st.items;
    if (!arr.length) return;
    i = Math.max(0, Math.min(arr.length - 1, i));
    var changed = i !== st.focus || instant;
    st.focus = i;
    var its = els.track.children, S = SKINS[st.skin];
    var scale = Math.max(0.6, Math.min(1, (root.clientWidth || 520) / 520));
    for (var k = 0; k < its.length; k++) {
      var el = its[k];
      el.style.setProperty('--d', Math.abs(k - i));
      var was = el.classList.contains('f');
      el.classList.toggle('f', k === i);
      if (k === i) {
        var L = weightLen(arr[k].name);
        el.style.setProperty('--fz', Math.max(20, Math.min(S.fz[0], Math.floor(S.fz[1] * scale / Math.max(1, L)))) + 'px');
        if (!was && changed) {
          el.classList.add('enter');
          (function (e) { requestAnimationFrame(function () { requestAnimationFrame(function () { e.classList.remove('enter'); }); }); })(el);
        }
      }
    }
    layoutFocus(instant);
  }

  // ---------- 第二层：歌曲列表 ----------
  function apiUrlFor(pid, offset) {
    var lim = typeof PLAYLIST_LAZY_BATCH_SIZE === 'number' ? PLAYLIST_LAZY_BATCH_SIZE : 60;
    pid = String(pid || '');
    function pre(p) { return pid.indexOf(p) === 0 ? pid.slice(p.length) : ''; }
    var pod = pre('podcast:'), qq = pre('qq:'), kg = pre('kugou:'), qs = pre('qishui:'), sp = pre('spotify:');
    if (pod) return '/api/podcast/my/items?key=' + encodeURIComponent(pod) + '&limit=' + lim;
    if (qq) return '/api/qq/playlist/tracks?id=' + encodeURIComponent(qq) + '&limit=' + lim + '&offset=' + offset;
    if (kg) return '/api/kugou/playlist/tracks?id=' + encodeURIComponent(kg) + '&limit=' + lim + '&offset=' + offset;
    if (qs) return '/api/qishui/playlist/tracks?id=' + encodeURIComponent(qs) + '&limit=' + lim + '&offset=' + offset;
    if (sp) return '/api/spotify/playlist/tracks?id=' + encodeURIComponent(sp) + '&limit=' + lim + '&offset=' + offset;
    return '/api/playlist/tracks?id=' + encodeURIComponent(pid) + '&limit=' + lim + '&offset=' + offset;
  }
  function fetchPage(pid, offset) {
    var lim = typeof PLAYLIST_LAZY_BATCH_SIZE === 'number' ? PLAYLIST_LAZY_BATCH_SIZE : 60;
    if (pid.indexOf('mineradio:') === 0 && typeof builtInPlaylistTracksPage === 'function') return builtInPlaylistTracksPage(pid.slice(10), { limit: lim, offset: offset });
    return apiJson(apiUrlFor(pid, offset));
  }
  function sourceOf(pid) {
    pid = String(pid);
    var m = /^(mineradio|qq|kugou|qishui|spotify):(.*)$/.exec(pid);
    if (m) return { provider: m[1], id: m[2] };
    if (pid.indexOf('podcast:') === 0) return null;
    return { provider: 'netease', id: pid };
  }

  function openDetail(i) {
    var p = st.items[i];
    if (!p) return;
    var S = SKINS[st.skin];
    var token = (st.dToken = (st.dToken || 0) + 1);
    st.detail = { kind: p.kind, pid: p.pid, title: p.name, item: p, tracks: null, total: p.n, nextOffset: 0, hasMore: false, loadingMore: false, failed: false, idx: i };
    st.lv = 2;
    root.classList.add('lv2');
    root.classList.remove('q');
    fillDetailHead(p.name, S.meta(p), p.kind === 'playlist');
    els.rows.innerHTML = '<div class="dt-empty">加载中…</div>';
    els.rows.scrollTop = 0;
    fetchPage(p.pid, 0).then(function (r) {
      if (token !== st.dToken || !st.detail) return;
      var tracks = p.kind === 'podcast' ? (r && r.items || []) : (r && r.tracks || []);
      st.detail.tracks = tracks;
      st.detail.nextOffset = Number(r && r.nextOffset) || tracks.length;
      st.detail.total = Math.max(p.n || 0, Number(r && (r.total || (r.playlist && r.playlist.trackCount))) || 0);
      st.detail.hasMore = p.kind !== 'podcast' && !!(r && r.hasMore);
      renderRows();
    }).catch(function (e) {
      if (token !== st.dToken || !st.detail) return;
      console.warn('[FlatShelf] load', e);
      st.detail.failed = true;
      els.rows.innerHTML = '<div class="dt-empty">歌单加载失败，右键返回再试一次。</div>';
    });
  }
  function fillDetailHead(title, meta, canPlayAll) {
    var S = SKINS[st.skin];
    els.back.textContent = S.back;
    els.title.setAttribute('data-t', title);
    els.title.innerHTML = '<span>' + esc(title) + '</span>';
    els.meta.textContent = meta;
    els.play.textContent = S.dplay;
    els.play.style.display = canPlayAll ? '' : 'none';
  }
  function openQueueView() {
    var S = SKINS[st.skin];
    st.dToken = (st.dToken || 0) + 1;
    st.detail = { kind: 'queue', title: '播放队列', tracks: null };
    st.lv = 2;
    root.classList.add('lv2', 'q');
    var q = queueList();
    fillDetailHead('播放队列', q.length + ' 首 · 正在播放第 ' + (currentIndex() + 1) + ' 首', false);
    renderRows(true);
  }
  function rowsFor() {
    if (!st.detail) return [];
    if (st.detail.kind === 'queue') return queueList();
    return st.detail.tracks || [];
  }
  function renderRows(scrollToCurrent) {
    var list = rowsFor();
    if (!list.length) {
      els.rows.innerHTML = '<div class="dt-empty">' + (st.detail.kind === 'queue' ? '队列是空的。' : (st.detail.kind === 'podcast' ? '播客为空' : '歌单为空')) + '</div>';
      return;
    }
    var h = '', cur = currentSong(), curKey = songKey(cur), cIdx = currentIndex();
    var seed = 7 + (st.detail.pid ? String(st.detail.pid).length * 13 : 3);
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var dots = [];
    list.forEach(function (s, j) {
      var isCur = st.detail.kind === 'queue' ? j === cIdx : (curKey && songKey(s) === curKey);
      var x = 38 + Math.round(rnd() * 30), sz = (2 + rnd() * 3.2).toFixed(1);
      dots.push(x);
      var name = s.name || s.title || '未知歌曲', artist = s.artist || s.dj || s.radioName || '', dur = fmtDur(s.duration || s.dt);
      h += '<div class="sr' + (isCur ? ' cur' : '') + '" data-j="' + j + '" style="--x:' + x + 'px;--sz:' + sz + 'px"><i class="sr-dot"></i><span class="sr-n">' + pad2(j + 1) + '</span>' +
        (st.skin === 'riso'
          ? '<span class="sr-main"><span class="sr-m">' + esc(name) + '</span><span class="sr-a">' + esc(artist) + '</span><span class="sr-lead"></span><span class="sr-t">' + dur + '</span></span>'
          : '<span><span class="sr-m">' + esc(name) + '</span><span class="sr-a">' + esc(artist) + '</span></span><span class="sr-t">' + dur + '</span>') + '</div>';
    });
    if (st.detail.hasMore) h += '<div class="dt-empty dt-more">继续往下滚，加载更多…</div>';
    var keep = els.rows.scrollTop;
    els.rows.innerHTML = h;
    if (st.skin === 'star') {
      var rs = els.rows.querySelectorAll('.sr'), pts = [];
      rs.forEach(function (e, k) { pts.push(dots[k] + ',' + (e.offsetTop + 18)); });
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'dt-svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', String(els.rows.scrollHeight));
      svg.innerHTML = '<polyline points="' + pts.join(' ') + '" fill="none" stroke="rgba(214,220,238,.28)" stroke-width="1"/>';
      els.rows.insertBefore(svg, els.rows.firstChild);
    }
    if (scrollToCurrent) {
      var c = els.rows.querySelector('.sr.cur');
      els.rows.scrollTop = c ? Math.max(0, c.offsetTop - els.rows.clientHeight * 0.35) : 0;
    } else els.rows.scrollTop = keep;
  }
  function markCurrentRow() {
    if (!st.detail || st.lv !== 2) return;
    var cur = currentSong(), curKey = songKey(cur), cIdx = currentIndex(), list = rowsFor();
    els.rows.querySelectorAll('.sr').forEach(function (r) {
      var j = +r.getAttribute('data-j');
      r.classList.toggle('cur', st.detail.kind === 'queue' ? j === cIdx : !!(curKey && songKey(list[j]) === curKey));
    });
  }
  function loadMore() {
    var d = st.detail;
    if (!d || !d.hasMore || d.loadingMore || d.kind !== 'playlist') return;
    d.loadingMore = true;
    var token = st.dToken;
    fetchPage(d.pid, d.nextOffset).then(function (r) {
      if (token !== st.dToken || st.detail !== d) return;
      var more = r && r.tracks || [];
      d.tracks = d.tracks.concat(more);
      d.nextOffset = Number(r && r.nextOffset) || d.tracks.length;
      d.hasMore = !!(r && r.hasMore) && more.length > 0;
      d.loadingMore = false;
      renderRows();
    }).catch(function () { d.loadingMore = false; d.hasMore = false; renderRows(); });
  }
  function closeDetail() {
    st.dToken = (st.dToken || 0) + 1;
    st.detail = null;
    st.lv = 1;
    root.classList.remove('lv2', 'q');
    if (st.tab === 'queue') { setOpen(false); return; }
    renderList();
  }

  // ---------- 动作 ----------
  function playPlaylist(p) {
    if (!p || p.kind !== 'playlist' || typeof loadPlaylistIntoQueueById !== 'function') return;
    st.lastPlayed = p.pid;
    try { loadPlaylistIntoQueueById(p.pid, true, p.name); } catch (e) { console.warn('[FlatShelf] play', e); }
    toast('开始播放「' + p.name + '」');
    if (st.lv === 1) renderList();
  }
  function playRow(j) {
    var d = st.detail;
    if (!d) return;
    if (d.kind === 'queue') {
      if (typeof playQueueAt === 'function') playQueueAt(j);
      setTimeout(markCurrentRow, 120);
      return;
    }
    var list = d.tracks || [], song = list[j];
    if (!song) return;
    if (song.type === 'podcast-radio') {
      if (typeof loadPodcastRadioIntoQueue === 'function') loadPodcastRadioIntoQueue(song.id || song.radioId, true, song.name || d.title);
      return;
    }
    var playIndex = list.slice(0, j + 1).filter(function (s) { return s && s.id; }).length - 1;
    var all = list.filter(function (s) { return s && s.id; }).map(function (s) { return typeof cloneSong === 'function' ? cloneSong(s) : Object.assign({}, s); });
    var src = sourceOf(d.pid);
    if (!all.length || playIndex < 0 || !src) return;
    var qid = src.provider !== 'netease' ? src.provider + ':' + src.id : src.id;
    st.lastPlayed = d.pid;
    try {
      var pr = loadPlaylistIntoQueueById(qid, true, d.title, { seedTracks: all, startIndex: playIndex, total: d.total, nextOffset: d.nextOffset, hasMore: d.hasMore, preserveHomeState: true });
      if (pr && pr.catch) pr.catch(function (e) { console.warn('[FlatShelf] play row', e); });
    } catch (e) { console.warn('[FlatShelf] play row', e); }
    els.rows.querySelectorAll('.sr').forEach(function (r) { r.classList.toggle('cur', +r.getAttribute('data-j') === j); });
  }
  function rowNext(j) {
    var d = st.detail;
    if (!d) return;
    if (d.kind === 'queue') { if (typeof queueIndexNext === 'function') queueIndexNext(j); setTimeout(function () { renderRows(); }, 60); return; }
    var s = (d.tracks || [])[j];
    if (s && s.id && s.type !== 'podcast-radio' && typeof queueDetailSongNext === 'function') queueDetailSongNext(s);
  }

  function selectTab(k) {
    st.tab = k;
    st.focus = 0;
    try { localStorage.setItem(TAB_STORE, k); } catch (_) { }
    renderTabs(availableTabs(st.lists));
    if (k === 'queue') { openQueueView(); return; }
    if (st.lv === 2) { st.dToken++; st.detail = null; st.lv = 1; root.classList.remove('lv2', 'q'); }
    renderList();
  }

  function setOpen(on, tab) {
    build();
    if (on) {
      if (st.open && !tab) return;
      closeOldPanels();
      applySkin();
      refreshData(true);
      if (tab && availableTabs(st.lists).indexOf(tab) >= 0) st.tab = tab;
      renderTabs(availableTabs(st.lists));
      st.open = true;
      root.classList.add('open');
      root.setAttribute('aria-hidden', 'false');
      if (st.tab === 'queue') openQueueView();
      else { st.lv = 1; root.classList.remove('lv2', 'q'); renderList(); requestAnimationFrame(function () { layoutFocus(true); }); }
    } else {
      if (!st.open) return;
      st.open = false;
      st.dToken = (st.dToken || 0) + 1;
      root.classList.remove('open', 'lv2', 'q');
      root.setAttribute('aria-hidden', 'true');
      st.lv = 1;
      st.detail = null;
      if (root.contains(document.activeElement)) document.activeElement.blur();
    }
  }
  function back() {
    if (!st.open) return false;
    if (st.lv === 2) closeDetail();
    else setOpen(false);
    return true;
  }
  function closeOldPanels() {
    try { if (typeof shelfManager !== 'undefined' && shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent() && typeof safeShelfCloseContent === 'function') safeShelfCloseContent('flat-shelf'); } catch (_) { }
    try { if (typeof shelfPinnedOpen !== 'undefined' && shelfPinnedOpen && typeof setShelfPinnedOpen === 'function') setShelfPinnedOpen(false, true); } catch (_) { }
  }

  // ---------- 事件 ----------
  function bindUi() {
    els.tabs.addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) selectTab(b.getAttribute('data-tab')); });
    els.track.addEventListener('click', function (e) {
      var it = e.target.closest('.it');
      if (!it) return;
      var i = +it.getAttribute('data-i');
      if (e.target.closest('.play')) { playPlaylist(st.items[i]); return; }
      if (e.target.closest('.open') || i === st.focus) { openDetail(i); return; }
      setFocus(i);
    });
    els.back.addEventListener('click', closeDetail);
    els.play.addEventListener('click', function () { if (st.detail && st.detail.item) playPlaylist(st.detail.item); });
    els.rows.addEventListener('click', function (e) { var r = e.target.closest('.sr'); if (r) playRow(+r.getAttribute('data-j')); });
    els.rows.addEventListener('scroll', function () {
      if (els.rows.scrollTop + els.rows.clientHeight > els.rows.scrollHeight - 160) loadMore();
    }, { passive: true });
    var acc = 0;
    els.list.addEventListener('wheel', function (e) {
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) >= 50) { setFocus(st.focus + (acc > 0 ? 1 : -1)); acc = 0; }
    }, { passive: false });
    // 抽屉里的滚轮不要漏给播放页（镜头、音量等）
    root.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    ['pointerdown', 'mousedown', 'click', 'dblclick'].forEach(function (t) { root.addEventListener(t, function (e) { if (st.open) e.stopPropagation(); }); });
  }

  var rdown = { x: 0, y: 0, at: 0, on: false, target: null };
  // [二改 2026-09-28] 左键点到歌单外面任何地方 = 收起（不用非得再右键 / 按 Esc）。
  // 底部播放条（播放、下一首、进度）和它弹出的小窗照常用，不收；歌单自己弹出的弹窗里点击也不收。
  window.addEventListener('pointerdown', function (e) {
    if (!st.open || e.button !== 0) return;
    var t = e.target;
    if (!t || (root && root.contains(t))) return;
    if (t.closest && t.closest('#bottom-bar,.modal-mask,[role="dialog"],#toast,#mri-slot,#visual-guide,#desktop-titlebar,.volume-popover,.quality-popover,.mini-queue-popover,.lyric-timing-popover,#sound-fx-popover,#control-source-switcher')) return;
    setOpen(false);
  }, true);
  window.addEventListener('pointerdown', function (e) {
    if (e.button !== 2) return;
    rdown.on = true; rdown.target = e.target; rdown.x = e.clientX; rdown.y = e.clientY; rdown.at = performance.now();
  }, true);
  window.addEventListener('contextmenu', function (e) {
    if (!flatActive()) return;
    var t = e.target;
    var inside = !!(root && t && root.contains(t));
    if (rdown.on) {
      rdown.on = false;
      if (Math.abs(e.clientX - rdown.x) + Math.abs(e.clientY - rdown.y) > 8 || performance.now() - rdown.at > 650) return;
    }
    // 歌曲行上右键 = 下一首播放
    var row = inside && t.closest && t.closest('.sr');
    if (row && st.open && st.lv === 2) {
      e.preventDefault(); e.stopImmediatePropagation();
      rowNext(+row.getAttribute('data-j'));
      return;
    }
    if (e.defaultPrevented) return; // 右键回退已经处理（比如关掉了弹窗 / 这张歌单）
    if (!inside) {
      if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"],[data-native-contextmenu]')) return;
      var onStage = false;
      try { onStage = typeof rightClickOnStage === 'function' ? rightClickOnStage(e) : (typeof isPointerOverUi === 'function' ? !isPointerOverUi(e) : true); } catch (_) { onStage = false; }
      if (!onStage) return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (st.open) back(); else setOpen(true);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!st.open) return;
    var t = e.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); back(); return; }
    if (st.lv === 1 && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault(); e.stopImmediatePropagation();
      setFocus(st.focus + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (st.lv === 1 && e.key === 'Enter' && !(t && t.closest && t.closest('button'))) {
      e.preventDefault(); e.stopImmediatePropagation();
      openDetail(st.focus);
    }
  }, true);
  window.addEventListener('resize', function () { if (st.open && st.lv === 1) setFocus(st.focus, true); });

  // 右键回退：把「平面歌单」放在「歌单面板」前面
  try {
    if (typeof RIGHT_CLICK_BACK_STEPS !== 'undefined' && Array.isArray(RIGHT_CLICK_BACK_STEPS)) {
      var at = -1;
      RIGHT_CLICK_BACK_STEPS.forEach(function (s, i) { if (at < 0 && s[0] === '歌单面板') at = i; });
      var step = ['平面歌单', function () {
        if (!st.open) return false;
        var t = rdown.target;
        return !(t && root && root.contains(t) && t.closest && t.closest('.sr'));
      }, function () {
        // 歌曲行上的右键交给上面的"下一首播放"，这里不退
        return back();
      }];
      if (at >= 0) RIGHT_CLICK_BACK_STEPS.splice(at, 0, step); else RIGHT_CLICK_BACK_STEPS.push(step);
    }
  } catch (_) { }

  // 平面歌词时：左边的歌单 / 队列面板不再弹出，改开这里
  function wrapGlobal(name, make) {
    try {
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__nbfs) return;
      var w = make(orig);
      w.__nbfs = true;
      window[name] = w;
    } catch (_) { }
  }
  wrapGlobal('isPlaylistEdgeTrigger', function (orig) {
    return function () { if (flatActive()) return false; return orig.apply(this, arguments); };
  });
  wrapGlobal('openPlaylistPanelTab', function (orig) {
    return function (tab) {
      if (flatActive()) { setOpen(true, tab === 'queue' ? 'queue' : (tab === 'podcasts' ? 'pod' : 'mine')); return; }
      return orig.apply(this, arguments);
    };
  });
  wrapGlobal('togglePlaylistPanel', function (orig) {
    return function (force) {
      if (flatActive() && force !== false) {
        if (force === true || !st.open) setOpen(true); else setOpen(false);
        return;
      }
      return orig.apply(this, arguments);
    };
  });

  // 状态巡检：平面歌词开 / 关、换效果、换歌、队列变化
  function tick() {
    var on = flatActive();
    if (on !== st.flat) {
      st.flat = on;
      document.body.classList.toggle('nbfs-flat', on);
      if (on) {
        closeOldPanels();
        try { var pp = document.getElementById('playlist-panel'); if (pp && typeof closePlaylistPanelSoft === 'function') closePlaylistPanelSoft('flat-shelf'); } catch (_) { }
      }
    }
    if (!on) { if (st.open) setOpen(false); return; }
    if (!st.open) return;
    if (currentSkin() !== st.skin) {
      applySkin();
      if (st.lv === 2 && st.detail) { if (st.detail.kind === 'queue') openQueueView(); else renderRows(); } else renderList();
    }
    var q = queueList();
    var sig = q.length + '|' + currentIndex() + '|' + songKey(currentSong()) + '|' + ((g('userPlaylists') || []).length);
    if (sig !== st.sig) {
      var qChanged = st.sig && st.sig.split('|')[0] !== String(q.length);
      st.sig = sig;
      refreshData(true);
      if (st.lv === 2 && st.detail) {
        if (st.detail.kind === 'queue') {
          if (qChanged) renderRows(); else markCurrentRow();
          els.meta.textContent = q.length + ' 首 · 正在播放第 ' + (currentIndex() + 1) + ' 首';
        } else markCurrentRow();
      }
    }
  }
  setInterval(tick, 400);

  window.NBFlatShelf = {
    active: flatActive,
    replacing: function () { return flatActive(); },
    isOpen: function () { return st.open; },
    open: function (tab) { if (flatActive()) setOpen(true, tab); },
    close: function () { setOpen(false); },
    back: back,
    state: function () { return { open: st.open, lv: st.lv, tab: st.tab, focus: st.focus, skin: st.skin, flat: st.flat, detail: st.detail && { kind: st.detail.kind, title: st.detail.title, n: (st.detail.tracks || []).length } }; }
  };
})();
