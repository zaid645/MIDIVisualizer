import { AppState } from './state.js';
import { Utils } from './utils.js';
import { Renderer } from './renderer.js';
import { Exporter } from './exporter.js';

const MainApp = {
    elements: {},

    init() {
        this.elements = {
            audioPlayer: document.getElementById('audio-player'),
            btnPlay: document.getElementById('btn-play'),
            btnStop: document.getElementById('btn-stop'),
            btnExport: document.getElementById('btn-export'),
            btnCancel: document.getElementById('btn-cancel'),
            // ... (elemen lainnya tetap sama)
        };

        Renderer.init();
        Exporter.setUIHandler(this);
        this.bindEvents();
        
        // Pengecekan awal saat startup
        Utils.checkReadyStatus();
    },

    bindEvents() {
        // Event input MIDI
        document.getElementById('midi-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                Utils.log(`Membaca MIDI: ${file.name}`);
                const arrayBuffer = await file.arrayBuffer();
                AppState.parsedMidi = new Midi(arrayBuffer);
                
                // 1. Generate visual tracks
                AppState.trackColors = Utils.generateColors(AppState.parsedMidi.tracks.length);
                this.buildTrackUI();
                
                // 2. Render frame pertama sebagai preview
                Renderer.drawFrame(0);

                // 3. KRUSIAL: Panggil pengecekan status agar tombol ekspor menyala
                Utils.checkReadyStatus();
                
                Utils.log(`MIDI Siap. Tombol ekspor diaktifkan.`, "info");
            } catch (err) {
                Utils.log(`Error Midi: ${err.message}`, "error");
            }
        });

        // Event input Audio
        document.getElementById('audio-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.elements.audioPlayer.src = URL.createObjectURL(file);
            this.elements.audioPlayer.onloadedmetadata = () => {
                Utils.log(`Audio dimuat.`);
                // Cek status lagi setelah audio masuk (untuk mengaktifkan tombol Play)
                Utils.checkReadyStatus();
            };
        });

        // ... (sisanya tetap sama seperti sebelumnya)
    },

    // ... (metode buildTrackUI, stopPlayback, dll tetap sama)
};

window.addEventListener('DOMContentLoaded', () => {
    MainApp.init();
});