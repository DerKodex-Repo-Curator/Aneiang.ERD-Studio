/* ================================================================
   Aneiang ERD Studio · app.js — 应用启动与事件分发
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.app = (function () {

  function onDirty(scope) {
    if (scope === 'move') return;   // 拖动由 render.scheduleMove 处理
    ERD.render.renderAll();
    ERD.render.applyFilter();
  }

  function boot() {
    ERD.ui.apply();          // 恢复主题 / 画布背景偏好
    ERD.render.init();
    ERD.interact.init();
    ERD.editor.init();
    ERD.ctx.init();

    ERD.bus.on('dirty', onDirty);

    /* 首次使用播种示例工程 */
    ERD.store.init(function () { return window.ERD_SAMPLE; });

    ERD.bus.emit('meta');
    ERD.render.renderAll();
    ERD.render.fit();

    /* 属性面板关闭按钮 */
    document.getElementById('dock-close').onclick = () => ERD.interact.clearSelection();

    /* 空画布快捷入口 */
    const tip = document.getElementById('empty-tip');
    tip.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'newtable') document.getElementById('btn-newtable').click();
      else if (act.dataset.act === 'import') ERD.editor.dlgImport();
      else if (act.dataset.act === 'sample') ERD.editor.loadSample();
    });

    /* 刷新时确保落盘 */
    window.addEventListener('beforeunload', () => ERD.store.persist(true));

    console.log('%c Aneiang ERD Studio %c v1.0 · 纯前端离线 ER 图设计平台 ', 'background:#24365c;color:#dbe7ff;border-radius:3px 0 0 3px', 'background:#161a22;color:#8b93a3;border-radius:0 3px 3px 0');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { boot };
})();
