try {
  if (localStorage.getItem('mineradio-startup-fast-skip-v1') === '1') {
    document.documentElement.classList.add('startup-fast-skip-preload');
  }
  // DIY 玩家模式已去掉，始终按完整界面预加载
  document.documentElement.classList.add('diy-mode-preload');
} catch (e) {
  document.documentElement.classList.add('diy-mode-preload');
}
