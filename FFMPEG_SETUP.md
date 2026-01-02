# FFmpeg 设置说明

## 问题描述
打包后的应用执行 FFmpeg 命令时报错，因为系统中可能没有安装 FFmpeg 或者应用无法访问系统的 FFmpeg。

## 解决方案

### 1. 下载 FFmpeg 静态二进制文件

#### macOS:
```bash
# 创建资源目录
mkdir -p resources/bin

# 下载 FFmpeg (您可以从官方网站下载静态构建版本)
# 方法 1: 使用官方二进制文件
# 访问: https://evermeet.cx/ffmpeg/
# 下载 ffmpeg.7z 并解压 ffmpeg 到 resources/bin/

# 方法 2: 如果您已经安装了 FFmpeg (通过 Homebrew)
# 可以复制系统的 FFmpeg
cp $(which ffmpeg) resources/bin/

# 给予执行权限
chmod +x resources/bin/ffmpeg
```

#### Windows:
```bash
# 创建资源目录
mkdir resources\bin

# 下载 FFmpeg 静态构建
# 访问: https://www.gyan.dev/ffmpeg/builds/
# 下载 ffmpeg-release-essentials.zip
# 解压并复制 bin/ffmpeg.exe 到 resources/bin/
```

### 2. 验证文件结构

确保您的项目结构如下：
```
ffmpeg-electron/
├── resources/
│   └── bin/
│       └── ffmpeg          (macOS)
│       └── ffmpeg.exe      (Windows)
├── electron/
├── src/
└── ...
```

### 3. 重新打包

```bash
npm run build
```

### 4. 测试

打包完成后，运行打包后的应用程序，FFmpeg 功能应该可以正常工作了。

## 开发模式

在开发模式下（`npm run dev`），应用会使用系统安装的 FFmpeg，所以您需要确保系统中已经安装了 FFmpeg：

### macOS:
```bash
brew install ffmpeg
```

### Windows:
下载并安装 FFmpeg，然后将其添加到系统 PATH。

## 故障排查

如果仍然遇到问题，请检查：

1. FFmpeg 二进制文件是否在 `resources/bin/` 目录中
2. FFmpeg 文件是否有执行权限（macOS/Linux）
3. 查看应用的控制台日志，确认 FFmpeg 路径

在打包后的应用中，您可以通过开发者工具查看控制台输出：
- macOS: 在应用中按 `Cmd + Option + I`
- Windows: 在应用中按 `Ctrl + Shift + I`

## 代码更改说明

修改了以下文件：
1. `electron/main/index.ts` - 添加了 `getFfmpegPath()` 函数来处理开发和生产环境的路径
2. `electron-builder.json` - 添加了 `extraResources` 配置来打包 FFmpeg 二进制文件
