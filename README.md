# 小厨师餐厅 · Little Chef

一个面向儿童英语启蒙的餐厅经营 Web 游戏。玩家可以听英语订单、寻找食材、完成烹饪、上菜收银，并在游戏过程中收集英语单词。

项目基于 **Phaser 3 + TypeScript + Vite**，可独立运行和构建，无需 Flutter、后端服务或 Kidsbox 应用。

## 游戏特色

- **完整的餐厅经营流程**：客人进店、柜台点餐、安排入座、制作菜品、上菜、评价、付款和离店。
- **3 道可制作菜谱**：番茄鸡蛋面、披萨和水果沙拉，每道菜都有独立的食材与操作步骤。
- **互动式后厨**：点击走位、A* 网格寻路、按顺序取食材、切配、煮面、烘烤和上菜。
- **英语启蒙设计**：英语点餐与用餐评价、操作提示，以及可重复播放的 12 个单词收集册。
- **生动的视听反馈**：人物与食材动画、火焰和气泡、金币飞行动画、背景音乐与合成提示音。
- **本地进度保存**：金币、已学单词和声音设置保存在浏览器 `localStorage` 中，无需登录。
- **横屏自适应**：采用 4:3 等比缩放，适配 iPad 与手机横屏，小屏按钮保持至少 44px 触控尺寸。
- **可访问操作**：弹窗支持焦点管理，冰箱、单词本和重置弹窗可用 Escape 关闭；主要游戏步骤提供键盘按钮，并响应减少动态效果设置。
- **纯前端部署**：构建产物为静态文件，可部署到常见静态网站托管服务。

## 菜谱

| 菜谱 | 食材 | 主要操作 | 售价 |
| --- | --- | --- | --- |
| 番茄鸡蛋面 | 番茄、鸡蛋、面条 | 番茄切块，全部食材入锅后煮面 | 30 金币 |
| 披萨 | 面包底、番茄、芝士 | 番茄和芝士切配，放入烤箱烘烤 | 30 金币 |
| 水果沙拉 | 苹果、香蕉、葡萄 | 苹果和香蕉切块，全部食材装入沙拉碗 | 25 金币 |

## 快速开始

### 环境要求

- 推荐使用 **Node.js 22.12 或更高版本**
- npm 10 或兼容版本

### 安装与运行

```bash
git clone https://github.com/eaaajay/little_chef.git
cd little_chef
npm ci
npm run dev
```

打开终端中显示的地址，默认为 <http://localhost:5173>。

如需指定端口：

```bash
npm run dev -- --port 4173
```

## 如何游玩

1. 点击 **「开门营业」**，首次点击也会解锁浏览器音频。
2. 等客人走到柜台后点击客人，查看并收听英语订单，再点击 **「接单，开始做菜」**。
3. 点击发光的冰箱，按照订单顺序点选食材，也可以将食材拖到房间中。
4. 点击刀架完成切配；需要加热的菜，再点击燃气灶或烤箱。
5. 菜品完成后，点击这位客人对应的餐桌上菜。送错餐桌不会结算订单。
6. 客人用餐、评价并付款后，金币会自动计入顶部钱包。
7. 点击顶部 **「ABC」** 查看单词本，点击已收集的单词卡片可再次播放发音。

键盘用户可以按 Tab 找到当前可用的餐厅操作按钮；弹窗内使用 Tab 切换控件，冰箱、单词本和重置弹窗可按 Escape 关闭。

新存档包含 100 金币。重新开始会清空当前订单、金币和单词本，但保留声音设置。

### 调试参数

可通过 URL 查询参数指定第一位客人的菜谱和进店延迟：

```text
http://localhost:5173/?recipe=pizza&delay=0
```

| 参数 | 可选值 | 说明 |
| --- | --- | --- |
| `recipe` | `tomato_egg_noodles`、`pizza`、`fruit_salad` | 指定第一道菜；省略时随机选择 |
| `delay` | 非负整数，单位毫秒 | 第一位客人的进店延迟，默认 500ms |

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 游戏场景与动画 | Phaser 3.90 |
| 开发语言 | TypeScript 5.9 |
| 构建与开发服务器 | Vite 7 |
| 界面 | HTML、CSS |
| 语音与音效 | Web Speech API、Web Audio API、HTML Audio |
| 本地存档 | Browser `localStorage` |
| 单元测试 | Vitest |
| 端到端测试 | Playwright + Edge、Chromium、WebKit |

