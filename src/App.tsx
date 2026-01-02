import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'

interface FFmpegOutput {
  type: 'stdout' | 'stderr'
  data: string
}

type FeatureType = 'mp3' | 'compress' | 'convert'
type VideoFormat = 'mp4' | 'avi' | 'mov' | 'mkv' | 'webm' | 'flv'

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
    if (selectedFile && outputPath) {
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
      }
      
      setCommand(cmd)
    } else {
      setCommand('')
    }
  }, [selectedFile, outputPath, selectedFeature, compressionQuality, targetFormat])

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
      }
      
      generateUniqueFilename(baseOutputPath).then(uniquePath => {
        setOutputPath(uniquePath)
      })
    } else {
      setOutputPath('')
    }
  }, [selectedFile, selectedFeature, targetFormat])

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
  }
  
  const handleFeatureChange = (feature: FeatureType) => {
    setSelectedFeature(feature)
    setStatus('idle')
    setOutput([])
    setIsCopied(false)
  }
  
  const getFeatureTitle = () => {
    switch (selectedFeature) {
      case 'mp3': return t('features.mp3.title')
      case 'compress': return t('features.compress.title')
      case 'convert': return t('features.convert.title')
    }
  }
  
  const getFeatureDescription = () => {
    switch (selectedFeature) {
      case 'mp3': return t('features.mp3.description')
      case 'compress': return t('features.compress.description')
      case 'convert': return t('features.convert.description')
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
              <h2 className="text-white font-bold text-lg mb-4 uppercase tracking-wide">{t('ui.featureSelection')}</h2>
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

              {/* Output Path Input */}
              {selectedFile && (
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

              {/* Status Indicator */}
              {status !== 'idle' && (
                <div className={`
                  p-4 rounded-lg mb-6 animate-fadeIn
                  ${status === 'success' ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}
                `}>
                  <p className={`font-semibold ${status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                    {status === 'success' ? t('status.success') : t('status.error')}
                  </p>
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