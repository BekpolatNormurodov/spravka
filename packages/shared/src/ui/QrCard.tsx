'use client';

import { useState } from 'react';
import { Ico } from './icons';

/**
 * Public QR for a certificate. Every role (yurist / admin / rahbar) sees it.
 * Before signing the QR still resolves — the public page then shows «ТАСДИҚЛАНМАГАН».
 */
export function QrCard({ dataUrl, url, signed }: { dataUrl: string; url: string; signed: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted"><Ico.qr size={18} /></span>
        <h3 className="text-sm font-semibold">QR kod</h3>
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl bg-white p-2.5 ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Maʼlumotnoma QR kodi" width={168} height={168} className="block h-[168px] w-[168px]" />
        </div>
      </div>

      <p className={`mt-3 text-center text-xs font-medium ${signed ? 'text-accent-600 dark:text-accent-400' : 'text-amber-600 dark:text-amber-300'}`}>
        {signed ? 'Skanerlanganda tasdiqlangan hujjat ochiladi' : 'Rahbar imzolagunicha «ТАСДИҚЛАНМАГАН» deb chiqadi'}
      </p>

      <div className="mt-3 flex gap-2">
        <button onClick={copy} className="btn-ghost flex-1 py-2 text-xs" type="button">
          {copied ? <Ico.check size={16} /> : <Ico.files size={16} />}
          {copied ? 'Nusxalandi' : 'Havolani nusxalash'}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost py-2 text-xs" title="Yangi oynada ochish">
          <Ico.eye size={16} />
        </a>
      </div>
    </div>
  );
}
