import { useState, useRef, useEffect } from "react";
import {
  Zap,
  Loader2,
  Plus,
  X,
  Image as ImageIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Capacitor } from "@capacitor/core";

import { addActivity } from "../../utils/recentActivity";
import { usePipeline } from "../../utils/pipelineContext";
import { useObjectURL } from "../../utils/useObjectURL";
import SuccessState from "./shared/SuccessState";
import PrivacyBadge from "./shared/PrivacyBadge";
import { NativeToolLayout } from "./shared/NativeToolLayout";

// Compare Slider Component
const QualityCompare = ({
  originalUrl,
  compressedUrl,
}: {
  originalUrl: string;
  compressedUrl: string;
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, position)));
  };

  if (!originalUrl || !compressedUrl)
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-[2rem] animate-pulse">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase text-gray-400">
          Comparing Quality...
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h4 className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2">
          <Maximize2 size={12} /> Quality Inspection
        </h4>
      </div>
      <div
        ref={containerRef}
        className="relative h-80 md:h-[400px] rounded-[2rem] overflow-hidden cursor-ew-resize select-none border border-gray-100 dark:border-white/5"
        onMouseMove={handleMove}
        onTouchMove={handleMove}
      >
        <img
          src={compressedUrl}
          className="absolute inset-0 w-full h-full object-contain bg-black/5 dark:bg-white/5"
          alt="Compressed"
          draggable={false}
        />
        <div
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={originalUrl}
            className="absolute inset-0 w-full h-full object-contain bg-black/5 dark:bg-white/5"
            alt="Original"
            draggable={false}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-xl z-10"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white dark:bg-zinc-900 rounded-full shadow-2xl border border-gray-100 dark:border-white/5 flex items-center justify-center text-rose-500">
            <ChevronLeft size={14} />
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};

type CompressImageFile = {
  id: string;
  file: File;
  originalUrl: string;
  dimensions?: string;
  status: "pending" | "processing" | "completed" | "error";
  resultUrl?: string;
  resultSize?: number;
  resultName?: string;
};

type CompressionQuality = "low" | "medium" | "high";

