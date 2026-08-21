<div align="center">
  <img src="assets/icons/logo.svg" alt="Aneiang ERD Studio" width="120" height="120">
  <h1>Aneiang ERD Studio</h1>
  <p>
    <strong>零后端 · 零依赖 · 纯前端 · 离线可用</strong>
  </p>
  <p>
    <a href="https://erd.aneiang.com/" target="_blank">
      <img src="https://img.shields.io/badge/🚀_立即体验-在线版-blue?style=for-the-badge" alt="在线体验">
    </a>
    <a href="https://github.com/AneiangSoft/Aneiang.ERD-Studio/stargazers">
      <img src="https://img.shields.io/github/stars/AneiangSoft/Aneiang.ERD-Studio?style=flat-square&logo=github&color=blue" alt="GitHub Stars">
    </a>
    <a href="https://github.com/AneiangSoft/Aneiang.ERD-Studio/issues">
      <img src="https://img.shields.io/github/issues/AneiangSoft/Aneiang.ERD-Studio?style=flat-square&logo=github&color=orange" alt="GitHub Issues">
    </a>
    <a href="https://github.com/AneiangSoft/Aneiang.ERD-Studio/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
    </a>
    <img src="https://img.shields.io/badge/zero--dependency-yes-brightgreen?style=flat-square" alt="Zero Dependency">
    <img src="https://img.shields.io/badge/PWA-ready-5a0fc8?style=flat-square&logo=pwa" alt="PWA Ready">
  </p>
  <p>
    <a href="#快速开始">快速开始</a> ·
    <a href="#功能特性">功能特性</a> ·
    <a href="#界面预览">界面预览</a> ·
    <a href="#常见问题faq">FAQ</a> ·
    <a href="#参与贡献">参与贡献</a>
  </p>
</div>

通过可视化画布创建和编辑数据库实体关系图，导入 SQL DDL 逆向生成表结构，并把图与数据字典导出为多种格式。全部在浏览器本地完成——无需账号、无需服务器、无任何遥测。

> 界面图标全部使用本地内置的字体图标（Remix Icon）。项目**不依赖任何第三方 CDN**，断网 / 内网 / 离线环境完全可用。

[English](README.md) | 简体中文

---

## ✨ 核心亮点

| 特性 | 说明 |
| --- | --- |
| 🚀 **零部署** | 双击 `index.html` 即用，无需 Node、无需 npm、无需构建 |
| 🔒 **数据私有** | 全部数据存于浏览器本地，不上传任何服务器，无遥测 |
| 📴 **完全离线** | 零外部请求，内网 / 断网 / 离线环境均可使用 |
| 🎨 **6 套主题** | 暗夜 / 午夜蓝 / 极简白 / 商务蓝 / 护眼绿 / 羊皮纸 |
| 💾 **8 种 SQL 方言** | PostgreSQL / MySQL / MariaDB / SQLite / SQL Server / Oracle / 达梦 / 人大金仓 |
| 📦 **6 种导出格式** | 工程 JSON / SQL / PNG / SVG / Mermaid / Excel 数据字典 |
| ⌨️ **高效操作** | 快捷键、右键菜单、拖拽连线、批量对齐、自动布局 |
| 📱 **PWA 支持** | 可安装为桌面应用，离线启动，秒开体验 |

## 界面预览

![主界面 - 画布总览](docs/index.png)

![表详情 - 字段编辑与关系面板](docs/table_detail.png)

## 功能特性

- **可视化编辑**：新建 / 编辑 / 删除表与字段（含分组行、PK/FK/UK/IDX 标记、审计六件套一键补充），业务域归组与域颜色，物理外键与逻辑关联
- **快速建模**：表模板（空白 / 标准业务表 / 订单 / 库存 / 用户 / 支付 / 审计日志）、常用字段快捷库、多行粘贴批量加字段、回车连续添加、双击空白快速建表、Ctrl+C / Ctrl+V 复制粘贴表
- **丰富的交互**：画布 / 表卡片 / 字段行 / 连线四级右键菜单；拖拽平移、滚轮缩放、卡片拖动（4px 网格吸附）；点击聚焦表关系；连线模式（点子表 → 点父表）；表 / 字段搜索；60 步撤销重做
- **多选与批量操作**：`Ctrl/Cmd+点击` 多选、`Shift+拖拽` 框选；多选表可整体拖动，右键一键折叠 / 展开、**对齐与等距分布**、移动到业务域、批量删除
- **迷你地图**：左下角缩略图实时预览整体布局与当前视口，点击 / 拖动即可跳转
- **多工程管理**：新建 / 切换 / 重命名 / 复制 / 删除工程，数据自动保存于浏览器 localStorage，并有 IndexedDB 救援镜像兜底
- **主题与画布样式**：六套界面主题（暗夜 / 午夜蓝 / 极简白 / 商务蓝 / 护眼绿 / 羊皮纸）、三种画布背景图案、三种连线样式（曲线 / 直角 / 直线），导出图片与当前主题配色一致
- **自动布局**：按业务域分列自动排列，导入 SQL 后一键整理
- **PWA / 本地文件 / 分享**：支持安装为 PWA 离线使用；「文件」菜单打开 / 保存本地 `.erd` 文件（Ctrl+S 同步）；一键生成分享链接（URL 编码）供跨端载入；类型库可自定义常用字段类型
- **多语言**：纯前端双语界面（简体中文 / English），工具菜单一键切换
- **内置示例**：通用电商订单系统数据库设计（12 表 / 4 域 / 11 外键 / 3 逻辑关联），无任何真实业务信息

