/* ================================================================
   Aneiang ERD Studio · build.js — 发布构建：混淆 + 压缩 + 文件名随机化
   用法：node build.js
   输出：../dist/（index.html + assets，结构与源码一致，可直接部署）
   ================================================================ */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');
const { minify } = require('html-minifier-terser');

/* ---------- 可调配置 ---------- */
const CONFIG = {
  /* 域名锁：填入部署域名/IP 后，代码只能在对应站点运行（留空 = 不启用）
     例：['192.168.1.100', 'erd.example.com'] */
  DOMAIN_LOCK: [],
  /* 反调试：阻止打开 DevTools 调试（个别浏览器可能误伤，问题可关） */
  DEBUG_PROTECTION: false,
  /* 混淆强度：'light' 体积小速度快 / 'strong' 保护强 */
  LEVEL: 'strong'
};

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const rnd = n => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const kb = n => (n / 1024).toFixed(1) + ' KB';

/* ---------- 混淆选项 ----------
   renameGlobals/renameProperties/transformObjectKeys 必须为 false：
   ERD 命名空间跨文件共享，且属性名与 localStorage 持久化 JSON 一致 */
function obfOptions() {
  const common = {
    compact: true,
    simplify: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    renameProperties: false,
    transformObjectKeys: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    splitStrings: true,
    splitStringsChunkLength: 8,
    unicodeEscapeSequence: false,
    selfDefending: true,
    sourceMap: false,
    domainLock: CONFIG.DOMAIN_LOCK,
    debugProtection: CONFIG.DEBUG_PROTECTION
  };
  if (CONFIG.LEVEL === 'light') return Object.assign(common, {
    controlFlowFlattening: false,
    deadCodeInjection: false
  });
  return Object.assign(common, {
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    numbersToExpressions: true
  });
}

/* ---------- 主流程 ---------- */
async function main() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  fs.mkdirSync(path.join(DIST, 'assets', 'js'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'assets', 'css'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'assets', 'fonts'), { recursive: true });

  const manifest = { js: {}, css: {}, generatedAt: new Date().toISOString() };
  const sizes = { jsSrc: 0, jsOut: 0, cssSrc: 0, cssOut: 0 };

  /* 字体等二进制资源原样拷贝 */
  const fontSrc = path.join(ROOT, 'assets', 'fonts');
  if (fs.existsSync(fontSrc)) {
    fs.readdirSync(fontSrc).forEach(f => {
      fs.copyFileSync(path.join(fontSrc, f), path.join(DIST, 'assets', 'fonts', f));
    });
  }

  /* 图标（PWA manifest / favicon 使用）原样拷贝 */
  const iconSrc = path.join(ROOT, 'assets', 'icons');
  if (fs.existsSync(iconSrc)) {
    fs.mkdirSync(path.join(DIST, 'assets', 'icons'), { recursive: true });
    fs.readdirSync(iconSrc).forEach(f => {
      fs.copyFileSync(path.join(iconSrc, f), path.join(DIST, 'assets', 'icons', f));
    });
  }

  /* PWA：manifest 原样拷贝；sw.js 注入构建时间戳作为缓存版本（防止发布后用户拿到旧缓存） */
  fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));
  let swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  swSrc = swSrc.replace(/const CACHE = '[^']*';/, "const CACHE = 'erd-studio-" + Date.now() + "';");
  fs.writeFileSync(path.join(DIST, 'sw.js'), swSrc);

  /* JS：逐文件混淆，输出文件名随机化 */
  const jsDir = path.join(ROOT, 'assets', 'js');
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  for (const f of jsFiles) {
    const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
    sizes.jsSrc += Buffer.byteLength(src);
    const out = JavaScriptObfuscator.obfuscate(src, obfOptions()).getObfuscatedCode();
    const name = rnd(8) + '.js';
    fs.writeFileSync(path.join(DIST, 'assets', 'js', name), out);
    manifest.js[f] = name;
    sizes.jsOut += Buffer.byteLength(out);
  }

  /* CSS：压缩，输出文件名随机化 */
  const cssDir = path.join(ROOT, 'assets', 'css');
  const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
  for (const f of cssFiles) {
    const src = fs.readFileSync(path.join(cssDir, f), 'utf8');
    sizes.cssSrc += Buffer.byteLength(src);
    const out = new CleanCSS({ level: 2 }).minify(src).styles;
    const name = rnd(8) + '.css';
    fs.writeFileSync(path.join(DIST, 'assets', 'css', name), out);
    manifest.css[f] = name;
    sizes.cssOut += Buffer.byteLength(out);
  }

  /* HTML：重写资源引用为随机名 + 压缩 */
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  cssFiles.forEach(f => {
    html = html.split('assets/css/' + f).join('assets/css/' + manifest.css[f]);
  });
  jsFiles.forEach(f => {
    html = html.split('assets/js/' + f).join('assets/js/' + manifest.js[f]);
  });
  html = html.replace('<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- Aneiang ERD Studio · 版权所有 · 未授权复制/逆向均属侵权 -->');
  const minHtml = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: false,
    minifyCSS: false,
    keepClosingSlash: true
  });
  fs.writeFileSync(path.join(DIST, 'index.html'), minHtml);

  /* 混淆映射（仅留在本地构建目录，勿随 dist 发布） */
  fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('构建完成 → dist/');
  console.log('  JS   ' + kb(sizes.jsSrc) + ' → ' + kb(sizes.jsOut) +
    '  (' + jsFiles.length + ' 个文件，文件名已随机化)');
  console.log('  CSS  ' + kb(sizes.cssSrc) + ' → ' + kb(sizes.cssOut) +
    '  (' + cssFiles.length + ' 个文件)');
  console.log('  域名锁: ' + (CONFIG.DOMAIN_LOCK.length ? CONFIG.DOMAIN_LOCK.join(', ') : '未启用'));
  console.log('  反调试: ' + (CONFIG.DEBUG_PROTECTION ? '开' : '关') +
    '  |  混淆强度: ' + CONFIG.LEVEL);
  console.log('部署：将 dist/ 目录整体放到任意静态服务器即可');
}

main().catch(e => { console.error('构建失败:', e); process.exit(1); });
