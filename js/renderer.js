// Hanya fokus pada perhitungan kanvas, penggambaran frame, dan rotasi/orientasi visual.

import { AppState } from './state.js';

export const Renderer = {
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.getElementById('visualizer-canvas');
        if(this.canvas) this.ctx = this.canvas.getContext('2d', { alpha: false });
    },

    updateCanvasSize() {
        const height = AppState.resolution;
        const width = Math.floor(height * (16 / 9) / 2) * 2;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        return { width, height };
    },

    drawFrame(timeInSeconds) {
        if (!this.ctx) return;
        
        const { width, height } = this.updateCanvasSize();
        const isHorizontal = AppState.orientation === 'horizontal';

        // Bersihkan Background
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, width, height);

        if (!AppState.parsedMidi) return;

        // Hitung Rasio dan Skala
        const keySize = isHorizontal ? (height / AppState.TOTAL_KEYS) : (width / AppState.TOTAL_KEYS);
        const pixelsPerSecond = AppState.speed * (height / 1080);

        this.ctx.strokeStyle = '#1f2937';
        this.ctx.lineWidth = 1;

        if (isHorizontal) {
            for(let i = 0; i <= AppState.TOTAL_KEYS; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, i * keySize);
                this.ctx.lineTo(width, i * keySize);
                this.ctx.stroke();
            }
            const hitLineX = width * 0.15;
            this.ctx.fillStyle = '#1e293b';
            this.ctx.fillRect(0, 0, hitLineX, height);
            this.ctx.strokeStyle = '#64748b';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(hitLineX, 0);
            this.ctx.lineTo(hitLineX, height);
            this.ctx.stroke();

            this._drawNotes(timeInSeconds, isHorizontal, keySize, pixelsPerSecond, hitLineX);
        } else {
            for(let i = 0; i <= AppState.TOTAL_KEYS; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(i * keySize, 0);
                this.ctx.lineTo(i * keySize, height);
                this.ctx.stroke();
            }
            const hitLineY = height - (height * 0.15);
            this.ctx.fillStyle = '#1e293b';
            this.ctx.fillRect(0, hitLineY, width, height * 0.15);
            this.ctx.strokeStyle = '#64748b';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, hitLineY);
            this.ctx.lineTo(width, hitLineY);
            this.ctx.stroke();

            this._drawNotes(timeInSeconds, isHorizontal, keySize, pixelsPerSecond, hitLineY);
        }

        this._drawText(width, height);
    },

    _drawNotes(timeInSeconds, isHorizontal, keySize, pixelsPerSecond, hitLinePos) {
        AppState.parsedMidi.tracks.forEach((track, trackIndex) => {
            if (!AppState.trackVisibility[trackIndex]) return;

            const baseColor = AppState.trackColors[trackIndex];
            const colorParts = baseColor.match(/\d+/g);
            this.ctx.fillStyle = `hsla(${colorParts[0]}, ${colorParts[1]}%, ${colorParts[2]}%, 0.85)`;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 1;

            track.notes.forEach(note => {
                const timeDiffStart = note.time - timeInSeconds;
                const timeDiffEnd = (note.time + note.duration) - timeInSeconds;
                const keyIndex = Math.max(0, Math.min(note.midi - AppState.MIN_MIDI, AppState.TOTAL_KEYS - 1));

                let x, y, w, h;

                if (isHorizontal) {
                    const xStart = hitLinePos + (timeDiffStart * pixelsPerSecond);
                    const xEnd = hitLinePos + (timeDiffEnd * pixelsPerSecond);
                    w = xEnd - xStart;
                    h = keySize - 2;
                    x = xStart;
                    y = (AppState.TOTAL_KEYS - 1 - keyIndex) * keySize;
                    if (x > this.canvas.width || xEnd < 0) return; 

                } else {
                    const yStart = hitLinePos - (timeDiffStart * pixelsPerSecond);
                    const yEnd = hitLinePos - (timeDiffEnd * pixelsPerSecond);
                    w = keySize - 2;
                    h = yStart - yEnd;
                    x = keyIndex * keySize;
                    y = yEnd;
                    if (y > this.canvas.height || yStart < 0) return; 
                }

                this.ctx.fillRect(x + 1, y + 1, w, h);
                this.ctx.strokeRect(x + 1, y + 1, w, h);
            });
        });
    },

    _drawText(width, height) {
        if (!AppState.titleText && !AppState.subtitleText) return;
        this.ctx.textAlign = 'right';
        const paddingRight = width * 0.03;
        let currentY = height * 0.08;

        if (AppState.titleText) {
            const titleFontSize = Math.max(12, Math.floor(height * 0.05));
            this.ctx.font = `bold ${titleFontSize}px 'Segoe UI', sans-serif`;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(AppState.titleText, width - paddingRight, currentY);
            currentY += titleFontSize * 1.3;
        }

        if (AppState.subtitleText) {
            const subFontSize = Math.max(10, Math.floor(height * 0.03));
            this.ctx.font = `${subFontSize}px 'Segoe UI', sans-serif`;
            this.ctx.fillStyle = '#94a3b8';
            this.ctx.fillText(AppState.subtitleText, width - paddingRight, currentY);
        }
    }
};
