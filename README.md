# FFmpeg Electron Client

A modern, user-friendly FFmpeg client built with Electron, React, and TypeScript.

[English](README.md) | [简体中文](README.zh-CN.md)

## 🎬 Features

This application is a feature-rich FFmpeg client that provides the following capabilities:

### Core Features
1. **🎵 MP4 to MP3** - Extract audio from video files
2. **📦 Video Compression** - Reduce video file size (High/Medium/Low quality)
3. **🔄 Format Conversion** - Convert between video formats (MP4, AVI, MOV, MKV, WebM, FLV)
4. **✂️ Video Clip** - Cut video segments with specified time range
5. **📐 Resize Resolution** - Adjust video resolution (1080p, 720p, 480p, 360p)
6. **ℹ️ Video Information** - View detailed video information and metadata ✨ New Feature

### Video Information Feature
- 📊 Basic Info: File name, size, duration, bitrate, format
- 🎥 Video Stream: Codec, resolution, frame rate, aspect ratio
- 🔊 Audio Stream: Codec, sample rate, channels, bitrate
- 🌈 Beautiful UI with clear information categorization
- 🌍 Bilingual support (English/Chinese)

## 🚀 Quick Start

```bash
# Install FFmpeg (Development Environment)
brew install ffmpeg  # macOS

# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build
```

## 📚 Documentation

- [FFmpeg Setup Guide](FFMPEG_SETUP.md)
- [Video Information Feature Guide](VIDEO_INFO_GUIDE.md)
- [Quick Start Guide](QUICK_START_VIDEO_INFO.md)
- [Changes Summary](CHANGES_SUMMARY.md)
- [Internationalization Guide](I18N_GUIDE.md)

## 🛠 Tech Stack

- **Electron** - Cross-platform desktop application framework
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **i18next** - Internationalization framework
- **FFmpeg** - Multimedia processing

## 📦 Project Structure

```
ffmpeg-electron/
├── electron/              # Electron main process
│   ├── main/             # Main process source
│   └── preload/          # Preload scripts
├── src/                  # React application
│   ├── components/       # React components
│   ├── i18n/            # Internationalization
│   └── App.tsx          # Main application
├── resources/           # Application resources
│   └── bin/            # FFmpeg binaries (for production)
└── build/              # Build assets
```

## 🔧 Additional Features

1. Electron Auto Update 👉 [Read Documentation](src/components/update/README.md)
2. Internationalization (i18n) 👉 [Read Documentation](I18N_GUIDE.md)
3. Playwright Testing

## 📝 License

MIT

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

## ⭐ Show your support

Give a ⭐️ if this project helped you!
