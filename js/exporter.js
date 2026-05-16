// Berisi logika untuk Muxer dan FFmpeg. Mengambil referensi canvas dari modul Renderer.

import { AppState } from './state.js';
import { Utils } from './utils.js';
import { Renderer } from './renderer.js';
// uiHandler disuntikkan dari main.js untuk menghindari circular dependency

export const Exporter = {
    ffmpegInstance: null,
    uiHandler: null, // Akan di-set dari main.js

    setUIHandler(handler) {
        this.uiHandler = handler;
    },

    async loadFFmpeg() {
        if (this.ffmpegInstance) return this.ffmpegInstance;
        
        return new Promise((resolve, reject) => {
            Utils.log("Memuat engine FFmpeg dari CDN...", "warn");
            const script = document.createElement('script');
            script.src = '[https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js](https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js)';
            
            script.onload = async () => {
                try {
                    const { createFFmpeg } = FFmpeg;
                    this.ffmpegInstance = createFFmpeg({ 
                        log: false,
                        corePath: '[https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js](https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js)',
                        progress: ({ ratio }) => {
                            if (ratio >= 0 && ratio <= 1 && this.uiHandler) {
                                const percent = Math.round(ratio * 100);
                                this.uiHandler.updateProgress(percent, `${percent}%`, true);
                            }
                        }
                    });
                    Utils.log("Engine FFmpeg berhasil dimuat.", "info");
                    resolve(this.ffmpegInstance);
                } catch (e) {
                    Utils.log("Gagal inisialisasi FFmpeg.", "error");
                    reject(e);
                }
            };
            script.onerror = () => reject(new Error("Gagal mengunduh skrip FFmpeg"));
            document.head.appendChild(script);
        });
    },

    async startExport() {
        if (!AppState.parsedMidi) return; // Cukup cek MIDI saja
        
        const audioPlayer = document.getElementById('audio-player');
        const audioFile = document.getElementById('audio-input').files[0];
        const useFfmpeg = document.getElementById('use-ffmpeg').checked;
        
        try {
            if (this.uiHandler) this.uiHandler.setExportingState(true);

            // Tentukan durasi: 
            // Jika ada audio, gunakan durasi audio. 
            // Jika tidak, gunakan waktu not terakhir di MIDI.
            let duration = 0;
            if (audioPlayer.src && !isNaN(audioPlayer.duration)) {
                duration = audioPlayer.duration;
            } else {
                // Cari not terakhir dari semua track
                AppState.parsedMidi.tracks.forEach(track => {
                    track.notes.forEach(note => {
                        const endTime = note.time + note.duration;
                        if (endTime > duration) duration = endTime;
                    });
                });
                duration += 2; // Beri sedikit buffer (2 detik) di akhir
            }

            const fps = AppState.fps;
            const totalFrames = Math.ceil(duration * fps);
            const { width, height } = Renderer.updateCanvasSize();

            Utils.log(`Mulai render ${totalFrames} frame (${width}x${height} @ ${fps}fps).`);
            
            let muxer = new WebMMuxer.Muxer({
                target: new WebMMuxer.ArrayBufferTarget(),
                video: { codec: 'V_VP9', width, height, framerate: fps }
            });

            let videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => Utils.log(`Encoder Error: ${e}`, "error")
            });

            videoEncoder.configure({
                codec: 'vp09.00.10.08', width, height, bitrate: 5_000_000,
            });

            for (let i = 0; i < totalFrames; i++) {
                if (AppState.cancelRequested) {
                    videoEncoder.close();
                    throw new Error("Dibatalkan oleh pengguna.");
                }

                const currentTime = i / fps;
                Renderer.drawFrame(currentTime);
                
                const frame = new VideoFrame(Renderer.canvas, { timestamp: (i * 1_000_000) / fps });
                videoEncoder.encode(frame, { keyFrame: (i % fps === 0) });
                frame.close();

                if (i % 10 === 0 || i === totalFrames - 1) {
                    const progress = ((i + 1) / totalFrames) * 100;
                    if (this.uiHandler) {
                        this.uiHandler.updateProgress(progress, `Frame ${i + 1} / ${totalFrames}`, false);
                    }
                    await new Promise(r => setTimeout(r, 0));
                }

                while (videoEncoder.encodeQueueSize > 10) {
                    if(AppState.cancelRequested) break;
                    await new Promise(r => setTimeout(r, 5));
                }
            }

            if(AppState.cancelRequested) throw new Error("Dibatalkan oleh pengguna.");

            Utils.log("Menyimpan file video...");
            await videoEncoder.flush();
            muxer.finalize();
            videoEncoder.close();

            AppState.finalVideoBlob = new Blob([muxer.target.buffer], { type: 'video/webm' });
            if (this.uiHandler) this.uiHandler.showDownloadPanel(true, false);
            
            // Hanya jalankan Muxing Audio jika user mencentang FFmpeg DAN file audio tersedia
            if (useFfmpeg && this.ffmpegInstance && audioFile) {
                await this._muxAudioAndVideo();
            } else {
                Utils.log("Proses Video selesai tanpa audio.");
                if(this.uiHandler) {
                    this.uiHandler.showDownloadPanel(true, false);
                    // Update status teks UI secara manual jika tidak lewat muxing
                    const statusText = document.getElementById('dl-status-text');
                    statusText.textContent = "✅ Render Video Selesai!";
                    statusText.className = "text-xs font-bold text-green-400 text-center";
                }
            }

        } catch (err) {
            Utils.log(err.message, "warn");
        } finally {
            if (this.uiHandler) this.uiHandler.setExportingState(false);
        }
    },

    async _muxAudioAndVideo() {
        try {
            if(this.uiHandler) this.uiHandler.setMuxingState();
            
            Utils.log("Mulai injeksi audio...");
            if (!this.ffmpegInstance.isLoaded()) await this.ffmpegInstance.load();

            const videoArray = new Uint8Array(await AppState.finalVideoBlob.arrayBuffer());
            this.ffmpegInstance.FS('writeFile', 'v.webm', videoArray);
            
            const audioFile = document.getElementById('audio-input').files[0];
            const audioExt = audioFile.name.split('.').pop();
            const audioArray = new Uint8Array(await audioFile.arrayBuffer());
            this.ffmpegInstance.FS('writeFile', `a.${audioExt}`, audioArray);

            await this.ffmpegInstance.run('-i', 'v.webm', '-i', `a.${audioExt}`, '-c:v', 'copy', '-c:a', 'aac', '-shortest', 'out.mp4');
            
            const data = this.ffmpegInstance.FS('readFile', 'out.mp4');
            AppState.finalAudioVideoBlob = new Blob([data.buffer], { type: 'video/mp4' });
            
            Utils.log("Proses lengkap! Silakan unduh hasil.", "info");
            if(this.uiHandler) this.uiHandler.setMuxingComplete();
            
        } catch (e) {
            Utils.log(`FFmpeg Error: ${e.message}`, "error");
            if(this.uiHandler) this.uiHandler.setMuxingError();
        }
    }
};