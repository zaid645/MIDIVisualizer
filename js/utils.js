/**
 * 1. Update pada js/utils.js
 * Mengubah pengecekan agar tombol ekspor aktif meski audio belum ada.
 */
export const Utils = {
    // ... fungsi lainnya
    checkReadyStatus() {
        const btnExport = document.getElementById('btn-export');
        const btnPlay = document.getElementById('btn-play');
        const audioPlayer = document.getElementById('audio-player');

        // Tombol Ekspor aktif jika ada MIDI
        if (AppState.parsedMidi) {
            btnExport.disabled = false;
        }

        // Tombol Play hanya aktif jika ada MIDI DAN Audio (untuk preview real-time)
        if (AppState.parsedMidi && audioPlayer.src) {
            btnPlay.disabled = false;
        }
    }
};

/**
 * 2. Update pada js/exporter.js
 * Menyesuaikan penentuan durasi video jika audio tidak dimuat.
 */
export const Exporter = {
    // ...
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
            
            // ... (Logika render loop sama seperti sebelumnya) ...

            // Di akhir proses ekspor:
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
    }
};