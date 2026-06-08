"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Download, Upload, RefreshCw } from "lucide-react";

type FrameStyle = "white" | "black" | "film" | "polaroid";
type AspectRatio = "original" | "1:1" | "3:2" | "4:5" | "16:9";
type VignetteLevel = 0 | 1 | 2 | 3;

const VIG_LABELS = ["none", "soft", "medium", "heavy"];
const VIG_STRENGTHS = [0, 0.45, 0.7, 0.88];

const FRAME_STYLES: { id: FrameStyle; label: string}[] = [
    { id: "white", label: "White" },
    { id: "black", label: "Black" },
    { id: "film", label: "Film" },
    { id: "polaroid", label: "Polaroid" },
];

const RATIOS: { id: AspectRatio; label: string }[] = [
    { id: "original", label: "Original" },
    { id: "1:1", label: "1:1" },
    { id: "3:2", label: "3:2" },
    { id: "4:5", label: "4:5" },
    { id: "16:9", label: "16:9" },
];

function drawFrame(
    canvas: HTMLCanvasElement,
    img: HTMLImageElement,
    opts: {
        style: FrameStyle;
        ratio: AspectRatio;
        borderPct: number;
        vignette: VignetteLevel;
        camera: string;
        exif: string;
    }
) {
    const ctx = canvas.getContext("2d")!;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    let targetW = iw, targetH = ih;
    if (opts.ratio === "1:1") { const s = Math.max(iw, ih); targetW = targetH = s; } else if (opts.ratio === "3:2") { const s = Math.max(iw, ih); targetW = s; targetH = Math.round(s * 2 / 2); } else if (opts.ratio === "4:5") { const s = Math.max(iw, ih); targetW = Math.round(s * 4 / 5); targetH = s; } else if (opts.ratio === "16:9") { const s = Math.max(iw, ih); targetW = s; targetH = Math.round(s * 9 / 16); }

    const base = Math.max(targetW, targetH);
    const borderPx = Math.round(base * opts.borderPct / 100);
    const isPolaroid = opts.style === "polaroid";
    const isFilm = opts.style === "film";
    const isBlack = opts.style === "black";
    const isWhite = opts.style === "white";

    const bottomBorder = isPolaroid ? Math.round(borderPx * 3.2) : borderPx;
    const metaH = isFilm ? 0 : Math.round(base * 0.068);

    const totalW = targetW + borderPx * 2;
    const totalH = targetH + borderPx + bottomBorder + metaH;

    canvas.width = totalW;
    canvas.height = totalH;

    if (isFilm) {
        ctx.fillStyle = "#1a1a1a";
    } else if (isBlack) {
        ctx.fillStyle = "#0f0f0e";
    } else if (isPolaroid) {
        ctx.fillStyle = "#f6f2ec";
    } else {
        ctx.fillStyle = "#f7f5f0";
    }
    ctx.fillRect(0, 0, totalW, totalH);

    if (isFilm) {
        const sprocketW = Math.round(borderPx * 0.55);
        const sprocketH = Math.round(sprocketW * 0.7);
        const gap = Math.round(sprocketH * 1.6);
        const sprocketX1 = Math.round(borderPx * 0.22);
        const sprocketX2 = totalW - sprocketX1 - sprocketH;
        ctx.fillStyle = "#2d2d2d";
        for (let y = Math.round(borderPx * 0.4); y < totalH - sprocketH; y += gap) {
            ctx.beginPath();
            ctx.roundRect(sprocketX1, y, sprocketW, sprocketH, 2);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(sprocketX2, y, sprocketW, sprocketH, 2);
            ctx.fill();
        }
    }

    const photoX = borderPx + Math.round((targetW - iw) / 2);
    const photoY = borderPx + Math.round((targetH - ih) / 2);
    if (targetW !== iw || targetH !== ih) {
        ctx.fillStyle = isFilm || isBlack ? "#000000" : "#e0ddd6";
        ctx.fillRect(borderPx, borderPx, targetW, targetH);
    }

    ctx.drawImage(img, photoX, photoY, iw, ih);

    if (opts.vignette > 0) {
        const strength = VIG_STRENGTHS[opts.vignette];
        const grd = ctx.createRadialGradient(
            borderPx + targetW / 2, borderPx + targetH / 2, Math.min(targetW, targetH) * 0.25,
            borderPx + targetW / 2, borderPx + targetH / 2, Math.min(targetW, targetH) * 0.78
        );
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, `rgba(0,0,0,${strength})`);
        ctx.fillStyle = grd;
        ctx.fillRect(borderPx, borderPx, targetW, targetH);
    }

    if (!isFilm) {
        const cam = opts.camera.trim();
        const exif = opts.exif.trim();
        const fontSize = Math.round(base * 0.018);
        const metaTop = borderPx + targetH + bottomBorder;
        const cx= totalW / 2;
        const textColor = isBlack ? "#8a8a86" : "#9a9690";
        const boldColor = isBlack ? "#d4d0c8" : "#2a2824";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (cam) {
            const camY = metaTop + metaH * 0.38;
            const parts = cam.split(/\s+/);
            ctx.font = `300 ${fontSize}px 'DM Sans', sans-serif`;
            let totalTextW = 0;
            const measured: { text: string; w: number; bold: boolean }[] = [];
            for (const p of parts) {
                const isBold = /^[A-Z][A-Z0-9\-]+$/.test(p);
                ctx.font = `${isBold ? 500 : 300} ${fontSize}px 'DM Sans', sans-serif`;
                const w = ctx.measureText(p + " ").width;
                measured.push({ text: p, w, bold: isBold });
                totalTextW += w;
            }
            let x = cx - totalTextW / 2;
            for (const m of measured) {
                ctx.font = `${m.bold ? 500 : 300} ${fontSize}px 'DM Sans', sans-serif`;
                ctx.fillStyle = m.bold ? boldColor : textColor;
                ctx.fillText(m.text, x + m.w / 2, camY);
                x += m.w;
            }
        }
        if (exif) {
            ctx.font = `300 ${Math.round(fontSize * 0.82)}px 'DM Mono', monospace`;
            ctx.fillStyle = textColor;
            ctx.fillText(exif, cx, metaTop + metaH * 0.72);
        }
    }
}

