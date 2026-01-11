import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'

interface FFmpegOutput {
  type: 'stdout' | 'stderr'
  data: string
}

interface VideoInfo {
  format: {
    filename: string
    format_name: string
    format_long_name: string
    duration: string
    size: string
    bit_rate: string
  }
  streams: Array<{
    codec_type: string
    codec_name: string
    codec_long_name: string
    width?: number
    height?: number
    r_frame_rate?: string
    display_aspect_ratio?: string
    sample_rate?: string
    channels?: number
    bit_rate?: string
  }>
}

type FeatureType = 'mp3' | 'compress' | 'convert' | 'clip' | 'resize' | 'info' | 'transcode'
type VideoFormat = 'mp4' | 'avi' | 'mov' | 'mkv' | 'webm' | 'flv'
type ResolutionType = '1080p' | '720p' | '480p' | '360p'
type VideoCodec = 'libx264' | 'libx265' | 'libvpx' | 'libvpx-vp9' | 'copy'
type AudioCodec = 'aac' | 'libmp3lame' | 'libopus' | 'libvorbis' | 'copy'

function App() {
  const { t, i18n } = useTranslation()
  const [selectedFeature, setSelectedFeature] = useState<FeatureType>('mp3')
  const [selectedFile, setSelectedFile] = useState<{ name: string; path: string } | null>(null)
  const [outputPath, setOutputPath] = useState('')
  const [command, setCommand] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isCopied, setIsCopied] = useState(false)
  
  // Video compression settings
  const [compressionQuality, setCompressionQuality] = useState<'high' | 'medium' | 'low'>('medium')
  
  // Format conversion settings
  const [targetFormat, setTargetFormat] = useState<VideoFormat>('mp4')
  
  // Video clip settings
  const [clipStartTime, setClipStartTime] = useState('')
  const [clipEndTime, setClipEndTime] = useState('')
  
  // Video resize settings
  const [targetResolution, setTargetResolution] = useState<ResolutionType>('1080p')
  
  // Video transcode settings
  const [transcodeVideoCodec, setTranscodeVideoCodec] = useState<VideoCodec>('libx264')
  const [transcodeAudioCodec, setTranscodeAudioCodec] = useState<AudioCodec>('aac')
  const [transcodeFormat, setTranscodeFormat] = useState<VideoFormat>('mp4')
  const [transcodeBitrate, setTranscodeBitrate] = useState('')
  const [transcodeCrf, setTranscodeCrf] = useState('23')
  
  // Video info
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [ffprobeCommand, setFfprobeCommand] = useState('')

  // Generate unique filename if file already exists
  const generateUniqueFilename = async (basePath: string): Promise<string> => {
    if (!window.ipcRenderer) return basePath
    
    try {
      let counter = 1
      let testPath = basePath
      
      // Extract directory, filename without extension, and extension
      const lastSlash = basePath.lastIndexOf('/')
      const dir = basePath.substring(0, lastSlash)
      const fullFilename = basePath.substring(lastSlash + 1)
      const lastDot = fullFilename.lastIndexOf('.')
      const filename = lastDot > 0 ? fullFilename.substring(0, lastDot) : fullFilename
      const ext = lastDot > 0 ? fullFilename.substring(lastDot) : ''
      
      // Keep incrementing counter until we find a non-existing filename
      while (await window.ipcRenderer.invoke('check-file-exists', testPath)) {
        counter++
        testPath = `${dir}/${filename}-${counter}${ext}`
      }
      
      return testPath
    } catch (error) {
      console.error('Error checking file existence:', error)
      return basePath
    }
  }

  // Generate FFmpeg command when file, output path, or settings change
  useEffect(() => {
    if (selectedFeature === 'info') {
      // For info feature, generate ffprobe command
      if (selectedFile) {
        const inputPath = selectedFile.path
        const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`
        setFfprobeCommand(cmd)
        setCommand(cmd)
      } else {
        setFfprobeCommand('')
        setCommand('')
      }
    } else if (selectedFile && outputPath) {
      console.log('selectedFile', selectedFile)
      const inputPath = selectedFile.path
      let cmd = ''
      
      switch (selectedFeature) {
        case 'mp3':
          // Convert to MP3
          cmd = `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`
          break
          
        case 'compress':
          // Video compression with different quality levels
          let crf = '23' // default medium quality
          if (compressionQuality === 'high') crf = '18' // higher quality, larger file
          else if (compressionQuality === 'low') crf = '28' // lower quality, smaller file
          
          cmd = `ffmpeg -y -i "${inputPath}" -vcodec libx264 -crf ${crf} -preset medium -acodec aac -b:a 128k "${outputPath}"`
          break
          
        case 'convert':
          // Format conversion
          cmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -c:a aac -strict experimental "${outputPath}"`
          break
          
        case 'clip':
          // Video clip with time range
          let timeParams = ''
          if (clipStartTime) {
            timeParams += `-ss ${clipStartTime} `
          }
          if (clipEndTime) {
            if (clipStartTime) {
              // Calculate duration from start to end
              timeParams += `-to ${clipEndTime} `
            } else {
              timeParams += `-to ${clipEndTime} `
            }
          }
          cmd = `ffmpeg -y ${timeParams}-i "${inputPath}" -c:v libx264 -c:a aac "${outputPath}"`
          break
          
        case 'resize':
          // Resize video to target resolution while maintaining aspect ratio
          let height = '1080' // default 1080p
          if (targetResolution === '720p') height = '720'
          else if (targetResolution === '480p') height = '480'
          else if (targetResolution === '360p') height = '360'
          
          // Use scale filter with -1 to maintain aspect ratio
          cmd = `ffmpeg -y -i "${inputPath}" -vf "scale=-2:${height}" -c:v libx264 -crf 23 -preset medium -c:a aac "${outputPath}"`
          break
          
        case 'transcode':
          // Video transcode with custom codec and settings
          let transcodeParams = ''
          
          // Video codec settings
          if (transcodeVideoCodec === 'copy') {
            transcodeParams += '-c:v copy '
          } else {
            transcodeParams += `-c:v ${transcodeVideoCodec} `
            
            // Add CRF for quality-based encoding (not for copy)
            if (transcodeCrf && transcodeVideoCodec !== 'copy') {
              transcodeParams += `-crf ${transcodeCrf} `
            }
            
            // Add bitrate if specified
            if (transcodeBitrate) {
              transcodeParams += `-b:v ${transcodeBitrate} `
            }
          }
          
          // Audio codec settings
          if (transcodeAudioCodec === 'copy') {
            transcodeParams += '-c:a copy '
          } else {
            transcodeParams += `-c:a ${transcodeAudioCodec} `
          }
          
          cmd = `ffmpeg -y -i "${inputPath}" ${transcodeParams}"${outputPath}"`
          break
      }
      
      setCommand(cmd)
    } else {
      setCommand('')
    }
  }, [selectedFile, outputPath, selectedFeature, compressionQuality, targetFormat, clipStartTime, clipEndTime, targetResolution, transcodeVideoCodec, transcodeAudioCodec, transcodeFormat, transcodeBitrate, transcodeCrf])

  // Generate unique output path when file or feature is selected
  useEffect(() => {
    if (selectedFile) {
      const inputPath = selectedFile.path
      let baseOutputPath = ''
      
      switch (selectedFeature) {
        case 'mp3':
          baseOutputPath = inputPath.replace(/\.[^.]+$/i, '.mp3')
          break
        case 'compress':
          baseOutputPath = inputPath.replace(/(\.[^.]+)$/i, '-compressed$1')
          break
        case 'convert':
          baseOutputPath = inputPath.replace(/\.[^.]+$/i, `.${targetFormat}`)
          break
        case 'clip':
          baseOutputPath = inputPath.replace(/(\.[^.]+)$/i, '-clipped$1')
          break
        case 'resize':
          baseOutputPath = inputPath.replace(/(\.[^.]+)$/i, `-${targetResolution}$1`)
          break
      }
      
      if (selectedFeature === 'transcode') {
        baseOutputPath = inputPath.replace(/\.[^.]+$/i, `-transcoded.${transcodeFormat}`)
      }
      
      generateUniqueFilename(baseOutputPath).then(uniquePath => {
        setOutputPath(uniquePath)
      })
    } else {
      setOutputPath('')
    }
  }, [selectedFile, selectedFeature, targetFormat, targetResolution, transcodeFormat])

  // Listen for FFmpeg output
  useEffect(() => {
    if (window.ipcRenderer) {
      const handleOutput = (_event: any, data: FFmpegOutput) => {
        setOutput(prev => [...prev, data.data])
      }
      
      window.ipcRenderer.on('ffmpeg-output', handleOutput)
      
      return () => {
        window.ipcRenderer.off('ffmpeg-output', handleOutput)
      }
    }
  }, [])



  const handleBrowseClick = async () => {
    if (!window.ipcRenderer) return
    
    try {
      const filePath = await window.ipcRenderer.invoke('select-file')
      if (filePath) {
        const fileName = filePath.split(/[\\/]/).pop() || filePath
        setSelectedFile({
          name: fileName,
          path: filePath
        })
        setStatus('idle')
        setOutput([])
      }
    } catch (error) {
      console.error('文件选择失败:', error)
    }
  }

  const handleExecute = async () => {
    if (!command || !window.ipcRenderer) return
    
    setIsExecuting(true)
    setOutput([])
    setStatus('idle')
    
    try {
      await window.ipcRenderer.invoke('execute-ffmpeg', command)
      setStatus('success')
    } catch (error: any) {
      setStatus('error')
      setOutput(prev => [...prev, `Error: ${error.error || error.message || 'Unknown error'}`])
    } finally {
      setIsExecuting(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setOutputPath('')
    setCommand('')
    setOutput([])
    setStatus('idle')
    setIsCopied(false)
    setVideoInfo(null)
    setFfprobeCommand('')
  }
  
  const handleFeatureChange = (feature: FeatureType) => {
    setSelectedFeature(feature)
    setStatus('idle')
    setOutput([])
    setIsCopied(false)
    setVideoInfo(null)
    setFfprobeCommand('')
  }
  
  const getFeatureTitle = () => {
    switch (selectedFeature) {
      case 'mp3': return t('features.mp3.title')
      case 'compress': return t('features.compress.title')
      case 'convert': return t('features.convert.title')
      case 'clip': return t('features.clip.title')
      case 'resize': return t('features.resize.title')
      case 'info': return t('features.info.title')
      case 'transcode': return t('features.transcode.title')
    }
  }
  
  const getFeatureDescription = () => {
    switch (selectedFeature) {
      case 'mp3': return t('features.mp3.description')
      case 'compress': return t('features.compress.description')
      case 'convert': return t('features.convert.description')
      case 'clip': return t('features.clip.description')
      case 'resize': return t('features.resize.description')
      case 'info': return t('features.info.description')
      case 'transcode': return t('features.transcode.description')
    }
  }
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(newLang)
  }

  const handleCopyCommand = async () => {
    if (!command) return
    
    try {
      await navigator.clipboard.writeText(command)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  const handleAnalyzeVideo = async () => {
    if (!selectedFile || !window.ipcRenderer) return
    
    setIsAnalyzing(true)
    setVideoInfo(null)
    setStatus('idle')
    
    try {
      const result = await window.ipcRenderer.invoke('get-video-info', selectedFile.path) as { success: boolean; data: VideoInfo }
      if (result.success) {
        setVideoInfo(result.data)
        setStatus('success')
      }
    } catch (error: any) {
      setStatus('error')
      console.error('视频分析失败:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes)
    if (isNaN(size)) return bytes
    
    const units = ['B', 'KB', 'MB', 'GB']
    let unitIndex = 0
    let fileSize = size
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024
      unitIndex++
    }
    
    return `${fileSize.toFixed(2)} ${units[unitIndex]}`
  }

  const formatDuration = (seconds: string) => {
    const duration = parseFloat(seconds)
    if (isNaN(duration)) return seconds
    
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const secs = Math.floor(duration % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatBitrate = (bitrate: string) => {
    const rate = parseInt(bitrate)
    if (isNaN(rate)) return bitrate
    
    if (rate >= 1000000) {
      return `${(rate / 1000000).toFixed(2)} Mbps`
    } else if (rate >= 1000) {
      return `${(rate / 1000).toFixed(2)} Kbps`
    }
    return `${rate} bps`
  }

  const formatCodecName = (codecName: string) => {
    const codecMap: { [key: string]: string } = {
      'hevc': 'HEVC (H.265)',
      'h264': 'H.264',
      'avc': 'AVC (H.264)',
      'vp8': 'VP8',
      'vp9': 'VP9',
      'av1': 'AV1',
      'mpeg4': 'MPEG-4',
      'mpeg2video': 'MPEG-2',
      'aac': 'AAC',
      'mp3': 'MP3',
      'opus': 'Opus',
      'vorbis': 'Vorbis',
      'flac': 'FLAC',
      'pcm_s16le': 'PCM'
    }
    
    const lowerCodec = codecName.toLowerCase()
    return codecMap[lowerCodec] || codecName.toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-5xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              {t('app.title')}
            </h1>
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 border border-white/20"
              title={t('language.switch')}
            >
              {i18n.language === 'zh' ? '🇨🇳 中文' : '🇺🇸 EN'}
            </button>
          </div>
          <p className="text-blue-200 text-lg">{getFeatureTitle()}</p>
          <p className="text-blue-300 text-sm mt-1">{getFeatureDescription()}</p>
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar - Feature Selection */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 sticky top-8">
              <h2 className="text-white font-bold text-lg mb-4 uppercase tracking-wide">{t('ui.commonFeatures')}</h2>
              <div className="space-y-3">
                <button
                  onClick={() => handleFeatureChange('mp3')}
                  className={`
                    w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                    ${selectedFeature === 'mp3'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {t('features.mp3.button')}
                </button>
                
                <button
                  onClick={() => handleFeatureChange('compress')}
                  className={`
                    w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                    ${selectedFeature === 'compress'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {t('features.compress.button')}
                </button>
                
                <button
                  onClick={() => handleFeatureChange('convert')}
                  className={`
                    w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                    ${selectedFeature === 'convert'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {t('features.convert.button')}
                </button>
                
                <button
                  onClick={() => handleFeatureChange('clip')}
                  className={`
                    w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                    ${selectedFeature === 'clip'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {t('features.clip.button')}
                </button>
                
                <button
                  onClick={() => handleFeatureChange('resize')}
                  className={`
                    w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                    ${selectedFeature === 'resize'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {t('features.resize.button')}
                </button>
                
                <button
                  onClick={() => handleFeatureChange('info')}
                  className={`
                    w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                    ${selectedFeature === 'info'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {t('features.info.button')}
                </button>
              </div>
              
              {/* Advanced Features Section */}
              <div className="mt-8">
                <h2 className="text-white font-bold text-lg mb-4 uppercase tracking-wide">{t('ui.advancedFeatures')}</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => handleFeatureChange('transcode')}
                    className={`
                      w-full px-4 py-3 rounded-lg font-semibold text-left transition-all duration-300 transform hover:scale-105
                      ${selectedFeature === 'transcode'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                      }
                    `}
                  >
                    {t('features.transcode.button')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
              {/* File Selection */}
              <div className="relative border-2 border-dashed rounded-xl p-12 mb-6 transition-all duration-300 border-white/30 bg-white/5 hover:bg-white/10">
                <div className="text-center">
                  <svg
                    className="mx-auto h-16 w-16 text-purple-300 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-xl text-white mb-4">
                    {selectedFile ? selectedFile.name : t('ui.selectFile')}
                  </p>
                  <button
                    onClick={handleBrowseClick}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    {t('ui.browseFile')}
                  </button>
                </div>
              </div>

              {/* Feature-specific Settings */}
              {selectedFile && selectedFeature === 'compress' && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                    {t('ui.compressionQuality')}
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCompressionQuality('high')}
                      className={`
                        flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-300
                        ${compressionQuality === 'high'
                          ? 'bg-green-500 text-white shadow-lg'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }
                      `}
                    >
                      {t('quality.high')}
                      <div className="text-xs mt-1 opacity-80">{t('quality.highDesc')}</div>
                    </button>
                    <button
                      onClick={() => setCompressionQuality('medium')}
                      className={`
                        flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-300
                        ${compressionQuality === 'medium'
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }
                      `}
                    >
                      {t('quality.medium')}
                      <div className="text-xs mt-1 opacity-80">{t('quality.mediumDesc')}</div>
                    </button>
                    <button
                      onClick={() => setCompressionQuality('low')}
                      className={`
                        flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-300
                        ${compressionQuality === 'low'
                          ? 'bg-orange-500 text-white shadow-lg'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }
                      `}
                    >
                      {t('quality.low')}
                      <div className="text-xs mt-1 opacity-80">{t('quality.lowDesc')}</div>
                    </button>
                  </div>
                </div>
              )}

              {selectedFile && selectedFeature === 'convert' && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                    {t('ui.targetFormat')}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'] as VideoFormat[]).map(format => (
                      <button
                        key={format}
                        onClick={() => setTargetFormat(format)}
                        className={`
                          px-4 py-3 rounded-lg font-semibold uppercase transition-all duration-300 transform hover:scale-105
                          ${targetFormat === format
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }
                        `}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedFile && selectedFeature === 'clip' && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                    {t('ui.clipSettings')}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/80 text-sm mb-2">
                        {t('ui.startTime')}
                      </label>
                      <input
                        type="text"
                        value={clipStartTime}
                        onChange={(e) => setClipStartTime(e.target.value)}
                        placeholder="00:00:10 or 10"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                      />
                      <p className="text-xs text-white/50 mt-1">{t('ui.timeFormatHint')}</p>
                    </div>
                    <div>
                      <label className="block text-white/80 text-sm mb-2">
                        {t('ui.endTime')}
                      </label>
                      <input
                        type="text"
                        value={clipEndTime}
                        onChange={(e) => setClipEndTime(e.target.value)}
                        placeholder="00:00:30 or 30"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                      />
                      <p className="text-xs text-white/50 mt-1">{t('ui.timeFormatHint')}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedFile && selectedFeature === 'resize' && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                    {t('ui.targetResolution')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['1080p', '720p', '480p', '360p'] as ResolutionType[]).map(resolution => (
                      <button
                        key={resolution}
                        onClick={() => setTargetResolution(resolution)}
                        className={`
                          px-6 py-4 rounded-lg font-semibold uppercase transition-all duration-300 transform hover:scale-105
                          ${targetResolution === resolution
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }
                        `}
                      >
                        <div className="text-lg">{resolution}</div>
                        <div className="text-xs mt-1 opacity-80">
                          {resolution === '1080p' && '1920x1080'}
                          {resolution === '720p' && '1280x720'}
                          {resolution === '480p' && '854x480'}
                          {resolution === '360p' && '640x360'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/60 mt-3">
                    {t('ui.resizeHint')}
                  </p>
                </div>
              )}

              {selectedFile && selectedFeature === 'transcode' && (
                <div className="mb-6 animate-fadeIn space-y-6">
                  {/* Output Format Selection */}
                  <div>
                    <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                      {t('ui.outputFormat')}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'] as VideoFormat[]).map(format => (
                        <button
                          key={format}
                          onClick={() => setTranscodeFormat(format)}
                          className={`
                            px-4 py-3 rounded-lg font-semibold uppercase transition-all duration-300 transform hover:scale-105
                            ${transcodeFormat === format
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }
                          `}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Video Codec Selection */}
                  <div>
                    <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                      {t('ui.videoCodec')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['libx264', 'libx265', 'libvpx', 'libvpx-vp9', 'copy'] as VideoCodec[]).map(codec => (
                        <button
                          key={codec}
                          onClick={() => setTranscodeVideoCodec(codec)}
                          className={`
                            px-4 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105
                            ${transcodeVideoCodec === codec
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }
                          `}
                        >
                          <div className="text-sm">{codec === 'copy' ? t('ui.copyStream') : codec.toUpperCase()}</div>
                          <div className="text-xs mt-1 opacity-80">
                            {codec === 'libx264' && 'H.264 (通用)'}
                            {codec === 'libx265' && 'H.265 (高效)'}
                            {codec === 'libvpx' && 'VP8'}
                            {codec === 'libvpx-vp9' && 'VP9'}
                            {codec === 'copy' && t('ui.noReencode')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audio Codec Selection */}
                  <div>
                    <label className="block text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                      {t('ui.audioCodec')}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['aac', 'libmp3lame', 'libopus', 'libvorbis', 'copy'] as AudioCodec[]).map(codec => (
                        <button
                          key={codec}
                          onClick={() => setTranscodeAudioCodec(codec)}
                          className={`
                            px-4 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105
                            ${transcodeAudioCodec === codec
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }
                          `}
                        >
                          <div className="text-sm">{codec === 'copy' ? t('ui.copyStream') : codec === 'libmp3lame' ? 'MP3' : codec.toUpperCase()}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality/Bitrate Settings */}
                  {transcodeVideoCodec !== 'copy' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/80 text-sm mb-2">
                          {t('ui.crf')} (0-51)
                        </label>
                        <input
                          type="text"
                          value={transcodeCrf}
                          onChange={(e) => setTranscodeCrf(e.target.value)}
                          placeholder="23"
                          className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                        />
                        <p className="text-xs text-white/50 mt-1">{t('ui.crfHint')}</p>
                      </div>
                      <div>
                        <label className="block text-white/80 text-sm mb-2">
                          {t('ui.videoBitrate')}
                        </label>
                        <input
                          type="text"
                          value={transcodeBitrate}
                          onChange={(e) => setTranscodeBitrate(e.target.value)}
                          placeholder="2M"
                          className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                        />
                        <p className="text-xs text-white/50 mt-1">{t('ui.bitrateHint')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Output Path Input - Not shown for info feature */}
              {selectedFile && selectedFeature !== 'info' && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-white font-semibold mb-2 text-sm uppercase tracking-wide">
                    {t('ui.outputPath')}
                  </label>
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                    placeholder={t('ui.outputPath')}
                  />
                </div>
              )}

              {/* Command Preview */}
              {command && (
                <div className="mb-6 animate-fadeIn">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-white font-semibold text-sm uppercase tracking-wide">
                      {t('ui.commandPreview')}
                    </label>
                    <button
                      onClick={handleCopyCommand}
                      className="px-4 py-2 bg-blue-500/80 hover:bg-blue-600 text-white text-sm rounded-lg transition-all duration-200 flex items-center gap-2"
                    >
                      {isCopied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('ui.copied')}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {t('ui.copyCommand')}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-purple-500/30">
                    <code className="text-green-300 text-sm font-mono break-all">
                      {command}
                    </code>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedFeature === 'info' ? (
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={handleAnalyzeVideo}
                    disabled={!selectedFile || isAnalyzing}
                    className={`
                      flex-1 px-6 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform
                      ${selectedFile && !isAnalyzing
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 hover:scale-105 shadow-lg hover:shadow-blue-500/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('ui.analyzing')}
                      </span>
                    ) : (
                      t('ui.analyze')
                    )}
                  </button>
                  
                  <button
                    onClick={handleReset}
                    disabled={isAnalyzing}
                    className={`
                      px-6 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform
                      ${!isAnalyzing
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 hover:scale-105 shadow-lg hover:shadow-red-500/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {t('ui.reset')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={handleExecute}
                    disabled={!command || isExecuting}
                    className={`
                      flex-1 px-6 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform
                      ${command && !isExecuting
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 hover:scale-105 shadow-lg hover:shadow-green-500/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {isExecuting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('ui.executing')}
                      </span>
                    ) : (
                      t('ui.execute')
                    )}
                  </button>
                  
                  <button
                    onClick={handleReset}
                    disabled={isExecuting}
                    className={`
                      px-6 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform
                      ${!isExecuting
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 hover:scale-105 shadow-lg hover:shadow-red-500/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {t('ui.reset')}
                  </button>
                </div>
              )}

              {/* Status Indicator */}
              {status !== 'idle' && !videoInfo && (
                <div className={`
                  p-4 rounded-lg mb-6 animate-fadeIn
                  ${status === 'success' ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}
                `}>
                  <p className={`font-semibold ${status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                    {status === 'success' ? t('status.success') : t('status.error')}
                  </p>
                </div>
              )}

              {/* Video Information Display */}
              {selectedFeature === 'info' && videoInfo && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-white font-semibold mb-4 text-sm uppercase tracking-wide">
                    {t('ui.videoInfo')}
                  </label>
                  
                  {/* Basic Information */}
                  <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-lg p-6 mb-4 border border-blue-500/30">
                    <h3 className="text-blue-300 font-bold text-lg mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('ui.basicInfo')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-blue-200/70 text-xs mb-1">{t('ui.fileName')}</p>
                        <p className="text-white font-mono text-sm break-all">{selectedFile?.name}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-blue-200/70 text-xs mb-1">{t('ui.fileSize')}</p>
                        <p className="text-white font-mono text-sm">{formatFileSize(videoInfo.format.size)}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-blue-200/70 text-xs mb-1">{t('ui.duration')}</p>
                        <p className="text-white font-mono text-sm">{formatDuration(videoInfo.format.duration)}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-blue-200/70 text-xs mb-1">{t('ui.bitrate')}</p>
                        <p className="text-white font-mono text-sm">{formatBitrate(videoInfo.format.bit_rate)}</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 col-span-2">
                        <p className="text-blue-200/70 text-xs mb-1">{t('ui.format')}</p>
                        <p className="text-white font-mono text-sm">{videoInfo.format.format_long_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Video Stream Information */}
                  {videoInfo.streams.filter(s => s.codec_type === 'video').map((stream, index) => (
                    <div key={`video-${index}`} className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-lg p-6 mb-4 border border-purple-500/30">
                      <h3 className="text-purple-300 font-bold text-lg mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('ui.videoStream')} {videoInfo.streams.filter(s => s.codec_type === 'video').length > 1 ? `#${index + 1}` : ''}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-purple-200/70 text-xs mb-1">{t('ui.codec')}</p>
                          <p className="text-white font-mono text-sm">{formatCodecName(stream.codec_name)}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-purple-200/70 text-xs mb-1">{t('ui.resolution')}</p>
                          <p className="text-white font-mono text-sm">{stream.width} × {stream.height}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-purple-200/70 text-xs mb-1">{t('ui.frameRate')}</p>
                          <p className="text-white font-mono text-sm">
                            {stream.r_frame_rate ? (() => {
                              const [num, den] = stream.r_frame_rate.split('/').map(Number)
                              return `${(num / den).toFixed(2)} fps`
                            })() : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-purple-200/70 text-xs mb-1">{t('ui.aspectRatio')}</p>
                          <p className="text-white font-mono text-sm">{stream.display_aspect_ratio || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Audio Stream Information */}
                  {videoInfo.streams.filter(s => s.codec_type === 'audio').map((stream, index) => (
                    <div key={`audio-${index}`} className="bg-gradient-to-br from-green-900/40 to-teal-900/40 rounded-lg p-6 mb-4 border border-green-500/30">
                      <h3 className="text-green-300 font-bold text-lg mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        {t('ui.audioStream')} {videoInfo.streams.filter(s => s.codec_type === 'audio').length > 1 ? `#${index + 1}` : ''}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-green-200/70 text-xs mb-1">{t('ui.audioCodec')}</p>
                          <p className="text-white font-mono text-sm">{formatCodecName(stream.codec_name)}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-green-200/70 text-xs mb-1">{t('ui.sampleRate')}</p>
                          <p className="text-white font-mono text-sm">{stream.sample_rate ? `${(parseInt(stream.sample_rate) / 1000).toFixed(1)} kHz` : 'N/A'}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-green-200/70 text-xs mb-1">{t('ui.channels')}</p>
                          <p className="text-white font-mono text-sm">
                            {stream.channels === 1 ? 'Mono' : stream.channels === 2 ? 'Stereo' : `${stream.channels} channels`}
                          </p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-green-200/70 text-xs mb-1">{t('ui.audioBitrate')}</p>
                          <p className="text-white font-mono text-sm">{stream.bit_rate ? formatBitrate(stream.bit_rate) : 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Output Console */}
              {output.length > 0 && (
                <div className="animate-fadeIn">
                  <label className="block text-white font-semibold mb-2 text-sm uppercase tracking-wide">
                    {t('ui.outputLog')}
                  </label>
                  <div className="bg-gray-900/70 rounded-lg p-4 max-h-64 overflow-y-auto border border-purple-500/30">
                    <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
                      {output.join('')}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-blue-200 text-sm">
          <p>{t('app.footer')}</p>
        </div>
      </div>
    </div>
  )
}

export default App