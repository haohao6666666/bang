# 运行说明

## 直接体验

打开 https://zhitu.124-156-163-245.sslip.io/ 即可使用，不需要安装或连接电脑所在的 Wi-Fi。

iPhone 使用 Safari 打开后，可从分享菜单选择“添加到主屏幕”。重新体验互动教程： https://zhitu.124-156-163-245.sslip.io/?tutorial=1 。教程保留现有记录，按实际操作逐步高亮功能。

## 本地开发

环境：Node.js 24、npm。仓库根目录就是应用根目录。

```bash
git clone https://github.com/haohao6666666/bang.git
cd bang
npm ci
npm run dev
```

打开 http://127.0.0.1:4173/ 。`npm run dev` 同时启动网页和服务端接口，并在预览服务意外退出后重新启动。无需单独启动 API。

局域网手机访问：运行 `npm run dev:lan`，手机与电脑连接同一可信网络，然后在 Safari 中输入电脑的局域网 IP，例如 `http://电脑IP:4173/`。不要在手机输入 `127.0.0.1`。

## 配置模型

先复制配置模板：

```bash
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

在 `.env` 中填写自己的 API Key，保存后重启 `npm run dev`。模板包含服务地址与模型 ID 示例；请使用自己平台账号已开通的模型或对应推理接入点。

| 用途 | 配置 |
| --- | --- |
| 文字交流、整理记忆 | `JIXIANG_TEXT_PROVIDER`、`JIXIANG_TEXT_BASE_URL`、`JIXIANG_TEXT_MODEL`、`JIXIANG_TEXT_API_KEY` |
| 照片内容理解 | `JIXIANG_VISION_MODEL`、`JIXIANG_VISION_API_KEY`，使用火山方舟支持图片输入的模型 |
| 绘制纪念章 | `JIXIANG_IMAGE_PROVIDER`、`JIXIANG_IMAGE_BASE_URL`、`JIXIANG_IMAGE_MODEL`、`JIXIANG_IMAGE_API_KEY` |

方舟视觉 Key 留空时可复用已配置的方舟绘图 Key，前提是该 Key 有视觉模型权限。绘图模型和 embedding 模型不能用于看图。

首次和小芽聊天时选择开启聊天整理；读取作品还需单独开启“让小芽读作品”。TXT、DOCX、文本型 PDF 在本地提取文本，照片经适当缩小后发送给视觉模型。不要给环境变量增加 `VITE_` 前缀，密钥只在服务端读取。

没有填写模型密钥时，仍可安排任务、计时、保存作品和浏览足迹。在线体验使用服务器已有配置，不需要在浏览器填写密钥。

## 生产运行

```bash
npm ci
npm run build:web
```

设置 `.env` 中的 `PUBLIC_ORIGIN` 为自己的完整网址，例如 `https://your-domain.example`，再启动：

```bash
npm run start:production
```

服务默认监听 8080，提供构建后的前端和 `/api/` 接口。正式公网入口应通过 HTTPS 反向代理访问；可按 [腾讯云部署说明](../deploy/tencent/README.md) 使用仓库自带 Docker Compose 和 Caddy。配置文件在服务端单独保存，不提交到 GitHub。

## 检查与测试

```bash
npm run check:runtime
npx tsc --noEmit
npm run build
npm run test:sites
npx playwright install chromium
npm run test:runtime
npm run test:ai
npm run test:production
```

若 Windows 已安装 Edge，可将 Playwright 切换到 Edge：

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:runtime
```

生产测试需要先构建 `dist/client`。UI 测试默认使用 4174，避免修改 4173 的个人预览记录；测试数据与后台状态放在独立测试目录。

## 数据与备份

- 浏览器任务、FocusLog 与作品原件：当前浏览器本机存储。
- 本地服务端记忆和配置：`.local/`，不作为静态文件提供，也不提交 Git。
- 腾讯云服务端数据：`zhitu-data` 持久卷。升级前备份该卷，不运行 `docker compose down -v`。
- 需要带走作品和聊天时，在“我的”中导出可阅读的 HTML 记录；不同网址的本地记录不会自动迁移。
