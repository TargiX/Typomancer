import React, { useEffect, useRef, useState } from 'react';
import { ComicFrame, Language } from '../types';

interface StatChip {
  label: string;
  value: string;
}

interface RunComicUI {
  building: string;
  ready: string;
  error: string;
  share: string;
  download: string;
  close: string;
  copied: string;
  replay_label: string;
  watermark: string;
}

interface RunComicProps {
  frames: ComicFrame[];
  title: string;
  endingTitle: string;
  outcome: 'victory' | 'defeat';
  tagline: string;
  stats: StatChip[];
  shareText: string;
  language: Language;
  ui: RunComicUI;
  onClose: () => void;
}

const PERF_COLORS: Record<string, string> = {
  good: '#34d399',
  average: '#fbbf24',
  bad: '#f43f5e',
  neutral: '#64748b'
};

const W = 640;
const PAD = 28;
const IMG_H = 360;
const CAPTION_H = 82;
const SCALE = 2;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && !lines.includes(line)) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

// Pick up to `max` frames spread evenly across the run so the comic tells the
// whole arc rather than only the final moments.
const pickFrames = (frames: ComicFrame[], max: number): ComicFrame[] => {
  const usable = frames.filter(f => f.caption && f.caption.trim().length > 0);
  if (usable.length <= max) return usable;
  const picked: ComicFrame[] = [];
  const step = (usable.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) picked.push(usable[Math.round(i * step)]);
  return picked;
};

