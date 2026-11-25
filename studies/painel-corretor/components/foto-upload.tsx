"use client";

import { useState } from "react";

// Pré-visualização local da imagem escolhida. Neste estudo a imagem não é gravada no db.
export function FotoUpload({ fallback, redonda = true }: { fallback: React.ReactNode; redonda?: boolean }) {
  const [src, setSrc] = useState<string>();
  const forma = redonda ? "rounded-full" : "rounded";
  return (
    <div className="flex flex-col items-center gap-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`size-32 object-cover ${forma}`} />
      ) : (
        <div className={`grid size-32 place-items-center bg-cyan-400 text-3xl font-bold text-white ${forma}`}>{fallback}</div>
      )}
      <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
        Alterar
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setSrc(URL.createObjectURL(f));
          }}
        />
      </label>
    </div>
  );
}
