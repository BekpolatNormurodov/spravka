'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Ico } from '@spravka/shared/ui';

export function ClientSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      if ((sp.get('q') ?? '') !== q) router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="card mb-4 p-4">
      <div className="relative max-w-md">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Ico.users size={16} />
        </span>
        <input
          className="field-input pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="PINFL, F.I.SH. yoki passport…"
          aria-label="Mijoz qidirish"
        />
      </div>
    </div>
  );
}
