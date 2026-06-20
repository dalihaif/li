# 李氏家谱

纯前端家族族谱管理系统，**数据存储在 GitHub 仓库**（通过 GitHub API 读写），无需自建服务器。部署到 GitHub Pages 后，家人即可在线访问。

![纯前端](https://img.shields.io/badge/纯前端-HTML%2FCSS%2FJS-green) ![GitHub API](https://img.shields.io/badge/数据存储-GitHub%20API-blue) ![隐私](https://img.shields.io/badge/隐私-仓库私有-orange)

---

## ✨ 功能特性

### 🏠 首页 Dashboard
- 家族总人数、男女比例、在世/已故统计
- 最近加入成员展示
- 快捷功能入口（家族树、祭奠堂、导入数据等）

### 👥 成员管理
- 支持完整的成员信息录入：**姓名、性别、生日、逝世日期、字、号、祖籍/郡望、辈分字、民族、学历、职业、电话、地址、个人简介**
- 家族关系管理：**父亲、母亲、配偶**（支持二婚，多配偶记录）
- 头像上传（图片压缩存储）
- 搜索、按性别/在世状态筛选
- 导入 / 导出 JSON 备份

### 🌳 家族树
- **HTML + SVG 树状图**渲染，视觉效果清晰
- 夫妻同框显示（主成员 + 配偶列表合并于同一节点）
- 支持二婚（继配标注）
- 鼠标拖拽平移、滚轮缩放、自适应居中
- 展开 / 收起子树

### 🙏 祭奠堂
- **点蜡烛**（最多 3 支，金色火焰动画）
- **上香**（最多 3 支，烟雾动画）
- **敬酒**（无限累计）
- **上贡品**（最多 5 种：🍎🍵🍶🍰💐）
- 每次操作触发**祝福文字特效**（金色大字动画）
- 累计供奉次数统计

### 📃 其他功能
- **留言板**：家族成员留言记录
- **家训管理**：家族格言、家训条目
- **公告栏**：家族公告发布
- **统计页面**：人数趋势、性别比例、世代分布图表

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | 原生 HTML5 / CSS3 / JavaScript（ES6+） |
| 数据存储 | GitHub 仓库 `data/family.json`（GitHub API 读写） |
| 图表 | Chart.js（统计页面） |
| 架构 | MPA（多页面应用），共享 `common.js + db.js + app.js` |
| 部署 | GitHub Pages（静态页面）+ GitHub API（数据读写） |

**零后端、零数据库** — 数据存在你的 GitHub 仓库里，完全由你掌控。

---

## 📁 文件结构

```
lishi-zupu/
├── index.html          # 首页（统计概览）
├── members.html       # 成员管理
├── tree.html          # 家族树
├── memorial.html      # 祭奠堂
├── messages.html      # 留言板
├── mottos.html      # 家训管理
├── notices.html      # 公告栏
├── stats.html        # 统计分析
├── settings.html      # ⚙️ GitHub 仓库配置
├── css/
│   ├── common.css     # 通用样式（导航栏、弹窗、表单）
│   └── style.css     # 主题样式（家谱配色、卡片、家族树）
├── js/
│   ├── common.js      # 通用工具函数
│   ├── github-api.js  # GitHub API 封装（读写仓库文件）
│   ├── db.js          # 数据层（通过 GitHub API 操作数据）
│   ├── app.js         # 核心应用逻辑（导航、弹窗、统计、导入导出）
│   ├── tree.js        # 家族树渲染引擎（HTML+SVG 树状图）
│   └── memorial.js    # 祭奠堂交互逻辑
└── data/              # （仓库中自动创建）数据存储目录
    └── family.json    # 族谱数据文件
```

---

## 🚀 部署与使用

### 第一步：Fork / 克隆仓库

```bash
git clone https://github.com/dalihaif/lishi-zupu.git
cd lishi-zupu
```

### 第二步：启用 GitHub Pages

1. 进入仓库 **Settings → Pages**
2. Source 选择 `main` 分支，目录选 `/ (root)`
3. 保存后等待 1-2 分钟，获得访问地址：
   ```
   https://dalihaif.github.io/lishi-zupu/
   ```

### 第三步：创建 GitHub Token

1. 打开 [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. 勾选权限：`repo`（完整仓库访问）
3. 生成后**复制 Token**（只显示一次！）

### 第四步：配置仓库信息

1. 打开族谱页面（GitHub Pages 地址）
2. 点击右上角 **⚙️ 设置**
3. 填写：
   - **GitHub 用户名**：你的用户名（如 `dalihaif`）
   - **仓库名称**：`lishi-zupu`
   - **分支**：`main`
   - **Personal Access Token**：刚才复制的 Token
4. 点击 **💾 保存配置** → 点击 **🔍 测试连接**

### 第五步：初始化数据文件

在设置页面点击 **📥 初始化数据文件**，会在仓库中创建 `data/family.json`。

---

## 💾 数据说明

- 所有数据存储在 GitHub 仓库的 `data/family.json` 文件中
- 每次保存 = 一次 Git Commit（可在仓库 Commits 记录中查看修改历史）
- 建议定期使用设置页面的 **📤 导出备份** 功能下载本地备份
- 如需迁移，使用 **📥 导入备份** 功能

### 隐私建议

- 仓库建议设为 **Private**（私有），只有你授权的人能访问
- 如果是私有仓库，GitHub Token 需要 `repo` 权限才能读写数据
- 家人访问时，需要他们各自在浏览器中填写自己的 GitHub Token

---

## 🌐 让家人无需 Token 也能查看

如果你希望家人**只能查看不能编辑**，可以：

1. 将 `db.js` 改为**只读模式**（不保存 Token，只读取数据）
2. 或者部署两个版本：
   - **公开版**（只读，GitHub Pages 自动构建）
   - **管理版**（需 Token，本地运行或单独部署）

---

## 🌐 浏览器兼容性

| 浏览器 | 版本要求 |
|--------|-----------|
| Chrome / Edge | ≥ 60 |
| Firefox | ≥ 55 |
| Safari | ≥ 12 |
| 移动端 | 支持（响应式布局）|

---

## 📜 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.0 | 2026-06 | 改为 GitHub API 存储，支持 GitHub Pages 部署 |
| v1.0 | 2026-06 | 初始版本（IndexedDB 本地存储）|

---

## 📄 License

MIT License — 自由使用、修改和分发。

---

## 🙏 致谢

> 慎终追远，民德归厚矣。  
> ——《论语·学而》

本项目旨在用现代 Web 技术，帮助家族更好地记录和传承族谱文化。

---

*如有问题或建议，欢迎提 Issue。*
