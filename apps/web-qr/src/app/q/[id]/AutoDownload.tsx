"use client";

import { useEffect } from "react";

export default function AutoDownload({
  fileUrl,
  fileName,
}: {
  fileUrl: string;
  fileName: string;
}) {
  useEffect(() => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [fileUrl, fileName]);

  return null;
}
