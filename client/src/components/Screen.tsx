import { useEffect, useRef } from "react";

type Props = {
  sourceCanvas: HTMLCanvasElement | null;
};

export function Screen({ sourceCanvas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sourceCanvas || !canvasRef.current) return;

    const dest = canvasRef.current;
    const ctx = dest.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, dest.width, dest.height);
    ctx.drawImage(sourceCanvas, 0, 0, dest.width, dest.height);
  }, [sourceCanvas]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={576}
      style={{
        width: "100%",
        maxWidth: 640,
        borderRadius: 16,
        border: "1px solid #303030",
        background: "#000",
        imageRendering: "pixelated",
      }}
    />
  );
}