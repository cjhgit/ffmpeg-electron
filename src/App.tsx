import { useState, useEffect } from 'react'
import './App.css'

interface FFmpegOutput {
  type: 'stdout' | 'stderr'
  data: string
}

function App() {
  const [selectedFile, setSelectedFile] = useState<{ name: string; path: string } | null>(null)

  const [command, setCommand] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isCopied, setIsCopied] = useState(false)

  // Generate FFmpeg command when file is selected
  useEffect(() => {
    if (selectedFile) {
      console.log('selectedFile', selectedFile)
      const inputPath = selectedFile.path
      const outputPath = inputPath.replace(/\.mp4$/i, '.mp3')
      const cmd = `ffmpeg -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`
      setCommand(cmd)
    } else {
      setCommand('')
    }
  }, [selectedFile])

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
    setCommand('')
    setOutput([])
    setStatus('idle')
    setIsCopied(false)
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            FFmpeg Client
          </h1>
          <p className="text-blue-200 text-lg">MP4 to MP3 Converter</p>
        </div>

        {/* Main Card */}
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
                {selectedFile ? selectedFile.name : 'Select MP4 file'}
              </p>
              <button
                onClick={handleBrowseClick}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Browse Files
              </button>
            </div>
          </div>

          {/* Command Preview */}
          {command && (
            <div className="mb-6 animate-fadeIn">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-white font-semibold text-sm uppercase tracking-wide">
                  Command Preview
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
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制命令
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
                  Converting...
                </span>
              ) : (
                '▶ Execute'
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
              Reset
            </button>
          </div>

          {/* Status Indicator */}
          {status !== 'idle' && (
            <div className={`
              p-4 rounded-lg mb-6 animate-fadeIn
              ${status === 'success' ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}
            `}>
              <p className={`font-semibold ${status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                {status === 'success' ? '✓ Conversion completed successfully!' : '✗ Conversion failed'}
              </p>
            </div>
          )}

          {/* Output Console */}
          {output.length > 0 && (
            <div className="animate-fadeIn">
              <label className="block text-white font-semibold mb-2 text-sm uppercase tracking-wide">
                Output
              </label>
              <div className="bg-gray-900/70 rounded-lg p-4 max-h-64 overflow-y-auto border border-purple-500/30">
                <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
                  {output.join('')}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-blue-200 text-sm">
          <p>Powered by FFmpeg • Browse to select MP4 files</p>
        </div>
      </div>
    </div>
  )
}

export default App