Phaser 负责游戏世界、人物和动画；订单规则、寻路与钱包保持为独立 TypeScript 模块，HUD、弹窗和单词本使用 HTML/CSS 实现。

## 测试与构建

```bash
# 运行订单状态机、存档、防重复付款、切配与寻路单元测试
npm test

# TypeScript 类型检查并生成生产构建
npm run build

# 首次运行跨浏览器测试前安装 Chromium 和 WebKit
npx playwright install chromium webkit

# 本机运行 Edge、Chromium、WebKit 全部端到端测试
npm run test:e2e

# 也可以单独运行一个浏览器
npm run test:e2e:edge
npm run test:e2e:chromium
npm run test:e2e:webkit

# 本地预览生产构建
npm run preview
```

端到端测试自动启动 `4173` 端口的开发服务器。本机测试使用 Microsoft Edge、Chromium 和 WebKit；CI 使用 Chromium 和 WebKit。测试覆盖三道菜完整订单、错误操作、钱包持久化、音频降级、后台暂停恢复、键盘与焦点管理，以及手机/iPad 横屏触控布局；截图输出到已被 Git 忽略的 `artifacts/` 目录。

GitHub Actions 配置位于 `.github/workflows/ci.yml`，每次推送到 `main` 或创建 Pull Request 时都会执行单元测试、生产构建和跨浏览器验收。

## 项目结构

```text
little_chef/
├── .github/workflows/ci.yml           # 单元测试、构建与跨浏览器 CI
├── index.html                         # 页面入口、HUD 与弹窗
├── public/
│   ├── assets/                        # 图片、音频等独立运行素材
│   └── manifest.webmanifest           # Web App manifest
├── src/
│   ├── main.ts                        # Phaser 与界面入口
│   ├── restaurantScene.ts             # 餐厅场景、角色行为和动画
│   ├── data.ts                        # 菜谱、食材、人物、点位和单词数据
│   ├── logic.ts                       # 纯订单状态机
│   ├── store.ts                       # 钱包、待付款订单和单词存档
│   ├── pathfinding.ts                 # A* 网格寻路
│   ├── audio.ts                       # 语音、音乐、音效和音频解锁
│   ├── ui.ts                          # HTML 界面与食材拖放
│   └── style.css                      # 水彩纸卡风响应式样式
├── tests/                             # Vitest 与 Playwright 测试
├── scripts/                           # 可选素材导入与生成脚本
├── artwork/counter/                   # 柜台装饰的 SVG 源文件
└── vite.config.ts                     # 构建与 Phaser 分包配置
```

## 部署

执行 `npm run build` 后，将 `dist/` 目录中的全部内容部署到静态网站服务器即可。

当前图片、音频和 manifest 使用以 `/` 开头的根路径，因此应部署在**域名根目录**。项目不是 `file://` 双击运行模式，也未提供 Service Worker 或离线缓存能力。

## 素材维护

`public/assets/` 已包含运行所需的图片和声音，日常启动、测试与构建不需要访问 Kidsbox。

仅在需要重新导入原始素材时运行：

```bash
# 需要 Python 3、Pillow 和 FFmpeg
KIDSBOX_SOURCE=/path/to/kidsbox python3 scripts/prepare_assets.py
```

柜台和厨房素材可通过本地脚本重新生成：

```bash
# 生成脚本使用本机 Microsoft Edge 渲染，并需要带 Pillow 的 Python 3
node scripts/generate_counter_assets.mjs
node scripts/generate_kitchen_assets.mjs
```

> **素材说明**：部分素材来自 Kidsbox，沿用原项目的家庭自用约定。本仓库不额外声明这些素材的授权；如需公开分发或商用，请先确认相应素材的使用权限。

## 数据与 Kidsbox 的关系

这是一个独立 Web 游戏，使用独立的 `localStorage` 存档，**不会同步 Kidsbox 的金币、单词本或家长设置**。Flutter、SQLite、NAS 和后端接口均不是运行依赖。

当前按单标签页游玩设计，不支持多个标签页同时营业时的实时存档合并。点餐、单词和评价语音由设备系统 TTS 生成，实际音色取决于浏览器和操作系统；不支持语音合成的浏览器会静默跳过语音，不影响游戏流程。
