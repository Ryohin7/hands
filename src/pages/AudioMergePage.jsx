import { useState, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import '../styles/AudioMerge.css';

function AudioMergePage() {
    // 4段固定音軌檔案
    const [introFile, setIntroFile] = useState(null);
    const [bodyFile, setBodyFile] = useState(null);
    const [outro1File, setOutro1File] = useState(null);
    const [outro2File, setOutro2File] = useState(null);

    // 固定音檔的預覽 URL 與時長
    const [introInfo, setIntroInfo] = useState(null);
    const [bodyInfo, setBodyInfo] = useState(null);
    const [outro1Info, setOutro1Info] = useState(null);
    const [outro2Info, setOutro2Info] = useState(null);

    // 店名音軌檔案列表 (最多10間店)
    const [storeFiles, setStoreFiles] = useState([]);

    // 設定：段落間隔靜音時間 (秒)
    const [silenceTime, setSilenceTime] = useState(0.5);

    // 處理與進度狀態
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [generatedResults, setGeneratedResults] = useState([]);
    const [message, setMessage] = useState(null);

    // 拖曳狀態 (為每個拖曳區域獨立設置)
    const [dragOvers, setDragOvers] = useState({
        intro: false,
        body: false,
        outro1: false,
        outro2: false,
        stores: false
    });

    // 播放狀態管理
    const [playingId, setPlayingId] = useState(null); // 'intro', 'body', 'outro1', 'outro2', 'store-0', 'result-0' 等
    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);

    // 檔案 Input 引用
    const introInputRef = useRef(null);
    const bodyInputRef = useRef(null);
    const outro1InputRef = useRef(null);
    const outro2InputRef = useRef(null);
    const storesInputRef = useRef(null);

    // 清理資源
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
            // 釋放產生的 Object URL 避免記憶體洩漏
            generatedResults.forEach(r => URL.revokeObjectURL(r.url));
            if (introInfo?.url) URL.revokeObjectURL(introInfo.url);
            if (bodyInfo?.url) URL.revokeObjectURL(bodyInfo.url);
            if (outro1Info?.url) URL.revokeObjectURL(outro1Info.url);
            if (outro2Info?.url) URL.revokeObjectURL(outro2Info.url);
            storeFiles.forEach(sf => URL.revokeObjectURL(sf.url));
        };
    }, []);

    // 取得/初始化 AudioContext
    function getAudioContext() {
        if (!audioCtxRef.current) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }

    // 取得音訊檔案的時長
    function getAudioDuration(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const audio = new Audio(url);
            audio.addEventListener('loadedmetadata', () => {
                resolve({ url, duration: audio.duration });
            });
            audio.addEventListener('error', () => {
                resolve({ url, duration: 0 });
            });
        });
    }

    // 播放/暫停音訊
    function togglePlay(url, id) {
        if (playingId === id) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setPlayingId(null);
            return;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        setPlayingId(id);

        audio.play().catch(err => {
            console.error('播放失敗:', err);
            setPlayingId(null);
        });

        audio.addEventListener('ended', () => {
            setPlayingId(null);
        });
    }

    // ===== 處理上傳檔案 =====

    async function handleFixedTrack(file, type) {
        if (!file) return;
        if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
            setMessage({ type: 'error', text: '請上傳正確的音訊檔案' });
            return;
        }
        setMessage(null);

        const info = await getAudioDuration(file);
        const durationFormatted = info.duration ? info.duration.toFixed(1) + ' 秒' : '未知長度';

        if (type === 'intro') {
            if (introInfo?.url) URL.revokeObjectURL(introInfo.url);
            setIntroFile(file);
            setIntroInfo({ url: info.url, durationText: durationFormatted });
        } else if (type === 'body') {
            if (bodyInfo?.url) URL.revokeObjectURL(bodyInfo.url);
            setBodyFile(file);
            setBodyInfo({ url: info.url, durationText: durationFormatted });
        } else if (type === 'outro1') {
            if (outro1Info?.url) URL.revokeObjectURL(outro1Info.url);
            setOutro1File(file);
            setOutro1Info({ url: info.url, durationText: durationFormatted });
        } else if (type === 'outro2') {
            if (outro2Info?.url) URL.revokeObjectURL(outro2Info.url);
            setOutro2File(file);
            setOutro2Info({ url: info.url, durationText: durationFormatted });
        }
    }

    async function handleStoreTracks(files) {
        if (!files || files.length === 0) return;
        setMessage(null);

        const currentTotal = storeFiles.length;
        const incomingFiles = Array.from(files);

        if (currentTotal + incomingFiles.length > 10) {
            setMessage({ type: 'error', text: '店名音檔一次最多上傳 10 個' });
            return;
        }

        const newStoreFiles = [...storeFiles];

        for (const file of incomingFiles) {
            if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
                continue;
            }
            // 讀取店名（扣除副檔名）
            const storeName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const info = await getAudioDuration(file);
            const durationFormatted = info.duration ? info.duration.toFixed(1) + ' 秒' : '未知長度';

            newStoreFiles.push({
                file,
                storeName,
                url: info.url,
                durationText: durationFormatted,
                id: `store-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            });
        }

        setStoreFiles(newStoreFiles);
    }

    // 刪除檔案
    function removeFixedFile(type) {
        if (playingId === type) {
            audioRef.current?.pause();
            setPlayingId(null);
        }

        if (type === 'intro') {
            if (introInfo?.url) URL.revokeObjectURL(introInfo.url);
            setIntroFile(null);
            setIntroInfo(null);
            if (introInputRef.current) introInputRef.current.value = '';
        } else if (type === 'body') {
            if (bodyInfo?.url) URL.revokeObjectURL(bodyInfo.url);
            setBodyFile(null);
            setBodyInfo(null);
            if (bodyInputRef.current) bodyInputRef.current.value = '';
        } else if (type === 'outro1') {
            if (outro1Info?.url) URL.revokeObjectURL(outro1Info.url);
            setOutro1File(null);
            setOutro1Info(null);
            if (outro1InputRef.current) outro1InputRef.current.value = '';
        } else if (type === 'outro2') {
            if (outro2Info?.url) URL.revokeObjectURL(outro2Info.url);
            setOutro2File(null);
            setOutro2Info(null);
            if (outro2InputRef.current) outro2InputRef.current.value = '';
        }
    }

    function removeStoreFile(id) {
        const fileToRemove = storeFiles.find(f => f.id === id);
        if (fileToRemove) {
            if (playingId === id) {
                audioRef.current?.pause();
                setPlayingId(null);
            }
            URL.revokeObjectURL(fileToRemove.url);
        }
        setStoreFiles(storeFiles.filter(f => f.id !== id));
        if (storesInputRef.current) storesInputRef.current.value = '';
    }

    function clearAllStores() {
        if (audioRef.current) {
            audioRef.current.pause();
            setPlayingId(null);
        }
        storeFiles.forEach(f => URL.revokeObjectURL(f.url));
        setStoreFiles([]);
        if (storesInputRef.current) storesInputRef.current.value = '';
    }

    // ===== 拖曳控制 =====
    function handleDragOver(e, key) {
        e.preventDefault();
        setDragOvers(prev => ({ ...prev, [key]: true }));
    }

    function handleDragLeave(key) {
        setDragOvers(prev => ({ ...prev, [key]: false }));
    }

    function handleDrop(e, key) {
        e.preventDefault();
        setDragOvers(prev => ({ ...prev, [key]: false }));

        if (key === 'stores') {
            handleStoreTracks(e.dataTransfer.files);
        } else {
            handleFixedTrack(e.dataTransfer.files[0], key);
        }
    }

    // ===== WAV 編碼器純 JS 實作 =====
    function bufferToWav(buffer) {
        let numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferArr = new ArrayBuffer(length),
            view = new DataView(bufferArr),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"

        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // chunk length
        setUint16(1);                                  // sample format (raw PCM)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan);  // byte rate
        setUint16(numOfChan * 2);                      // block align
        setUint16(16);                                 // 16-bit precision

        setUint32(0x61746164);                         // "data" chunk
        setUint32(length - pos - 4);                   // chunk length

        // write interleaved data
        for(i=0; i<buffer.numberOfChannels; i++)
            channels.push(buffer.getChannelData(i));

        while(pos < length) {
            for(i=0; i<numOfChan; i++) {             // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // scale to 16-bit signed int
                view.setInt16(pos, sample, true);          // write 16-bit sample
                pos += 2;
            }
            offset++;                                     // next sample
        }

        return new Blob([bufferArr], {type: "audio/wav"});

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }

    // 解碼檔案為 AudioBuffer
    async function decodeFileToBuffer(audioCtx, file) {
        const arrayBuffer = await file.arrayBuffer();
        // 為了相容部分不支援 Promise 的 decodeAudioData 寫法
        return new Promise((resolve, reject) => {
            audioCtx.decodeAudioData(
                arrayBuffer,
                (decodedData) => resolve(decodedData),
                (err) => reject(err)
            );
        });
    }

    // 拼接多個 AudioBuffer
    function mergeAudioBuffers(audioCtx, buffers, silenceDuration) {
        const activeBuffers = buffers.filter(b => b !== null);
        if (activeBuffers.length === 0) return null;

        const sampleRate = activeBuffers[0].sampleRate;
        const silenceSamples = Math.floor(silenceDuration * sampleRate);

        // 1. 計算輸出總長度
        let totalLength = 0;
        for (let i = 0; i < buffers.length; i++) {
            const buf = buffers[i];
            if (buf) {
                totalLength += buf.length;
                
                // 檢查是否是最後一個非空的 buffer
                let isLast = true;
                for (let j = i + 1; j < buffers.length; j++) {
                    if (buffers[j]) {
                        isLast = false;
                        break;
                    }
                }
                
                if (!isLast) {
                    totalLength += silenceSamples;
                }
            }
        }

        // 2. 建立合併輸出 Buffer (取最大通道數，通常為 2)
        const maxChannels = Math.max(...activeBuffers.map(b => b.numberOfChannels));
        const mergedBuffer = audioCtx.createBuffer(maxChannels, totalLength, sampleRate);

        // 3. 拷貝數據到合併 Buffer
        let currentOffset = 0;
        for (let i = 0; i < buffers.length; i++) {
            const buf = buffers[i];
            if (buf) {
                for (let channel = 0; channel < maxChannels; channel++) {
                    const outputData = mergedBuffer.getChannelData(channel);
                    // 如果音軌通道不足，拷貝可用通道 (例如單聲道拷貝到雙聲道)
                    const sourceChannel = Math.min(channel, buf.numberOfChannels - 1);
                    const sourceData = buf.getChannelData(sourceChannel);
                    outputData.set(sourceData, currentOffset);
                }
                currentOffset += buf.length;

                // 加上靜音間隔
                let isLast = true;
                for (let j = i + 1; j < buffers.length; j++) {
                    if (buffers[j]) {
                        isLast = false;
                        break;
                    }
                }
                if (!isLast) {
                    currentOffset += silenceSamples;
                }
            }
        }

        return mergedBuffer;
    }

    // ===== 批次拼接執行核心 =====
    async function startMerge() {
        if (storeFiles.length === 0) {
            setMessage({ type: 'error', text: '請至少上傳一個店名音檔' });
            return;
        }

        // 必須至少有店名音檔，其餘固定音軌為選填 (增加使用彈性)
        const hasAnyFixed = introFile || bodyFile || outro1File || outro2File;
        if (!hasAnyFixed) {
            setMessage({ type: 'error', text: '請至少上傳一個固定音軌（例如開頭詞或播音詞）' });
            return;
        }

        setProcessing(true);
        setProgress(0);
        setProgressText('正在初始化音訊引擎...');
        setMessage(null);

        // 釋放舊的結果 Object URLs
        generatedResults.forEach(r => URL.revokeObjectURL(r.url));
        setGeneratedResults([]);

        try {
            const audioCtx = getAudioContext();

            // 1. 解碼已上傳的固定音軌
            setProgressText('正在解碼固定音軌...');
            let decodedIntro = null;
            let decodedBody = null;
            let decodedOutro1 = null;
            let decodedOutro2 = null;

            if (introFile) decodedIntro = await decodeFileToBuffer(audioCtx, introFile);
            if (bodyFile) decodedBody = await decodeFileToBuffer(audioCtx, bodyFile);
            if (outro1File) decodedOutro1 = await decodeFileToBuffer(audioCtx, outro1File);
            if (outro2File) decodedOutro2 = await decodeFileToBuffer(audioCtx, outro2File);

            const results = [];
            const silenceVal = parseFloat(silenceTime) || 0;

            // 2. 逐一解碼各店店名音檔，並拼接輸出
            for (let i = 0; i < storeFiles.length; i++) {
                const storeObj = storeFiles[i];
                setProgressText(`正在處理：${storeObj.storeName} (${i + 1}/${storeFiles.length})...`);
                
                // 解碼店名
                const decodedStore = await decodeFileToBuffer(audioCtx, storeObj.file);

                // 拼接結構：開頭詞 + 店名 + 播音詞 + 結尾詞 + 店名 + 結尾詞2
                const buffersToMerge = [
                    decodedIntro,
                    decodedStore,
                    decodedBody,
                    decodedOutro1,
                    decodedStore,
                    decodedOutro2
                ];

                // 進行拼接
                const mergedBuffer = mergeAudioBuffers(audioCtx, buffersToMerge, silenceVal);

                if (mergedBuffer) {
                    // 編碼成 WAV Blob
                    const wavBlob = bufferToWav(mergedBuffer);
                    const url = URL.createObjectURL(wavBlob);
                    
                    results.push({
                        storeName: storeObj.storeName,
                        blob: wavBlob,
                        url,
                        duration: mergedBuffer.duration,
                        durationText: mergedBuffer.duration.toFixed(1) + ' 秒'
                    });
                }

                // 更新進度
                setProgress(Math.round(((i + 1) / storeFiles.length) * 100));
            }

            setGeneratedResults(results);
            setMessage({ type: 'success', text: `成功生成 ${results.length} 間店的廣播播音檔！` });
            setProgressText('全部生成完成');
        } catch (err) {
            console.error('音訊拼接錯誤:', err);
            setMessage({ type: 'error', text: '音訊處理失敗，請確認上傳音檔格式是否正確' });
            setProgressText('生成失敗');
        } finally {
            setProcessing(false);
        }
    }

    // 打包 ZIP 下載
    async function handleDownloadAll() {
        if (generatedResults.length === 0) return;
        
        try {
            const zip = new JSZip();
            generatedResults.forEach(item => {
                zip.file(`${item.storeName}_廣播.wav`, item.blob);
            });
            
            const content = await zip.generateAsync({ type: 'blob' });
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            saveAs(content, `廣播批次生成_${dateStr}.zip`);
        } catch (err) {
            console.error('打包壓縮失敗:', err);
            setMessage({ type: 'error', text: '打包壓縮失敗，請重試或單獨下載' });
        }
    }

    return (
        <div className="admin-page-content">
            <div className="audio-merge-container">
                {/* 頂部 Header */}
                <div className="admin-content-header audio-merge-header">
                    <h2 className="admin-content-title">廣播音檔批次拼接系統</h2>
                    <p className="audio-merge-subtitle">透過網頁端高效處理音訊，依店名批次拼接出個別店鋪的廣播詞。</p>
                </div>

                {/* 訊息 banner */}
                {message && (
                    <div className={`message-banner ${message.type}`} id="status-message">
                        <span>{message.type === 'success' ? '✅' : '❌'}</span>
                        <span>{message.text}</span>
                    </div>
                )}

                {/* 網格佈局：左側上傳與設定，右側店名與列表 */}
                <div className="audio-merge-grid">
                    
                    {/* 左欄：固定音軌與設定 */}
                    <div className="flex-col-gap-24" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* 1. 固定音軌上傳 */}
                        <div className="apple-card">
                            <div className="card-title-area">
                                <h3 className="card-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    </svg>
                                    固定音軌 (選填)
                                </h3>
                                <span className="card-badge">系統記憶</span>
                            </div>

                            <div className="fixed-tracks-grid">
                                {/* 開頭詞 */}
                                <div 
                                    className={`track-upload-box ${dragOvers.intro ? 'drag-over' : ''} ${introFile ? 'has-file' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, 'intro')}
                                    onDragLeave={() => handleDragLeave('intro')}
                                    onDrop={(e) => handleDrop(e, 'intro')}
                                    onClick={() => !introFile && introInputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        ref={introInputRef}
                                        onChange={(e) => handleFixedTrack(e.target.files[0], 'intro')}
                                        accept="audio/*" 
                                        style={{ display: 'none' }}
                                    />
                                    <span className="track-type-tag">1. 開頭詞</span>
                                    {introFile ? (
                                        <>
                                            <div className="track-icon-wrapper" style={{ color: 'var(--brand)' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" title={introFile.name}>{introFile.name}</div>
                                            <div className="track-meta">{introInfo?.durationText}</div>
                                            <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                                                <button className="track-btn btn-play" onClick={() => togglePlay(introInfo.url, 'intro')}>
                                                    {playingId === 'intro' ? '暫停' : '試聽'}
                                                </button>
                                                <button className="track-btn btn-delete" onClick={() => removeFixedFile('intro')}>清除</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="track-icon-wrapper">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 5v14m-7-7h14"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" style={{ color: 'var(--text-secondary)' }}>點擊或拖放上傳</div>
                                        </>
                                    )}
                                </div>

                                {/* 播音詞 */}
                                <div 
                                    className={`track-upload-box ${dragOvers.body ? 'drag-over' : ''} ${bodyFile ? 'has-file' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, 'body')}
                                    onDragLeave={() => handleDragLeave('body')}
                                    onDrop={(e) => handleDrop(e, 'body')}
                                    onClick={() => !bodyFile && bodyInputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        ref={bodyInputRef}
                                        onChange={(e) => handleFixedTrack(e.target.files[0], 'body')}
                                        accept="audio/*" 
                                        style={{ display: 'none' }}
                                    />
                                    <span className="track-type-tag">2. 播音詞</span>
                                    {bodyFile ? (
                                        <>
                                            <div className="track-icon-wrapper" style={{ color: 'var(--brand)' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" title={bodyFile.name}>{bodyFile.name}</div>
                                            <div className="track-meta">{bodyInfo?.durationText}</div>
                                            <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                                                <button className="track-btn btn-play" onClick={() => togglePlay(bodyInfo.url, 'body')}>
                                                    {playingId === 'body' ? '暫停' : '試聽'}
                                                </button>
                                                <button className="track-btn btn-delete" onClick={() => removeFixedFile('body')}>清除</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="track-icon-wrapper">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 5v14m-7-7h14"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" style={{ color: 'var(--text-secondary)' }}>點擊或拖放上傳</div>
                                        </>
                                    )}
                                </div>

                                {/* 結尾詞 */}
                                <div 
                                    className={`track-upload-box ${dragOvers.outro1 ? 'drag-over' : ''} ${outro1File ? 'has-file' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, 'outro1')}
                                    onDragLeave={() => handleDragLeave('outro1')}
                                    onDrop={(e) => handleDrop(e, 'outro1')}
                                    onClick={() => !outro1File && outro1InputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        ref={outro1InputRef}
                                        onChange={(e) => handleFixedTrack(e.target.files[0], 'outro1')}
                                        accept="audio/*" 
                                        style={{ display: 'none' }}
                                    />
                                    <span className="track-type-tag">3. 結尾詞</span>
                                    {outro1File ? (
                                        <>
                                            <div className="track-icon-wrapper" style={{ color: 'var(--brand)' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" title={outro1File.name}>{outro1File.name}</div>
                                            <div className="track-meta">{outro1Info?.durationText}</div>
                                            <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                                                <button className="track-btn btn-play" onClick={() => togglePlay(outro1Info.url, 'outro1')}>
                                                    {playingId === 'outro1' ? '暫停' : '試聽'}
                                                </button>
                                                <button className="track-btn btn-delete" onClick={() => removeFixedFile('outro1')}>清除</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="track-icon-wrapper">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 5v14m-7-7h14"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" style={{ color: 'var(--text-secondary)' }}>點擊或拖放上傳</div>
                                        </>
                                    )}
                                </div>

                                {/* 結尾詞2 */}
                                <div 
                                    className={`track-upload-box ${dragOvers.outro2 ? 'drag-over' : ''} ${outro2File ? 'has-file' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, 'outro2')}
                                    onDragLeave={() => handleDragLeave('outro2')}
                                    onDrop={(e) => handleDrop(e, 'outro2')}
                                    onClick={() => !outro2File && outro2InputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        ref={outro2InputRef}
                                        onChange={(e) => handleFixedTrack(e.target.files[0], 'outro2')}
                                        accept="audio/*" 
                                        style={{ display: 'none' }}
                                    />
                                    <span className="track-type-tag">4. 結尾詞2</span>
                                    {outro2File ? (
                                        <>
                                            <div className="track-icon-wrapper" style={{ color: 'var(--brand)' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" title={outro2File.name}>{outro2File.name}</div>
                                            <div className="track-meta">{outro2Info?.durationText}</div>
                                            <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                                                <button className="track-btn btn-play" onClick={() => togglePlay(outro2Info.url, 'outro2')}>
                                                    {playingId === 'outro2' ? '暫停' : '試聽'}
                                                </button>
                                                <button className="track-btn btn-delete" onClick={() => removeFixedFile('outro2')}>清除</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="track-icon-wrapper">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 5v14m-7-7h14"/>
                                                </svg>
                                            </div>
                                            <div className="track-file-name" style={{ color: 'var(--text-secondary)' }}>點擊或拖放上傳</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. 拼接設定 */}
                        <div className="apple-card">
                            <div className="card-title-area">
                                <h3 className="card-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                    </svg>
                                    拼接流程與參數
                                </h3>
                            </div>

                            {/* 拼接視覺流程 */}
                            <div className="merge-flow-visual">
                                <div className="flow-title">拼接鏈條 (Chain)</div>
                                <div className="flow-steps">
                                    <div className="flow-step">開頭詞</div>
                                    <span className="flow-arrow">➔</span>
                                    <div className="flow-step accent">店名音檔</div>
                                    <span className="flow-arrow">➔</span>
                                    <div className="flow-step">播音詞</div>
                                    <span className="flow-arrow">➔</span>
                                    <div className="flow-step">結尾詞</div>
                                    <span className="flow-arrow">➔</span>
                                    <div className="flow-step accent">店名音檔</div>
                                    <span className="flow-arrow">➔</span>
                                    <div className="flow-step">結尾詞2</div>
                                </div>
                            </div>

                            <div className="settings-list">
                                <div className="setting-item">
                                    <div className="setting-label-area">
                                        <span className="setting-label">段落間隔靜音</span>
                                        <span className="setting-desc">音軌段落之間插入的空白時間</span>
                                    </div>
                                    <div className="setting-input-wrapper">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max="5" 
                                            step="0.1" 
                                            value={silenceTime} 
                                            onChange={(e) => setSilenceTime(parseFloat(e.target.value) || 0)}
                                            className="setting-input"
                                        />
                                        <span className="setting-unit">秒</span>
                                    </div>
                                </div>
                            </div>

                            {/* 生成按鈕 */}
                            <div className="audio-merge-actions-bar">
                                <button 
                                    className="btn btn-primary btn-full"
                                    onClick={startMerge}
                                    disabled={processing || storeFiles.length === 0}
                                    id="start-merge-btn"
                                >
                                    {processing ? '正在批次拼接中...' : `開始批次生成 (${storeFiles.length} 間店)`}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 右欄：店名音檔與生成進度 */}
                    <div className="flex-col-gap-24" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* 批次店名音檔上傳 */}
                        <div className="apple-card">
                            <div className="card-title-area">
                                <h3 className="card-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    店名音檔 (批次上傳，最多10個)
                                </h3>
                                {storeFiles.length > 0 && (
                                    <button className="btn btn-sm btn-outline" onClick={clearAllStores} id="clear-stores-btn">一鍵清空</button>
                                )}
                            </div>

                            <div 
                                className={`store-upload-zone ${dragOvers.stores ? 'drag-over' : ''}`}
                                onDragOver={(e) => handleDragOver(e, 'stores')}
                                onDragLeave={() => handleDragLeave('stores')}
                                onDrop={(e) => handleDrop(e, 'stores')}
                                onClick={() => storesInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={storesInputRef}
                                    onChange={(e) => handleStoreTracks(e.target.files)}
                                    multiple 
                                    accept="audio/*" 
                                    style={{ display: 'none' }}
                                />
                                <div className="store-upload-prompt">
                                    <div className="upload-icon">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                                        </svg>
                                    </div>
                                    <span className="upload-main-text">批次上傳店名音檔</span>
                                    <span className="upload-sub-text">檔名即為店名，例如：台北旗艦店.mp3 (支援多選)</span>
                                </div>
                            </div>

                            {/* 店名音檔列表 */}
                            {storeFiles.length > 0 ? (
                                <div className="store-files-list">
                                    {storeFiles.map((sf, index) => (
                                        <div key={sf.id} className="store-file-item">
                                            <div className="store-file-info">
                                                <div className="store-file-num">{index + 1}</div>
                                                <div className="store-file-name-text" title={sf.storeName}>
                                                    {sf.storeName}
                                                </div>
                                                <div className="store-file-meta">
                                                    {sf.durationText}
                                                </div>
                                            </div>
                                            <div className="store-file-actions">
                                                <button 
                                                    className={`action-icon-btn btn-play ${playingId === sf.id ? 'playing' : ''}`}
                                                    onClick={() => togglePlay(sf.url, sf.id)}
                                                    title="試聽"
                                                >
                                                    {playingId === sf.id ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                            <rect x="4" y="4" width="16" height="16"/>
                                                        </svg>
                                                    ) : (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                            <polygon points="5 3 19 12 5 21 5 3"/>
                                                        </svg>
                                                    )}
                                                </button>
                                                <button 
                                                    className="action-icon-btn btn-delete" 
                                                    onClick={() => removeStoreFile(sf.id)}
                                                    title="移除"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    尚未上傳任何店名音軌。
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 生成進度條面版 */}
                {(processing || progress > 0) && (
                    <div className="progress-panel">
                        <div className="progress-header">
                            <span className="progress-status">{progressText}</span>
                            <span className="progress-percentage">{progress}%</span>
                        </div>
                        <div className="progress-track">
                            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                )}

                {/* 3. 拼接結果列表 */}
                {generatedResults.length > 0 && (
                    <div className="apple-card results-section">
                        <div className="results-actions-top">
                            <div>
                                <h3 className="card-title" style={{ border: 'none', marginBottom: '0' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>
                                    </svg>
                                    生成播音檔結果
                                </h3>
                                <div className="results-count">共生成 {generatedResults.length} 個音訊檔</div>
                            </div>
                            <button className="btn btn-primary" onClick={handleDownloadAll} id="download-zip-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 3v12"/>
                                </svg>
                                下載全部 (ZIP)
                            </button>
                        </div>

                        <div className="results-grid">
                            {generatedResults.map((result, index) => (
                                <div key={index} className="result-card">
                                    <div className="result-info">
                                        <span className="result-name">{result.storeName}_廣播播音.wav</span>
                                        <span className="result-meta">時長：{result.durationText} | 格式：WAV</span>
                                    </div>
                                    <div className="result-actions">
                                        <button 
                                            className={`track-btn btn-play ${playingId === `result-${index}` ? 'playing' : ''}`}
                                            onClick={() => togglePlay(result.url, `result-${index}`)}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                {playingId === `result-${index}` ? (
                                                    <rect x="4" y="4" width="16" height="16"/>
                                                ) : (
                                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                                )}
                                            </svg>
                                            {playingId === `result-${index}` ? '暫停' : '試聽'}
                                        </button>
                                        <button 
                                            className="track-btn btn-outline"
                                            onClick={() => saveAs(result.blob, `${result.storeName}_廣播.wav`)}
                                        >
                                            下載
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AudioMergePage;
