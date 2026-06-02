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
        <div>
            <header>
                <div>
                    <span>Bert</span>
                    <span>Photo frame generator</span>
                </div>
            </header>
            <div>
                <aside>
                    <div>
                        <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}>
                            <Upload size={18} />
                            <p>
                                {imgName ? (
                                    <span>{imgName}</span>
                                ) : (
                                    <><span>Upload photo</span> or drag & drop</>
                                )}
                            </p>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
                        </div>
                    </div>

                    <Section label="Frame style">
                        <div>
                            {FRAME_STYLES.map((s) => (
                                <ToggleBtn key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
                                    {s.label}
                                </ToggleBtn>
                            ))}
                        </div>
                    </Section>

                    <Section label={`Border size - ${borderPct}%`}>
                        <input type="range" min={2} max={20} step={1} value={borderPct} onChange={(e) => setBorderPct(Number(e.target.value))} />
                    </Section>

                    <Section label="Camera">
                        <input value={camera} onChange={(e) => setCamera(e.target.value)} placeholder="e.g. X-T30 FUJIFILM" />
                    </Section>

                    <Section label="EXIF data" last>
                        <input value={exif} onChange={(e) => setExif(e.target.value)} placeholder="e.g. 53mm f/2.5 1/4000s ISO160" />
                    </Section>
                </aside>

                <main>
                    {!img ? (
                        <div>
                            <div>
                                <p>Your frame awaits</p>
                                <p>Upload a photo to get started</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <canvas ref={canvasRef} />
                            </div>
                            <div>
                                <button onClick={() => { setImg(null); setImgName(""); }}>
                                    <RefreshCw size={14} /> New photo
                                </button>
                                <button onClick={download}>
                                    <Download size={14} /> Download
                                </button>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

function Section({ label, children, last }: { label: string; children: ReactCompilerOptions.ReactNode; last?: boolean }) {
    return (
        <div>
            <p>{label}</p>
            {children}
        </div>
    );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick}>
            {children}
        </button>
    );
}