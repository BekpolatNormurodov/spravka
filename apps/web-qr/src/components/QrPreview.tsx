"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { DocumentDownload } from "iconsax-react";
import type { QrCodeItem } from "@/lib/types";

export default function QrPreview({
  item,
  url,
  size = 200,
  showDownload = true,
}: {
  item: QrCodeItem;
  url: string;
  size?: number;
  showDownload?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Serverda tayyorlangan PNG mavjud bo'lsa — uni rasm sifatida ko'rsatamiz
  const hasImage = Boolean(item.qrImageUrl);

  function download() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${item.name || item.id}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (hasImage) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-2xl p-3 shadow-lg"
          style={{ background: item.bgColor }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.qrImageUrl!}
            alt={`${item.name} QR`}
            width={size}
            height={size}
            className="rounded-lg"
            style={{ width: size, height: size }}
          />
        </div>
        {showDownload && (
          <a
            href={item.qrImageUrl!}
            download={`${item.name || item.id}-qr.png`}
            className="btn-ghost text-xs py-2"
          >
            <DocumentDownload size={16} />
            PNG yuklab olish
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={wrapRef}
        className="rounded-2xl p-3 shadow-lg"
        style={{ background: item.bgColor }}
      >
        <QRCodeCanvas
          value={url}
          size={size}
          fgColor={item.fgColor}
          bgColor={item.bgColor}
          level={(item.level as "L" | "M" | "Q" | "H") || "M"}
          marginSize={2}
        />
      </div>
      {showDownload && (
        <button onClick={download} className="btn-ghost text-xs py-2">
          <DocumentDownload size={16} />
          PNG yuklab olish
        </button>
      )}
    </div>
  );
}
