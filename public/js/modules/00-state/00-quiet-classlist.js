// ============================================================
// [二改][流畅度] classList.add / remove 只在真的有变化时才写 class 属性
// 浏览器规范里，classList.add('已有的类') / remove('没有的类') 也会重写一次 class 属性，
// 每写一次就给所有 MutationObserver 发一条"class 变了"。这个软件里有十几处代码
// （图标遮挡区、主题宿主、顶部灵动岛、Esc 守卫、主页视频……）都在盯 body 的 class，
// 于是定时器里"顺手 remove 一下"就会把它们全部叫醒，其中图标遮挡区还会反过来再 remove 一次，
// 形成每秒 10 次、永不停止的"强制排版 + 全部观察者跑一遍"的空转。
// 这里把 add / remove 改成：类名已经是目标状态就什么都不写。效果和原来完全一样，只是不再空转。
// ============================================================
(function () {
  if (typeof DOMTokenList === 'undefined' || DOMTokenList.prototype.__mineradioQuiet) return;
  var proto = DOMTokenList.prototype;
  var nativeAdd = proto.add;
  var nativeRemove = proto.remove;
  proto.add = function () {
    var missing = [];
    for (var i = 0; i < arguments.length; i++) {
      var token = String(arguments[i]);
      // 非法类名（空串、带空格）交给原生方法照常抛错
      if (!token || /\s/.test(token)) return nativeAdd.apply(this, arguments);
      if (!this.contains(token) && missing.indexOf(token) < 0) missing.push(token);
    }
    if (missing.length) nativeAdd.apply(this, missing);
  };
  proto.remove = function () {
    var present = [];
    for (var i = 0; i < arguments.length; i++) {
      var token = String(arguments[i]);
      if (!token || /\s/.test(token)) return nativeRemove.apply(this, arguments);
      if (this.contains(token) && present.indexOf(token) < 0) present.push(token);
    }
    if (present.length) nativeRemove.apply(this, present);
  };
  Object.defineProperty(proto, '__mineradioQuiet', { value: true });
})();
