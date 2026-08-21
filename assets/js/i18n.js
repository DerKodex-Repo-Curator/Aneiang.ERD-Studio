/* ================================================================
   Aneiang ERD Studio · i18n.js — 纯前端多语言（简体中文 / English）
   用法：window._t('中文', 'English')；语言持久化于 localStorage(erd.lang)
   切换语言后调用 ERD.i18n.set('en'/'zh')，或直接刷新页面
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.i18n = (function () {
  const KEY = 'erd.lang';
  const LANGS = [
    { key: 'zh', label: '简体中文' },
    { key: 'en', label: 'English' }
  ];
  let lang = 'zh';
  try { const v = localStorage.getItem(KEY); if (v === 'zh' || v === 'en') lang = v; } catch (e) { /* ignore */ }

  /* 双语取词：en 为空时回退中文 */
  function t(zh, en) { return lang === 'en' ? (en || zh) : zh; }

  /* 应用 HTML 中 [data-i18n] 元素（data-i18n-zh / data-i18n-en / data-i18n-attr） */
  function apply() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const zh = el.getAttribute('data-i18n-zh');
      const en = el.getAttribute('data-i18n-en');
      const text = lang === 'en' ? (en || zh) : zh;
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, text);
      else el.textContent = text;
    });
  }

  function set(l) {
    if (l !== 'zh' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
    apply();
    /* 动态 UI 文案由 JS 生成，直接刷新以统一语言 */
    if (typeof location !== 'undefined') location.reload();
  }

  return { t, get: () => lang, set, apply, LANGS };
})();
window._t = ERD.i18n.t;
