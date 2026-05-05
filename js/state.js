// Menyimpan semua variabel state global. Diekspor agar bisa diakses oleh file lain.

export const AppState = {
    parsedMidi: null,
    trackColors: [],
    trackVisibility: [],
    isPlaying: false,
    isExporting: false,
    cancelRequested: false,
    animationFrameId: null,
    
    // Konfigurasi Visual & Render
    orientation: 'horizontal',
    speed: 400,
    resolution: 360,
    fps: 30,
    
    // Teks
    titleText: '',
    subtitleText: '',

    // Konstanta Piano
    MIN_MIDI: 21,
    MAX_MIDI: 108,
    get TOTAL_KEYS() { return this.MAX_MIDI - this.MIN_MIDI + 1; },

    // File blobs
    finalVideoBlob: null,
    finalAudioVideoBlob: null
};