const renderComic = async (
  canvas: HTMLCanvasElement,
  props: Pick<RunComicProps, 'frames' | 'title' | 'endingTitle' | 'outcome' | 'tagline' | 'stats' | 'ui'>
): Promise<void> => {
  const { frames, title, endingTitle, outcome, tagline, stats, ui } = props;
  const selected = pickFrames(frames, 6);
  const accent = outcome === 'victory' ? '#34d399' : '#f43f5e';

  const measureCtx = canvas.getContext('2d');
  if (!measureCtx) throw new Error('no-2d-context');

  const contentW = W - PAD * 2;

  measureCtx.font = '600 15px "JetBrains Mono", monospace';
  const taglineLines = tagline ? wrapText(measureCtx, `“${tagline}”`, contentW, 3) : [];

  measureCtx.font = '700 30px "Space Grotesk", "JetBrains Mono", sans-serif';
  const endingLines = wrapText(measureCtx, endingTitle, contentW, 2);

  const headerH = 44 + endingLines.length * 34 + (taglineLines.length ? 10 + taglineLines.length * 22 : 0) + 24;
  const framesH = selected.length * (IMG_H + CAPTION_H + 16);
  const footerH = 150;
  const totalH = headerH + framesH + footerH;

  canvas.width = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  const bg = ctx.createLinearGradient(0, 0, 0, totalH);
  bg.addColorStop(0, '#0b101a');
  bg.addColorStop(1, '#05070c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, totalH);

  // subtle dotted texture
  ctx.fillStyle = 'rgba(148,163,184,0.05)';
  for (let y = 0; y < totalH; y += 22) {
    for (let x = 0; x < W; x += 22) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // top accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 3);

  // --- Header ---
  let y = 40;
  ctx.textAlign = 'left';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillStyle = accent;
  ctx.fillText(title.toUpperCase(), PAD, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.fillText(ui.replay_label.toUpperCase(), W - PAD, y);
  ctx.textAlign = 'left';

  y += 26;
  ctx.font = '700 30px "Space Grotesk", "JetBrains Mono", sans-serif';
  ctx.fillStyle = '#f8fafc';
  for (const line of endingLines) {
    ctx.fillText(line, PAD, y);
    y += 34;
  }

  if (taglineLines.length) {
    y += 6;
    ctx.font = 'italic 600 15px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(203,213,225,0.82)';
    for (const line of taglineLines) {
      ctx.fillText(line, PAD, y);
      y += 22;
    }
  }

  y = headerH;

  // --- Frames ---
  for (let i = 0; i < selected.length; i++) {
    const frame = selected[i];
    const perfColor = PERF_COLORS[frame.performance] || PERF_COLORS.neutral;
    const imgY = y;

    ctx.save();
    drawRoundedRect(ctx, PAD, imgY, contentW, IMG_H, 10);
    ctx.clip();
    if (frame.image) {
      try {
        const img = await loadImage(frame.image);
        const iw = img.naturalWidth || 960;
        const ih = img.naturalHeight || 540;
        const scale = Math.max(contentW / iw, IMG_H / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(img, PAD + (contentW - dw) / 2, imgY + (IMG_H - dh) / 2, dw, dh);
      } catch {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(PAD, imgY, contentW, IMG_H);
      }
    } else {
      const grad = ctx.createLinearGradient(PAD, imgY, PAD + contentW, imgY + IMG_H);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(PAD, imgY, contentW, IMG_H);
    }
    // bottom vignette for caption legibility
    const vg = ctx.createLinearGradient(0, imgY + IMG_H - 90, 0, imgY + IMG_H);
    vg.addColorStop(0, 'rgba(5,7,12,0)');
    vg.addColorStop(1, 'rgba(5,7,12,0.85)');
    ctx.fillStyle = vg;
    ctx.fillRect(PAD, imgY + IMG_H - 90, contentW, 90);
    ctx.restore();

    // frame border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, PAD, imgY, contentW, IMG_H, 10);
    ctx.stroke();

    // panel number badge
    ctx.fillStyle = perfColor;
    ctx.beginPath();
    ctx.arc(PAD + 24, imgY + 24, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05070c';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), PAD + 24, imgY + 25);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // caption band
    const capY = imgY + IMG_H + 8;
    ctx.font = '500 15px "JetBrains Mono", monospace';
    const capLines = wrapText(ctx, frame.caption.trim(), contentW - 16, 2);
    ctx.fillStyle = 'rgba(226,232,240,0.92)';
    let cy = capY + 20;
    for (const line of capLines) {
      ctx.fillText(line, PAD + 4, cy);
      cy += 20;
    }
    // perf tick
    ctx.fillStyle = perfColor;
    ctx.fillRect(PAD, capY + 2, 3, capLines.length * 20);

    y += IMG_H + CAPTION_H + 16;
  }

  // --- Footer ---
  const footerY = totalH - footerH;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(PAD, footerY, contentW, 1);

  const chipCount = Math.min(stats.length, 4);
  if (chipCount > 0) {
    const gap = 12;
    const chipW = (contentW - gap * (chipCount - 1)) / chipCount;
    const chipH = 62;
    const chipY = footerY + 22;
    for (let i = 0; i < chipCount; i++) {
      const cx = PAD + i * (chipW + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      drawRoundedRect(ctx, cx, chipY, chipW, chipH, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      drawRoundedRect(ctx, cx, chipY, chipW, chipH, 8);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(148,163,184,0.75)';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(stats[i].label.toUpperCase(), cx + chipW / 2, chipY + 24);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 20px "Space Grotesk", "JetBrains Mono", sans-serif';
      ctx.fillText(stats[i].value, cx + chipW / 2, chipY + 48);
    }
    ctx.textAlign = 'left';
  }

  // watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(148,163,184,0.55)';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(ui.watermark, W / 2, totalH - 26);
  ctx.textAlign = 'left';
};

const RunComic: React.FC<RunComicProps> = ({
  frames,
  title,
  endingTitle,
  outcome,
  tagline,
  stats,
  shareText,
  language,
  ui,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'rendering' | 'ready' | 'error'>('rendering');
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderComic(canvas, { frames, title, endingTitle, outcome, tagline, stats, ui })
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof (navigator as Navigator).canShare === 'function') {
      try {
        const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
        setCanShare(navigator.canShare({ files: [probe] }));
      } catch {
        setCanShare(false);
      }
    }
  }, []);

  const toBlob = (): Promise<Blob | null> =>
    new Promise(resolve => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });

  const fileName = `narrative-flow-${outcome}-${Date.now()}.png`;

  const handleDownload = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title, text: shareText });
    } catch {
      // user cancelled or share failed — fall back to download
      await handleDownload();
    }
  };

  const handleCopy = async () => {
    try {
      const blob = await toBlob();
      if (!blob || !navigator.clipboard || !('write' in navigator.clipboard)) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unsupported — ignore */
    }
  };

  const supportsClipboard =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof (navigator.clipboard as Clipboard).write === 'function' &&
    typeof ClipboardItem !== 'undefined';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-label={ui.replay_label}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-slate-900/80 border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded-lg block"
            style={{ imageRendering: 'auto' }}
            aria-label={`${title} — ${endingTitle}`}
          />
          {status === 'rendering' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60 pointer-events-none">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              <span className="text-emerald-400 text-sm tracking-widest animate-pulse">{ui.building}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-rose-300 text-sm px-6 text-center">
              {ui.error}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2 p-3 border-t border-white/10 bg-slate-950/60">
          {canShare && (
            <button
              onClick={handleShare}
              disabled={status !== 'ready'}
              className="btn-cyber btn-cyber-primary flex-1 min-w-[120px] py-2.5 font-display font-bold tracking-[0.06em] text-[#04120b] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ui.share}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={status !== 'ready'}
            className="btn-cyber btn-cyber-ghost flex-1 min-w-[120px] py-2.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ui.download}
          </button>
          {supportsClipboard && (
            <button
              onClick={handleCopy}
              disabled={status !== 'ready'}
              className="h-[42px] px-4 text-[11px] font-bold uppercase tracking-[0.14em] rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              {copied ? ui.copied : '⧉'}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={ui.close}
            className="h-[42px] px-4 text-[11px] font-bold uppercase tracking-[0.14em] rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunComic;
