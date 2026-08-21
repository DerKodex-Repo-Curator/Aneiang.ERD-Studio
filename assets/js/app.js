/* ================================================================
   Aneiang ERD Studio · app.js — 应用启动与事件分发
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.VERSION = '1.1.0';   // 应用版本（欢迎页 / 关于 / 更新日志显示，与 CHANGELOG 保持一致）
ERD.app = (function () {

  function onDirty(scope) {
    if (scope === 'move') return;   // 拖动由 render.scheduleMove 处理
    if (scope && scope.type === 'table') { ERD.render.refreshTable(scope.key); return; }
    if (scope && scope.type === 'relation') { ERD.render.refreshRelations(scope); return; }
    ERD.render.renderAll();
    ERD.render.applyFilter();
  }

  function boot() {
    ERD.ui.apply();          // 恢复主题 / 画布背景偏好
    if (ERD.i18n && ERD.i18n.apply) ERD.i18n.apply();   // 应用界面语言
    ERD.render.init();
    ERD.interact.init();
    ERD.editor.init();
    ERD.ctx.init();

    ERD.bus.on('dirty', onDirty);

    /* 首次使用播种示例工程 */
    ERD.store.init(function () { return window.ERD_SAMPLE; });
    /* 从救援保险箱找回 localStorage 缺失的工程 */
    if (ERD.store.vaultRestore) ERD.store.vaultRestore();

    /* 类型候选列表并入自定义类型 */
    if (ERD.types && ERD.types.syncDatalist) ERD.types.syncDatalist();

    /* 分享链接（#e=…）解码后提示打开 */
    if (ERD.io && ERD.io.handleShareHash) ERD.io.handleShareHash();

    /* PWA：注册 Service Worker（需 http(s)，file:// 下跳过） */
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data && e.data.type === 'sw:updated' && ERD.editor && ERD.editor.toast) {
          ERD.editor.toast('应用缓存已就绪，支持离线使用', 'ok');
        }
      });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { scope: './' }).catch(e => console.warn('[SW] 注册失败', e));
      });
    }

    ERD.bus.emit('meta');
    ERD.render.renderAll();
    ERD.render.fit();

    /* 首次使用展示欢迎页（版本 / 特性 / 快速开始 / 开源仓库入口）
       标记 erd.welcome.v1 仅在用户点击「开始使用」时写入（editor.showWelcome），
       因此在点击之前刷新页面会再次显示欢迎页 */
    if (ERD.editor.showWelcome && !document.querySelector('#modal-mask.open')) {
      try {
        if (!localStorage.getItem('erd.welcome.v1')) ERD.editor.showWelcome();
      } catch (e) { /* ignore */ }
    }

    /* 属性面板关闭按钮 */
    document.getElementById('dock-close').onclick = () => ERD.interact.clearSelection();

    /* 空画布快捷入口 */
    const tip = document.getElementById('empty-tip');
    tip.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'newproj') ERD.editor.dlgNewProject();
      else if (act.dataset.act === 'newtable') document.getElementById('btn-newtable').click();
      else if (act.dataset.act === 'import') ERD.editor.dlgImport();
      else if (act.dataset.act === 'sample') ERD.editor.loadSample();
      else if (act.dataset.act === 'open') ERD.io.openLocalFile();
    });
    const tipVer = document.getElementById('tip-ver');
    if (tipVer) tipVer.textContent = 'v' + ERD.VERSION;

    /* 刷新时确保落盘 */
    window.addEventListener('beforeunload', () => ERD.store.persist(true));

    console.log('%c Aneiang ERD Studio %c v' + ERD.VERSION + ' · 纯前端离线 ER 图设计平台 ', 'background:#24365c;color:#dbe7ff;border-radius:3px 0 0 3px', 'background:#161a22;color:#8b93a3;border-radius:0 3px 3px 0');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { boot };
})();