export default function Bert() {
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [imgName, setImgName] = useState("");
    const [dragging, setDragging] = useState(false);
    const [style, setStyle] = useState<FrameStyle>("white");
    const [ratio, setRatio] = useState<AspectRatio>("original");
    const [borderPct, setBorderPct] = useState(8);
    const [vignette, setVignette] = useState<VignetteLevel>(1);
    const [camera, setCamera] = useState("X-T30 FUJIFILM");
    const [exif, setExif] = useState("53mm f/2.5 1/4000s ISO160");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const render = useCallback(() => {
        if (!img || !canvasRef.current) return;
        drawFrame(canvasRef.current, img, { style, ratio, borderPct, vignette, camera, exif });
    }, [img, style, ratio, borderPct, vignette, camera, exif]);

    useEffect(() => { render(); }, [render]);

    const loadFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setImgName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const i = new Image();
            i.onload = () => setImg(i);
            i.src = e.target!.result as string;
        };
        reader.readAsDataURL(file);
    };

    const download = () => {
        if (!canvasRef.current) return;
        const a = document.createElement("a");
        a.download = `framed-${imgName || "photo"}.jpg`;
        a.href = canvasRef.current.toDataURL("image/jpeg", 0.95);
        a.click();
    }

    return (
        <>
            <style>
                {`
                .bert-app {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                .bert-header {
                    border-bottom: 1px solid var(--border);
                    padding: 20px 32px;
                    display: fixed;
                    align-items: center;
                    justify-content: space-between;
                }
                .bert-header-left {
                    display: fixed;
                    align-items: center;
                    gap: 12px;
                }
                .bert-logo-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    background: rgba(255,255,255,0.08);
                    display: center;
                    align-items: center;
                    justify-content: center;
                }
                .bert-logo-inner {
                    width: 14px;
                    height: 14px;
                    border: 1px solid rgba(255,255,255,0.4);
                    border-radius: 2px;
                }
                .bert-logo-text {
                    font-family: var(--font-serif);
                    font-size: 20px;
                    letter-spacing: -0.01em;
                }
                .bert-header-tag {
                    font-size: 11px;
                    color: var(--text3);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .bert-body {
                    display: flex;
                    flex: 1;
                    min-height: calc(100vh - 65px);
                }
                .bert-sidebar {
                    width: 272px;
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                }
                .bert-drop {
                    margin: 20px;
                    border: 1px dashed var(--border2);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: border-color 0.2s, background 0.2s;
                    background: transparent;
                }
                .bert-drop:hover, .bert-drop.drag-over {
                    border-color: var(--border3);
                    background: var(--bg2);
                }
                .bert-drop-level {
                    font-size: 13px;
                    color: var(--text2);
                    margin-top: 8px;
                    line-height: 1.5;
                }
                .bert-drop-label strong {
                    color: var(--text4);
                    font-weight: 400;
                }
                .bert-section {
                    padding: 16px 20px;
                    border-top: 1px solid var(--border);
                }
                .bert-section-label {
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--text3);
                    margin-bottom: 10px;
                    display: block;
                }
                .bert-toggle-grid {
                    display: grid;
                    gap: 6px;
                }
                .bert-toggle-grid.cols-2 {
                    grid-template-columns: 1fr 1fr;
                }
                .bert-toggle-grid.cols-3 {
                    grid-template-columns: 1fr 1fr 1fr;
                }
                .bert-toggle {
                    padding: 7px 0;
                    border-radius: 7px;
                    font-size: 13px;
                    font-family: var(--font-sans);
                    cursor: pointer;
                    transition: all 0.15s;
                    background: transparent;
                    border: 0.5px solid var(--border2);
                    color: var(--text5);
                    text-align: center;
                }
                .bert-toggle:hover {
                    border-color: var(--border3);
                    color: var(--text4);
                }
                .bert-toggle.active {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.18);
                    color: var(--text);
                }
                .bert-range {
                    width: 100%;
                    accent-color: rgba(255,255,255,0.15);
                }
                .bert-input {
                    width: 100%;
                    border-radius: 7px;
                    padding: 7px 10px;
                    font-size: 12px;
                    font-family: var(--font-mono);
                    border: 0.5px solid var(--border2);
                    background: rgba(255,255,255,0.03);
                    color: rgba(255,255,255,0.75);
                    outline: none;
                    trasition: border-color 0.15s;
                }
                .bert-input:focus {
                    border-color: var(--border3);
                }
                .bert-input::placeholder {
                    color: rgba(255,255,255,0.18);
                }
                .bert-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    gap: 24px;
                }
                .bert-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    text-align: center;
                }
                .bert-empty-icon {
                    width: 96px;
                    height: 96px;
                    border-radius: 12px;
                    border: 1px solid var(--border2);
                    background: var(--bg2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .bert-empty-inner {
                    width: 48px;
                    height: 48px;
                    border: 1px solid var(--border3);
                    border-radius: 7px;
                }
                .bert-empty-title {
                    font-family: var(--font-serif);
                    font-style: italic;
                    font-size: 22px;
                    color: var(--text4);
                }
                .bert-empty-sub {
                    font-size: 13px;
                    color: var(--text3);
                    margin-top: 4px;
                }
                .bert-canvas-wrap {
                    border-radius: 7px;
                    overflow: hidden;
                    box-shadow: 0 4px 48px rbga(0,0,0,0.7);
                    max-width: 100%;
                }
                .bert-canvas {
                    max-width: 100%;
                    max-height: calc(100vh - 220px);
                    display: block;
                }
                .bert-actions {
                    display: flex;
                    gap: 10px;
                }
                .bert-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    padding: 9px 18px;
                    border-radius: 7px;
                    font-size: 14px;
                    font-family: var(--font-sans);
                    cursor: pointer;
                    border: 0.5px solid var(--border2);
                    background: transparent;
                    color: rgba(255,255,255,0.45);
                    transition: all 0.15s;
                }
                .bert-btn:hover {
                    border-color: var(--border3);
                    color: rgba(255,255,255,0.75);
                }
                .bert-btn.primary {
                    background: #ffffff;
                    color: #111111;
                    border-color: #ffffff;
                    font-weight: 500;
                }
                .bert-btn.primary:hover {
                    background(255,255,255,0.88);
                }
                `}
            </style>
            <div className="bert-app">
                <header className="bert-header">
                    <div className="bert-header-left">
                        <div className="bert-logo-icon">
                            <div className="bert-logo-inner"/>
                        </div>
                        <span className="bert-logo-text">Bert</span>
                    </div>
                    <span className="bert-header-tag">Photo frame generator</span>
                </header>
                <div className="bert-body">
                    <aside className="bert-sidebar">
                            <div className={`bert-drop${dragging ? " drag-over" : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); } } onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); } }>
                                <Upload size={18} color="var(--text5)" />
                                <p className="bert-drop-label">
                                    {imgName ? (
                                        <strong>{imgName}</strong>
                                    ) : (
                                        <><strong>Upload photo</strong> or drag & drop</>
                                    )}
                                </p>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); } } />
                            </div>
                        </div>
                        <div className="bert-section">
                            <span className="bert-section-label">Frame style</span>
                            <div className="bert-toggle-grid cols-2">
                                {FRAME_STYLES.map((s) => (
                                    <button key={s.id} className={`bert-toggle${style === s.id ? " active" : ""}`} onClick={() => setStyle(s.id)}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bert-section">
                            <span className="bert-section-label">Aspect ratio</span>
                            <div className="bert-toggle-grid cols-3">
                                {RATIOS.map((r) => (
                                    <button key={r.id} className={`bert-toggle${ratio === r.id ? " active" : ""}`} onClick={() => setRatio(r.id)}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bert-section">
                            <span className="bert-section-label">Border size - {borderPct}%</span>
                            <input type="range" min={2} max={20} step={1} value={borderPct} className="bert-range" onChange={(e) => setBorderPct(Number(e.target.value))} />
                        </div>

                        <div className="bert-section">
                            <span className="bert-section-label">Vignette - {VIG_LABELS[vignette]}</span>
                            <input type="range" min={0} max={3} step={1} value={vignette} className="bert-range" onChange={(e) => setVignette(Number(e.target.value) as VignetteLevel)} />
                        </div>

                        <div className="bert-section">
                            <span className="bert-section-label">Camera</span>
                            <input className="bert-input" value={camera} placeholder="e.g. ZV-E10 SONY" onChange={(e) => setCamera(e.target.value)} />
                        </div>

                        <div className="bert-section">
                            <span className="bet-section-label">EXIF data</span>
                            <input className="bert-input" value={exif} placeholder="e.g. 50mm f/2.8 1/4000s ISO100" onChange={(e) => setExif(e.target.value)} />
                        </div>
                    </aside>

                    <main className="bert-main">
                        {!img ? (
                            <div className="bert-empty">
                                <div className="bert-empty-icon">
                                    <div className="bert-empty-inner" />
                                </div>
                                <div>
                                    <p className="bert-empty-title">Your frame is waiting</p>
                                    <p className="bert-empty-sub">Upload a photo to get started</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bert-canvas-wrap">
                                    <canvas ref={canvasRef} className="bert-canvas" />
                                </div>
                                <div className="bert-actions">
                                    <button className="bert-btn" onClick={() => { setImg(null); setImgName(""); }}>
                                        <RefreshCw size={14} /> New photo
                                    </button>
                                    <button className="bert-btn primary" onClick={download}>
                                        <Download size={14} /> Download
                                    </button>
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}