### 导入

| 格式 | 说明 |
| --- | --- |
| 工程 JSON | 本平台导出的工程文件，可整工程打开或合并进当前工程 |
| SQL DDL | `CREATE TABLE` 脚本（PostgreSQL / MySQL 通用，兼容引号、反引号、方括号标识符与 schema 前缀），解析字段、类型、主键、唯一键、索引、内联 / ALTER 外键、字段注释（`COMMENT ON COLUMN` / MySQL `COMMENT`） |

### 导出

| 格式 | 说明 |
| --- | --- |
| 工程 JSON | 完整工程数据（备份 / 迁移 / 协作交换） |
| SQL · 8 种方言 | PostgreSQL / MySQL / MariaDB / SQLite / SQL Server / Oracle / 达梦 DM / 人大金仓 KingbaseES，自动做类型映射与自增主键适配 |
| PNG / SVG | 2 倍分辨率位图 / 无损矢量图，与当前主题配色一致 |
| Mermaid `.mmd` | 可在 mermaid.live、Typora、支持 Mermaid 的 Markdown 中渲染 |
| Excel `.xlsx` | 数据字典 4 个 Sheet：总览 / 表清单 / 字段明细 / 关系（零依赖生成） |

## 🎯 适用场景

- **数据库设计评审**：快速绘制 ER 图，导出 PNG/SVG 用于方案文档与评审会议
- **遗留系统逆向**：导入现有 SQL DDL，一键生成可视化结构图，辅助理解与重构
- **内网 / 涉密环境**：零外部请求、纯前端运行，可在内网与隔离环境安全使用
- **教学与学习**：内置电商示例工程，帮助理解表关系、主键外键、范式设计
- **个人开发者**：PWA 安装到桌面，随时打开画草图，无需登录、无广告
- **团队协作**：通过 JSON 文件或分享链接交换设计稿，各自浏览器独立存储

## 🆚 同类工具对比

| 特性 | Aneiang ERD Studio | dbdiagram.io | drawSQL | Navicat |
| --- | --- | --- | --- | --- |
| 开源 | ✅ MIT | ❌ 商业 | ❌ 商业 | ❌ 商业 |
| 离线可用 | ✅ 完全离线 | ❌ 需联网 | ❌ 需联网 | ✅ 桌面端 |
| 零部署 | ✅ 双击即用 | ❌ 需注册 | ❌ 需注册 | ❌ 安装软件 |
| 数据隐私 | ✅ 本地存储 | ❌ 云端存储 | ❌ 云端存储 | ✅ 本地 |
| 价格 | 免费 | 付费 / 免费版受限 | 付费 / 免费版受限 | 付费 |
| SQL 导入导出 | ✅ 8 种方言 | ✅ 有限 | ✅ 有限 | ✅ 全面 |
| 可视化画布 | ✅ 拖拽 + 自动布局 | ❌ 代码驱动 | ✅ 拖拽 | ✅ 拖拽 |
| PWA 安装 | ✅ | ❌ | ❌ | ❌ |
| 多主题 | ✅ 6 套 | ❌ | ❌ | ✅ 有限 |

> 注：以上对比基于公开信息整理，如有出入欢迎提 Issue 修正。

## 典型使用流程

1. **建表**：按 `N` 或顶部「新建表」，从模板开始（标准业务表 / 订单 / 用户 / 支付…）
2. **加字段**：右侧面板用「常用字段」一键追加，或粘贴多行文本批量建字段；`Enter` 在下方插入新行
3. **建关系**：按住表卡片右下角圆点拖到目标表，或按 `C` 进入连线模式（可连续创建），或右侧「关系」区点「新建」
   - 子表缺少外键字段时，选「自动创建 `xxx_id`」即可一键补列
4. **整理**：按业务域「自动布局」，多选表右键可对齐 / 等距分布 / 批量折叠
5. **导入 / 导出**：导入已有 SQL DDL 逆向生成；导出 SQL（8 种方言）/ PNG / SVG / Mermaid / Excel 数据字典