export default function ImageCompressTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { consumePipelineFile, setPipelineFile } = usePipeline();
  const { createUrl, clearUrls } = useObjectURL();
  const [files, setFiles] = useState<CompressImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [quality, setQuality] = useState<CompressionQuality>("medium");
  const [showSuccess, setShowSuccess] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const pipelined = consumePipelineFile();
    if (pipelined) {
      if (!pipelined.type?.startsWith("image/")) {
        toast.error(
          "The file from the previous tool is not an Image and cannot be used here.",
        );
        return;
      }
      const file = new File([pipelined.buffer as any], pipelined.name, {
        type: pipelined.type,
      });
      handleFiles([file]);
    }
  }, []);

  const handleFiles = async (selectedFiles: FileList | File[]) => {
    const newFiles = Array.from(selectedFiles)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => {
        const originalUrl = createUrl(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          originalUrl,
          status: "pending" as const,
        };
      });

    setFiles((prev) => [...prev, ...newFiles]);
    setShowSuccess(false);

    // Clear input value to allow selecting the same file again
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const f of newFiles) {
      const img = new Image();
      img.onload = () => {
        setFiles((prev) =>
          prev.map((item) =>
            item.id === f.id
              ? { ...item, dimensions: `${img.width}x${img.height}` }
              : item,
          ),
        );
      };
      img.src = f.originalUrl;
    }
  };

  const compressSingleFile = async (
    item: CompressImageFile,
    quality: CompressionQuality,
  ): Promise<{
    url: string;
    size: number;
    buffer: Uint8Array;
    name: string;
  }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas ctx not available."));

        let width = img.width;
        let height = img.height;

        // Downscale very large images slightly for high/med and significantly for low
        let scale = 1.0;
        if (quality === "medium" && (width > 2000 || height > 2000)) {
          scale = 0.8;
        } else if (quality === "low") {
          scale = Math.min(1080 / width, 1080 / height, 0.5);
        }

        canvas.width = width * scale;
        canvas.height = height * scale;

        // Draw white background in case of transparent PNG to JPEG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const qualityMap = { high: 0.9, medium: 0.7, low: 0.4 };
        const q = qualityMap[quality];

        let type = item.file.type;
        if (type !== "image/jpeg" && type !== "image/webp") {
          type = "image/jpeg"; // Convert png/gif to jpeg for compression
        }

        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error("Failed to compress"));
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            const ext = type === "image/jpeg" ? ".jpg" : ".webp";
            const originalNameBase =
              item.file.name.substring(0, item.file.name.lastIndexOf(".")) ||
              item.file.name;
            const newName = `${originalNameBase}-compressed${ext}`;

            resolve({
              url: createUrl(blob),
              size: blob.size,
              buffer,
              name: newName,
            });
          },
          type,
          q,
        );
      };
      img.onerror = () =>
        reject(new Error("Failed to load image for compression"));
      img.src = item.originalUrl;
    });
  };

  const startBatchCompression = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;
    setIsProcessing(true);
    setGlobalProgress(0);
    const results = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const item = pendingFiles[i];
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "processing" } : f,
        ),
      );
      try {
        const { url, size, buffer, name } = await compressSingleFile(
          item,
          quality,
        );
        results.push({ name, buffer });
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "completed",
                  resultUrl: url,
                  resultSize: size,
                  resultName: name,
                }
              : f,
          ),
        );
        addActivity({ name, tool: "Image Compress", size, resultUrl: url });
        if (pendingFiles.length === 1) {
          const originalBuffer = await pendingFiles[0].file.arrayBuffer();
          setPipelineFile({
            buffer,
            name,
            type: name.endsWith(".webp") ? "image/webp" : "image/jpeg",
            originalBuffer: new Uint8Array(originalBuffer),
          });
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "error" } : f)),
        );
      }

      setGlobalProgress(Math.round(((i + 1) / pendingFiles.length) * 100));
    }

    // Create ZIP if batch
    if (results.length > 1) {
      const zip = new JSZip();
      results.forEach((res) => zip.file(res.name, res.buffer));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      createUrl(zipBlob); // Stores zip blob as the primary objectUrl implicitly since createUrl adds to the pool and we can access the last or assume it's there
    }
    setIsProcessing(false);
    setShowSuccess(true);
  };

  const handleDownloadBatch = async () => {
    if (files.length > 1) {
      const zip = new JSZip();
      for (const f of files) {
        if (f.resultUrl && f.resultName) {
          const res = await fetch(f.resultUrl);
          zip.file(f.resultName, await res.arrayBuffer());
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "paperknife-images-compressed.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const ActionButton = () => (
    <button
      onClick={startBatchCompression}
      disabled={isProcessing || files.length === 0}
      className={`w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 py-4 rounded-2xl text-sm md:p-6 md:rounded-3xl md:text-xl`}
    >
      {isProcessing ? (
        <>
          <Loader2 className="animate-spin" /> {globalProgress}%
        </>
      ) : (
        <>
          Compress {files.length > 1 ? `${files.length} Images` : "Image"}{" "}
          <ArrowRight size={18} />
        </>
      )}
    </button>
  );

  return (
    <NativeToolLayout
      title="Compress Image"
      description="Reduce image file size while maintaining visual quality. Process happens fully offline."
      actions={files.length > 0 && !showSuccess && <ActionButton />}
    >
      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {files.length === 0 ? (
        <button
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className="w-full border-4 border-dashed border-gray-100 dark:border-zinc-900 rounded-[2.5rem] p-12 text-center hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all cursor-pointer group"
        >
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-inner">
            <ImageIcon size={32} />
          </div>
          <h3 className="text-xl font-bold dark:text-white mb-2">
            Select Images
          </h3>
          <p className="text-sm text-gray-400 font-medium">
            Tap to start batch image compression
          </p>
        </button>
      ) : !showSuccess ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((f) => (
              <div
                key={f.id}
                className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 flex items-center gap-4 relative group shadow-sm"
              >
                <div className="w-12 h-16 bg-gray-50 dark:bg-black rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800">
                  <img
                    src={f.originalUrl}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate dark:text-white">
                    {f.file.name}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                    {(f.file.size / (1024 * 1024)).toFixed(2)} MB{" "}
                    {f.dimensions ? `• ${f.dimensions}` : ""}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFiles((prev) => prev.filter((item) => item.id !== f.id))
                  }
                  className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-[1.5rem] p-4 text-gray-400 flex flex-col items-center justify-center gap-1 hover:border-indigo-500 hover:text-indigo-500 transition-all"
            >
              <Plus size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Add More
              </span>
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest px-1">
              Compression Quality
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "high", label: "High Quality", desc: "Minimal Loss" },
                { id: "medium", label: "Standard", desc: "Recommended" },
                { id: "low", label: "Smallest", desc: "Max Save" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setQuality(lvl.id as CompressionQuality)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${quality === lvl.id ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10" : "border-gray-100 dark:border-white/5"}`}
                >
                  <span
                    className={`font-black uppercase text-[9px] text-center leading-tight ${quality === lvl.id ? "text-indigo-500" : "text-gray-400"}`}
                  >
                    {lvl.label}
                  </span>
                  <span className="text-[8px] text-gray-400 font-bold uppercase">
                    {lvl.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 p-6 bg-gray-50 dark:bg-black rounded-2xl border border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Zap size={16} />
                </div>
                <h5 className="text-xs font-black uppercase tracking-widest dark:text-white">
                  Quality Details
                </h5>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                {quality === "high" && (
                  <>
                    <strong>High Quality:</strong> Retains 90% quality with
                    minimal downscaling. Ideal for photos that need to stay
                    sharp. Expected reduction:{" "}
                    <span className="text-indigo-500 font-bold">20-40%</span>.
                  </>
                )}
                {quality === "medium" && (
                  <>
                    <strong>Standard:</strong> 70% quality. Automatically
                    downscales ultra-high resolution images. Best balance for
                    web use. Expected reduction:{" "}
                    <span className="text-indigo-500 font-bold">50-70%</span>.
                  </>
                )}
                {quality === "low" && (
                  <>
                    <strong>Smallest Size:</strong> 40% quality and aggressive
                    downscaling to max 1080px. For avatars, thumbnails, and
                    quick sharing. Expected reduction:{" "}
                    <span className="text-indigo-500 font-bold">80-90%</span>.
                  </>
                )}
              </p>
            </div>

            {isProcessing && (
              <div className="mt-8 space-y-3">
                <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${globalProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-center font-black uppercase text-gray-400 tracking-widest animate-pulse">
                  Compressing Images...
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in duration-300">
          {files.length > 1 && (
            <button
              onClick={handleDownloadBatch}
              className="block w-full bg-zinc-900 dark:bg-white text-white dark:text-black p-10 rounded-[2.5rem] text-center shadow-2xl transition-all group active:scale-[0.98]"
            >
              <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <Download className="text-white" size={32} />
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-1">
                {isNative ? "Save ZIP Archive" : "Download ZIP Archive"}
              </h3>
              <p className="text-xs font-bold opacity-60 uppercase tracking-widest">
                {files.length} Optimized Images
              </p>
            </button>
          )}
          {files.length === 1 && (
            <div className="space-y-8">
              {files[0].resultUrl && (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
                  <QualityCompare
                    originalUrl={files[0].originalUrl}
                    compressedUrl={files[0].resultUrl}
                  />
                </div>
              )}
              <SuccessState
                message={`Reduced by ${((1 - (files[0].resultSize || 0) / files[0].file.size) * 100).toFixed(0)}%`}
                downloadUrl={files[0].resultUrl!}
                fileName={files[0].resultName!}
                onStartOver={() => {
                  setFiles([]);
                  setShowSuccess(false);
                  clearUrls();
                  setIsProcessing(false);
                }}
              />
            </div>
          )}
        </div>
      )}
      <PrivacyBadge />
    </NativeToolLayout>
  );
}
