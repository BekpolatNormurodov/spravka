'use client';

/**
 * Thin client for the locally-installed E-IMZO application.
 *
 * E-IMZO listens on a websocket on the signer's own machine. Everything here happens there: the
 * key is read from their disk, the password is typed into E-IMZO's own native window, and only
 * the finished signature crosses to us. The key and the password never reach the browser, let
 * alone the server — that is a property of the design, not a promise we keep.
 *
 * Verified against E-IMZO v6.4.7 from an app origin (http://localhost:5103): the socket answers
 * plugin calls with no apikey registration. A public domain may still need a key from NIC —
 * `CAPIWS.apikey(domainAndKey, …)` exists for that — so treat production as unconfirmed.
 */

const WS_URL = 'wss://127.0.0.1:64443/service/cryptapi';
const CALL_TIMEOUT_MS = 120_000; // loading a key waits on a human typing a password

/** A key E-IMZO found on this machine. `disk` may be a flash drive — it scans all of them. */
export interface EimzoKey {
  disk: string;
  path: string;
  name: string;
  alias: string;
}

export type EimzoStatus = 'checking' | 'ready' | 'unavailable';

interface Reply {
  success?: boolean;
  status?: number;
  reason?: string;
  [k: string]: unknown;
}

/** E-IMZO refused or is not there. Carries a message meant for the rahbar, not a stack trace. */
export class EimzoError extends Error {}

/**
 * One websocket per call — E-IMZO's own client does the same, and a long-lived socket would
 * otherwise sit open while the user reads the page.
 */
function call<T extends Reply>(plugin: string, name: string, args: unknown[] = []): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      reject(new EimzoError('E-IMZO dasturi bilan bogʻlanib boʻlmadi'));
      return;
    }

    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new EimzoError('E-IMZO javob bermadi'));
    }, CALL_TIMEOUT_MS);

    const done = (fn: () => void) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      fn();
    };

    ws.onerror = () => done(() => reject(new EimzoError('E-IMZO dasturi ishga tushmagan')));
    ws.onclose = (e) => {
      if (e.code !== 1000) done(() => reject(new EimzoError('E-IMZO ulanishi uzildi')));
    };
    ws.onmessage = (ev) => {
      let data: T;
      try {
        data = JSON.parse(ev.data as string) as T;
      } catch {
        done(() => reject(new EimzoError('E-IMZO tushunarsiz javob qaytardi')));
        return;
      }
      done(() => {
        // `success: false` is E-IMZO reporting a real problem — a wrong password, a cancelled
        // dialog, an unreadable key. Its own reason is more useful than anything we could invent.
        if (data.success === false) reject(new EimzoError(data.reason || 'E-IMZO amalni bajarmadi'));
        else resolve(data);
      });
    };
    ws.onopen = () => ws.send(JSON.stringify({ plugin, name, arguments: args.map(String) }));
  });
}

/** Is E-IMZO running on this machine? Cheap call, short timeout — drives the status shown up front. */
export async function eimzoAvailable(): Promise<boolean> {
  try {
    await Promise.race([
      call('app', 'get_jvm_version'),
      new Promise((_, r) => setTimeout(() => r(new EimzoError('timeout')), 4000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every key E-IMZO can see, across every disk — including a flash drive, if one is plugged in.
 * Keys live in a `DSKEYS` folder; E-IMZO finds them itself, so the rahbar picks from a list
 * rather than hunting for a file.
 */
export async function listKeys(): Promise<EimzoKey[]> {
  const r = await call<{ certificates?: EimzoKey[] }>('pfx', 'list_all_certificates');
  return r.certificates ?? [];
}

/**
 * Unlock a key. E-IMZO opens its own password window here — nothing about that window is ours,
 * which is exactly why the password never touches the page. Returns a handle that lives in
 * E-IMZO's memory for a short while.
 */
export async function loadKey(key: EimzoKey): Promise<string> {
  const r = await call<{ keyId?: string }>('pfx', 'load_key', [key.disk, key.path, key.name, key.alias]);
  if (!r.keyId) throw new EimzoError('Kalit ochilmadi');
  return r.keyId;
}

/** Sign base64 data with an unlocked key, returning attached PKCS#7/CMS (also base64). */
export async function createPkcs7(dataBase64: string, keyId: string): Promise<string> {
  const r = await call<{ pkcs7_64?: string }>('pkcs7', 'create_pkcs7', [dataBase64, keyId, 'no']);
  if (!r.pkcs7_64) throw new EimzoError('Imzo yaratilmadi');
  return r.pkcs7_64;
}

/** Drop the unlocked key from E-IMZO's memory. Best-effort: it also expires on its own. */
export async function unloadKey(keyId: string): Promise<void> {
  try {
    await call('pfx', 'unload_key', [keyId]);
  } catch {
    /* the key expires by itself; failing to tidy up is not worth an error to the user */
  }
}
