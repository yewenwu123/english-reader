# 双语翻转阅读器

一个纯前端的双语翻转阅读工具。粘贴英文或中文文本后，页面会把词语排版成可点击的翻转卡片，背面显示 Google 免费在线翻译结果。

## 重要说明

这个项目使用 Google 免费在线翻译端点：

```text
https://translate.googleapis.com/translate_a/single
```

它不需要 API Key，适合个人学习和轻量使用。但它不是 Google Cloud Translation 的正式付费 API，稳定性和限流策略由 Google 决定。

还有一个很重要的网络点：

- 本地用 `npm start` 运行时，页面会请求本机的 `/api/translate`，再由 Node.js 访问 Google。
- 部署到 GitHub Pages 后，GitHub 只负责托管网页，真正请求 Google 的还是打开网页的浏览器。
- 所以如果你在大陆普通网络下访问 GitHub Pages，页面仍可能无法翻译。
- 要测试 GitHub Pages 版本，需要用能访问 `translate.googleapis.com` 的网络环境。

## 当前版本

- 只使用 Google 在线翻译。
- 不再加载本地 `DICT`、SQLite 词典、`sql.js`、`jieba` 或离线词库。
- 本地运行支持 Node.js 翻译代理。
- GitHub Pages 可静态部署，但浏览器网络必须能访问 Google 翻译端点。

## 本地运行

1. 安装 Node.js：<https://nodejs.org/>

2. 打开 PowerShell，进入项目目录：

```powershell
cd D:\english-reader
```

3. 安装依赖：

```powershell
npm install
```

4. 启动项目：

```powershell
npm start
```

5. 浏览器打开：

```text
http://127.0.0.1:8000/index.html
```

也可以双击 `start-reader.bat` 启动。

## 测试 Google 翻译是否可用

运行：

```powershell
npm test
```

如果成功，会看到类似：

```text
en -> zh-CN: 你好世界
zh-CN -> en: Hello world
Google online translation test passed.
```

如果失败，通常是当前网络无法访问 Google、被限流，或拦截了 `translate.googleapis.com`。

## 部署到 GitHub Pages

### 第 1 步：确认不要上传大文件

`.gitignore` 已经忽略了这些文件：

```text
node_modules/
*.db
*.zip
ecdict.csv
js/stardict*.db
js/dict_full.js
```

这些是旧的离线词典文件，不需要上传 GitHub。

### 第 2 步：初始化 Git 仓库

在项目目录运行：

```powershell
git init
git add .
git commit -m "Use Google online translation only"
```

### 第 3 步：在 GitHub 创建仓库

1. 登录 <https://github.com/>
2. 点击右上角 `+`
3. 选择 `New repository`
4. 仓库名可以填 `english-reader`
5. 选择 `Public`
6. 不要勾选自动创建 README
7. 点击 `Create repository`

### 第 4 步：推送到 GitHub

把下面命令里的 `你的用户名` 换成你的 GitHub 用户名：

```powershell
git branch -M main
git remote add origin https://github.com/你的用户名/english-reader.git
git push -u origin main
```

### 第 5 步：开启 GitHub Pages

1. 打开 GitHub 仓库页面
2. 进入 `Settings`
3. 左侧找到 `Pages`
4. `Source` 选择 `Deploy from a branch`
5. `Branch` 选择 `main`
6. 文件夹选择 `/ root`
7. 点击 `Save`

等待 1 到 3 分钟，GitHub 会生成访问地址，通常是：

```text
https://你的用户名.github.io/english-reader/
```

## 使用方法

1. 选择翻译方向：`英文到中文` 或 `中文到英文`
2. 粘贴文本
3. 点击 `排版`
4. 点击页面里的词语，卡片会翻转显示翻译
5. 可切换 `经典`、`专注`、`卡片` 三种显示风格

## 如果 GitHub Pages 仍然不能翻译

如果页面显示 `翻译中` 后变成 `重试`，说明浏览器没有成功访问 Google 翻译端点。

解决方式：

- 用能访问 Google 的网络测试 GitHub Pages。
- 或者把项目部署到能运行 Node.js 的平台，让 `server.js` 的 `/api/translate` 代理接口也一起运行。
- GitHub Pages 不能运行 Node.js 后端，所以它不能帮你代理 Google 翻译请求。

可选的 Node.js 部署平台包括 Render、Railway、Fly.io、Vercel Serverless 等。

## 关于 Python 翻译库

确实有一些 Python 库可以调用 Google 翻译，但 GitHub Pages 只能托管静态网页，不能运行 Python 后端。为了部署简单，这个项目现在直接在浏览器里请求 Google 免费在线翻译端点；本地运行时则由 Node.js 提供一个简单代理。
