# Aneiang ERD Studio

**零后端、零依赖**的数据库 ER 图在线设计平台，纯前端运行、完全离线可用。

通过可视化画布创建和编辑数据库实体关系图，导入 SQL DDL 逆向生成表结构，并把图与数据字典导出为多种格式。全部在浏览器本地完成——无需账号、无需服务器、无任何遥测。

> 界面图标全部使用本地内置的字体图标（Remix Icon）。项目**不依赖任何第三方 CDN**，断网 / 内网 / 离线环境完全可用。

[English](README.md) | 简体中文

## 功能特性

- **可视化编辑**：新建 / 编辑 / 删除表与字段（含分组行、PK/FK/UK/IDX 标记、审计六件套一键补充），业务域归组与域颜色，物理外键与逻辑关联
- **快速建模**：表模板（空白 / 标准业务表 / 订单 / 库存 / 用户 / 支付 / 审计日志）、常用字段快捷库、多行粘贴批量加字段、回车连续添加、双击空白快速建表、Ctrl+C / Ctrl+V 复制粘贴表
- **丰富的交互**：画布 / 表卡片 / 字段行 / 连线四级右键菜单；拖拽平移、滚轮缩放、卡片拖动（4px 网格吸附）；点击聚焦表关系；连线模式（点子表 → 点父表）；表 / 字段搜索；60 步撤销重做
- **多工程管理**：新建 / 切换 / 重命名 / 复制 / 删除工程，数据自动保存于浏览器 localStorage
- **主题与画布样式**：六套界面主题（暗夜 / 午夜蓝 / 极简白 / 商务蓝 / 护眼绿 / 羊皮纸）、三种画布背景图案、三种连线样式（曲线 / 直角 / 直线），导出图片与当前主题配色一致
- **自动布局**：按业务域分列自动排列，导入 SQL 后一键整理
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

```bash
docker build -t erd-studio .
docker run -d --name erd-studio -p 8080:80 erd-studio
```

或使用 compose：

```bash
docker compose up -d
```

访问 http://<服务器IP>:8080 。镜像基于 nginx:alpine，仅约 10MB 增量，无任何外部请求。

## 数据存储说明（重要）

本平台**无后端**，所有工程数据自动保存在**当前浏览器**的 localStorage 中：

- 数据与浏览器 profile 绑定，换浏览器 / 换电脑 / 清理浏览器数据不会自动迁移
- 重要工程请定期 **导出 → 工程 JSON** 备份，在新环境中**导入**即可完整恢复
- 内网多人使用时，各自浏览器独立存储，通过 JSON 文件交换协作

## 快捷键

| 按键 | 功能 |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+F` | 聚焦搜索框 |
| `Ctrl+S` | 立即保存到本地 |
| `N` | 新建表（模板弹窗） |
| `Delete` | 删除选中的表 / 关系 |
| `Esc` | 退出连线模式 / 取消选择 |
| `F` / `+` / `-` | 适配窗口 / 放大 / 缩小 |

## 目录结构

```
├── index.html              # 入口（无构建、无依赖，直接可跑）
├── assets/
│   ├── css/
│   │   ├── base.css        # 主题变量 / 布局 / 面板 / 弹窗
│   │   ├── canvas.css      # 画布 / 卡片 / 连线 / 图例
│   │   └── icons.css       # 字体图标（子集）
│   ├── js/
│   │   ├── store.js        # 数据模型 / localStorage / 撤销重做 / 事件总线
│   │   ├── render.js       # 画布渲染（域 / 卡片 / 连线 / 图例）
│   │   ├── interact.js     # 平移缩放 / 拖拽 / 选择 / 连线模式 / 快捷键
│   │   ├── editor.js       # 属性面板 / 弹窗 / 工程与域管理 / 自动布局
│   │   ├── ctxmenu.js      # 右键上下文菜单
│   │   ├── presets.js      # 表模板 / 常用字段库
│   │   ├── io.js           # 导入导出（JSON/SQL/PNG/SVG/Mermaid/XLSX）
│   │   ├── sql.js          # SQL DDL 解析器与多方言生成器（8 种数据库）
│   │   ├── sample.js       # 内置演示工程（电商订单系统 12 表）
│   │   └── app.js          # 启动入口
│   └── fonts/
│       ├── remixicon.woff2 # Remix Icon 字体（本地内置）
│       └── NOTICE.md       # 图标许可说明
├── Dockerfile              # nginx:alpine 容器化部署
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

## 代码仓库

- Gitee：https://gitee.com/aneiangsoft/aneiang.erd-studio
- GitHub：https://github.com/AneiangSoft/Aneiang.ERD-Studio

## 开源许可

- 本项目代码：[MIT License](LICENSE)
- 界面图标：[Remix Icon 4.6.0](https://remixicon.com)（Apache-2.0，已本地内置，见 `assets/fonts/NOTICE.md`）
