# vite-react-electron

[![awesome-vite](https://awesome.re/mentioned-badge.svg)](https://github.com/vitejs/awesome-vite)
![GitHub stars](https://img.shields.io/github/stars/caoxiemeihao/vite-react-electron?color=fa6470)
![GitHub issues](https://img.shields.io/github/issues/caoxiemeihao/vite-react-electron?color=d8b22d)
![GitHub license](https://img.shields.io/github/license/caoxiemeihao/vite-react-electron)
[![Required Node.JS >= 14.18.0 || >=16.0.0](https://img.shields.io/static/v1?label=node&message=14.18.0%20||%20%3E=16.0.0&logo=node.js&color=3f893e)](https://nodejs.org/about/releases)

[English](README.md) | 简体中文

## 概述

📦 开箱即用  
🎯 基于官方的 [template-react-ts](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts), 低侵入性  
🌱 结构清晰，可塑性强  
💪 支持在渲染进程中使用 Electron、Node.js API  
🔩 支持 C/C++ 模块  
🖥 很容易实现多窗口  

## 快速开始

```sh
# clone the project
git clone https://github.com/electron-vite/electron-vite-react.git

# enter the project directory
cd electron-vite-react

# install dependency
npm install

# develop
npm run dev
```

## 调试

![electron-vite-react-debug.gif](/electron-vite-react-debug.gif)

## 目录

*🚨 默认情况下, `electron` 文件夹下的文件将会被构建到 `dist-electron`*

```tree
├── electron                                 Electron 源码文件夹
│   ├── main                                 Main-process 源码
│   └── preload                              Preload-scripts 源码
│
├── release                                  构建后生成程序目录
│   └── {version}
│       ├── {os}-{os_arch}                   未打包的程序(绿色运行版)
│       └── {app_name}_{version}.{ext}       应用安装文件
│
├── public                                   同 Vite 模板的 public
└── src                                      渲染进程源码、React代码
```

<!--
## 🚨 这需要留神

默认情况下，该模板在渲染进程中集成了 Node.js，如果你不需要它，你只需要删除下面的选项. [因为它会修改 Vite 默认的配置](https://github.com/electron-vite/vite-plugin-electron-renderer#config-presets-opinionated).

```diff
# vite.config.ts

export default {
  plugins: [
    ...
-   // Use Node.js API in the Renderer-process
-   renderer({
-     nodeIntegration: true,
-   }),
    ...
  ],
}
```
-->

## 🎬 FFmpeg 功能

本应用是一个功能丰富的 FFmpeg 客户端，提供以下功能：

### 核心功能
1. **🎵 MP4 转 MP3** - 从视频文件中提取音频
2. **📦 视频压缩** - 减小视频文件大小（支持高/中/低质量）
3. **🔄 格式转换** - 在不同视频格式之间转换（MP4、AVI、MOV、MKV、WebM、FLV）
4. **✂️ 视频剪辑** - 剪切视频片段，保留指定时间范围
5. **📐 修改分辨率** - 调整视频分辨率（1080p、720p、480p、360p）
6. **ℹ️ 视频信息** - 查看视频的详细信息和元数据 ✨ 新功能

### 视频信息功能特性
- 📊 基本信息：文件名、大小、时长、比特率、格式
- 🎥 视频流：编码、分辨率、帧率、宽高比
- 🔊 音频流：编码、采样率、声道、比特率
- 🌈 美观的界面设计，信息分类清晰
- 🌍 支持中英文双语

### 快速开始
```bash
# 安装 FFmpeg（开发环境）
brew install ffmpeg  # macOS

# 启动应用
npm run dev
```

### 相关文档
- [FFmpeg 设置说明](FFMPEG_SETUP.md)
- [视频信息功能指南](VIDEO_INFO_GUIDE.md)
- [快速开始指南](QUICK_START_VIDEO_INFO.md)
- [更改摘要](CHANGES_SUMMARY.md)

## 🔧 额外的功能

1. Electron 自动更新 👉 [阅读文档](src/components/update/README.zh-CN.md)
2. 国际化支持 (i18n) 👉 [阅读文档](I18N_GUIDE.md)
3. Playwright 测试

## ❔ FAQ

- [C/C++ addons, Node.js modules - Pre-Bundling](https://github.com/electron-vite/vite-plugin-electron-renderer#dependency-pre-bundling)
- [dependencies vs devDependencies](https://github.com/electron-vite/vite-plugin-electron-renderer#dependencies-vs-devdependencies)

## 🍵 🍰 🍣 🍟

<img width="270" src="https://github.com/caoxiemeihao/blog/blob/main/assets/$qrcode/$.png?raw=true">
