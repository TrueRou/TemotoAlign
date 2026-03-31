# TemotoAlign

TemotoAlign 是 `maimai-timing-align` 的 Nuxt + TypeScript 客户端迁移版本。

## 当前状态

当前提交已完成以下基础实现：

- Nuxt 4 + TypeScript + Pinia + Tailwind + daisyUI 工程骨架
- Capacitor 基础配置
- 对齐配置、结果、导出能力的共享类型
- 客户端能力门禁（Web / iOS / Android WebView）
- 素材文件探测与页面输入流程
- 客户端音频预处理：解码、单声道化、重采样、WAV 编码
- 远端音频对齐 API 代理
- 本地预览/完整导出：音频混音、VideoEncoder、AudioEncoder、MP4 封装
- Web 下载与 Capacitor 文件写入 / 分享闭环
- WebCodecs Worker 协议占位
- GitHub Actions 基础 CI

## 当前未完成

- 音频抽轨与 WAV 标准化
- 本地文件保存与分享闭环
- Capacitor 原生工程初始化
- 完整的端到端测试

## 设计约束

- 不支持服务端导出
- 客户端能力不足时直接拒绝服务
- H.264 为基础导出格式
- H.265 仅在探测通过时开放

## 开发

安装依赖后：

- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

## 移动端

- `pnpm capacitor:sync`
- `pnpm capacitor:ios`
- `pnpm capacitor:android`