## 🚀 在线体验

直接访问官方站点即可使用，无需安装：

👉 **[https://erd.aneiang.com/](https://erd.aneiang.com/)**

- 纯前端运行，数据保存在你的浏览器本地
- 支持 PWA 安装到桌面，离线可用
- 与 GitHub 版本同步更新

## 快速开始

### 方式一：直接打开（零部署）

双击 `index.html` 即可在浏览器中使用（推荐 Chrome / Edge）。

### 方式二：本地静态服务

```bash
# Python
python -m http.server 8080

# 或 Node
npx serve .
```

访问 http://localhost:8080

### 方式三：Docker 私有化部署（推荐内网使用）

#### 直接拉取官方镜像（推荐）

```bash
docker run -d --name erd-studio -p 8080:80 --restart unless-stopped caco/aneiang-erd-studio:latest
```

或使用 docker compose：

```bash
docker compose up -d
```

访问 http://<服务器IP>:8080 。镜像基于 nginx:alpine，仅约 10MB 增量，无任何外部请求。

#### 自行构建镜像

```bash
docker build -t erd-studio .
docker run -d --name erd-studio -p 8080:80 erd-studio
```

多架构（x86_64 / arm64）构建，需 Docker Buildx：

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t erd-studio:latest --push .
```

## 数据存储说明（重要）

本平台**无后端**，所有工程数据自动保存在**当前浏览器**的 localStorage 中：

- 数据与浏览器 profile 绑定，换浏览器 / 换电脑 / 清理浏览器数据不会自动迁移
- 重要工程请定期 **导出 → 工程 JSON** 备份，在新环境中**导入**即可完整恢复
- 每次保存都会把工程镜像到 **IndexedDB 救援保险箱**：若 localStorage 意外被清空或写入失败，重新打开时会自动找回缺失工程
- 内网多人使用时，各自浏览器独立存储，通过 JSON 文件交换协作

## 快捷键

| 按键 | 功能 |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+F` | 聚焦搜索框 |
| `Ctrl+S` | 立即保存到本地（关联本地文件时同步写文件） |
| `Ctrl/Cmd+点击` | 多选 / 取消选择表 |
| `Shift+拖拽` | 框选矩形区域内的表 |
| `N` | 新建表（模板弹窗） |
| `C` | 开关连线模式 |
| `Delete` | 删除选中的表 / 关系 |
| `Esc` | 退出连线模式 / 取消选择 |
| `F` / `+` / `-` | 适配窗口 / 放大 / 缩小 |

## 目录结构

```
├── index.html              # 入口（无构建、无依赖，直接可跑）
├── manifest.webmanifest    # PWA 应用清单（可安装 / 离线）
├── sw.js                   # Service Worker（离线缓存 + 更新）
├── assets/
│   ├── css/
│   │   ├── base.css        # 主题变量 / 布局 / 面板 / 弹窗
│   │   ├── canvas.css      # 画布 / 卡片 / 连线 / 图例 / 迷你地图
│   │   └── icons.css       # 字体图标（本地子集）
│   ├── js/
│   │   ├── store.js        # 数据模型 / localStorage + IndexedDB 救援 / 撤销重做 / 事件总线
│   │   ├── i18n.js         # 纯前端多语言（中 / 英）
│   │   ├── render.js       # 画布渲染（域 / 卡片 / 连线 / 图例 / 迷你地图）
│   │   ├── interact.js     # 平移缩放 / 拖拽 / 多选 / 框选 / 连线模式 / 快捷键
│   │   ├── editor.js       # 属性面板 / 弹窗 / 工程与域管理 / 自动布局
│   │   ├── ctxmenu.js      # 右键上下文菜单（含批量对齐分布）
│   │   ├── presets.js      # 表模板 / 常用字段库
│   │   ├── io.js           # 导入导出 + 本地文件读写 + 分享链接
│   │   ├── sql.js          # SQL DDL 解析器与多方言生成器（8 种数据库）
│   │   ├── sample.js       # 内置演示工程（电商订单系统 12 表）
│   │   └── app.js          # 启动入口
│   ├── icons/              # PWA / 桌面图标（SVG，本地内置）
│   └── fonts/
│       ├── remixicon.woff2 # Remix Icon 字体（本地内置）
│       └── NOTICE.md       # 图标许可说明
├── build/                  # 发布构建（混淆 + 压缩 + 校验 + Lint 配置）
├── test/                   # 冒烟测试（Node 运行，无 DOM）
├── Dockerfile              # nginx:alpine 容器化部署（使用 dist 混淆产物）
├── docker-compose.yml
├── nginx.conf
├── LICENSE                 # MIT
├── README.md
└── README.zh-CN.md
```

## 技术说明

- 零依赖、零构建：原生 HTML/CSS/JS，无框架、无 npm、无运行时外部请求
- xlsx 导出为内置最小化实现（ZIP STORE + OOXML），无第三方库
- PNG 导出基于 SVG 序列化 + Canvas 光栅化，全部在浏览器本地完成

## 常见问题（FAQ）

**数据存在哪里？会丢吗？**
所有工程数据保存在当前浏览器的 localStorage，另有 IndexedDB 救援镜像兜底。清理浏览器数据或更换浏览器/电脑会清空，重要工程请定期「导出 → 工程 JSON」备份。

**如何迁移到另一台电脑 / 与同事协作？**
「导出 → 工程 JSON」得到备份文件，新环境「导入」即可完整恢复；也可用「复制分享链接」把工程编码进 URL 传给对方直接打开。内网多人各自浏览器独立存储，通过 JSON 文件交换协作。

**支持哪些数据库？**
导入解析 PostgreSQL / MySQL 通用 DDL；导出支持 PostgreSQL / MySQL / MariaDB / SQLite / SQL Server / Oracle / 达梦 DM / 人大金仓 KingbaseES 共 8 种方言，自动做类型映射与自增主键适配。

**能离线使用吗？**
可以。纯前端、零依赖、零外部请求，断网 / 内网 / 离线完全可用；在 HTTPS 或 localhost 环境下还可安装为 PWA 离线使用。

**为什么没有账号 / 云端同步？**
项目定位「零后端、数据完全私有」，不上传任何数据、无遥测。需要多端同步时用 JSON 文件或分享链接自行流转。

## 浏览器兼容性

推荐使用 Chrome / Edge 最新版；纯原生实现，Firefox / Safari 亦可运行。PWA 安装能力需 HTTPS 或 localhost 环境。

## 🗺️ 路线图

以下为规划中的功能方向，欢迎提 Issue 讨论优先级或参与贡献：

- [ ] **视图 / 存储过程**：支持视图与存储过程的建模与导出
- [ ] **数据库直连**：通过后端代理连接真实数据库，实时同步结构
- [ ] **版本对比**：两个工程 / 两个版本的结构差异对比
- [ ] **团队协作**：基于 CRDT 的多人实时协同编辑
- [ ] **更多数据库方言**：TiDB、OceanBase、PolarDB 等国产数据库适配
- [ ] **插件系统**：自定义字段类型、自定义导出格式
- [ ] **移动端适配**：平板 / 手机端的画布交互优化

> 路线图会根据社区反馈动态调整，已完成的功能会移至「功能特性」章节。

## 致谢

- 界面图标：[Remix Icon](https://remixicon.com)（Apache-2.0，已本地内置）
- 内置示例为虚构的电商订单系统，不包含任何真实业务信息

## 参与贡献

欢迎参与 Aneiang ERD Studio 的开源共建，任何反馈、建议与代码贡献都非常欢迎。

- **提 Issue / 建议**：在 [GitHub Issues](https://github.com/AneiangSoft/Aneiang.ERD-Studio/issues) 提交，说明使用场景与复现步骤
- **提交代码**：Fork 仓库 → 新建分支 → 修改 → 发起 Pull Request
- **翻译**：项目为纯前端中 / 英双语，新增界面文案请同时提供两种语言

开发约定：

- 原生 HTML/CSS/JS，零依赖、零构建
- 修改后请运行 `node test/smoke.test.js` 冒烟测试
- 项目以 [MIT License](LICENSE) 开源

## 💖 支持项目

如果 Aneiang ERD Studio 对你有帮助，可以通过以下方式支持：

- ⭐ **点个 Star**：在 [GitHub](https://github.com/AneiangSoft/Aneiang.ERD-Studio) 上点星，让更多人发现这个项目
- 🐛 **反馈问题**：遇到 Bug 或有改进建议，欢迎提 [Issue](https://github.com/AneiangSoft/Aneiang.ERD-Studio/issues)
- 🌐 **分享推荐**：分享给同事朋友，或在博客 / 社交媒体上推荐
- 🌍 **贡献翻译**：帮助完善多语言界面文案
- 💻 **提交代码**：修复 Bug、实现新功能，发起 Pull Request

每一份支持都是项目持续迭代的动力，感谢每一位贡献者！

## 代码仓库

- Gitee：https://gitee.com/aneiangsoft/aneiang.erd-studio
- GitHub：https://github.com/AneiangSoft/Aneiang.ERD-Studio

## 开源许可

- 本项目代码：[MIT License](LICENSE)
- 界面图标：[Remix Icon 4.6.0](https://remixicon.com)（Apache-2.0，已本地内置，见 `assets/fonts/NOTICE.md`）
