# TemotoAlign

<div align="center">
    <h2>TemotoAlign</h2>
    <p>手元视频一键对齐工具</p>
    <p>自动对齐手元录像与高质量音轨，导出可直接使用的成品视频</p>
</div>

![GitHub Repo stars](https://img.shields.io/github/stars/TrueRou/TemotoAlign)
![GitHub forks](https://img.shields.io/github/forks/TrueRou/TemotoAlign)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/TrueRou/TemotoAlign)

## ✨ 主要功能

- **一键对齐**：上传手元视频和高质量音频，自动计算时间偏移并对齐，无需手动调整；
- **智能分段匹配**：针对多次重开、开局乱打等场景，自动识别最后一段有效 gameplay 进行匹配；
- **可视化时间轴**：直观展示两段素材的对齐位置，支持实时预览和增益调节；
- **本地导出**：视频直通 remux + 音频 AAC 编码，全程浏览器端处理，无需上传完整视频；
- **跨平台**：支持 Web 浏览器、iOS 和 Android（通过 Capacitor）。

## 📸 效果预览

<!-- TODO: 添加截图 -->

## 📦 快速开始

### 使用方式

1. 打开 TemotoAlign 网页或 App
2. 上传手元视频（Clip1）和高质量音频来源（Clip2）
3. 点击「开始对齐」，等待自动计算完成
4. 在时间轴上预览对齐效果，调整音量和混音参数
5. 点击「导出视频」，获得对齐后的成品 MP4

### 本地开发

```bash
git clone https://github.com/TrueRou/TemotoAlign.git
cd TemotoAlign
pnpm install
pnpm dev
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Nuxt 4 + Vue 3 |
| 样式 | Tailwind CSS v4 + DaisyUI v5 |
| 状态管理 | Pinia 3 |
| 视频处理 | mp4-muxer + MP4Box（浏览器端 remux） |
| 音频对齐 | librosa onset-envelope 交叉相关（otoge-service） |
| 移动端 | Capacitor 7（iOS / Android） |
| 后端 | Nitro (Bun) + otoge-service (FastAPI) |
| 校验 | Zod v4 |

## 🏗️ 项目部署

### 环境变量

在 `.env` 或运行环境中配置：

```env
# otoge-service 对齐服务地址
NUXT_OTOGE_BASE_URL=https://your-api-host/otoge
# 开发者令牌
NUXT_OTOGE_DEVELOPER_TOKEN=your_token_here
```

### 构建与运行

```bash
pnpm build
node .output/server/index.mjs
```

### 移动端

```bash
pnpm capacitor:sync
pnpm capacitor:ios      # 打开 Xcode
pnpm capacitor:android  # 打开 Android Studio
```

### Docker

```bash
docker build -t temotoalign .
docker run -p 3000:3000 temotoalign
```

## 🤝 支持项目

如果觉得 TemotoAlign 好用的话，不妨给仓库点一个 ⭐！

---

Copyright © 2025-2026 TuRou
