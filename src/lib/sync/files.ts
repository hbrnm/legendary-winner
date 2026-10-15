/**
 * Fișierele fotografiilor gospodăriei (bucketul privat `recipe-photos`).
 * Erorile: `RemoteRejected` (refuz definitiv: drepturi, mărime, tip) sau
 * `RemoteUnavailable` (offline, eroare temporară: se reîncearcă).
 */
export interface RemoteFiles {
  /** Suprascrie dacă există (reîncercarea după o încărcare întreruptă). */
  upload(path: string, data: ArrayBuffer, contentType: string): Promise<void>;
  download(path: string): Promise<Blob>;
  /** Un fișier care nu există nu e o eroare. */
  remove(paths: string[]): Promise<void>;
}

/** Fotografiile descărcate o dată, păstrate pentru offline; cheia e calea din Storage. */
export interface PhotoCache {
  get(path: string): Promise<Blob | null>;
  put(path: string, blob: Blob): Promise<void>;
  delete(path: string): Promise<void>;
  paths(): Promise<string[]>;
}

/**
 * Cache Storage din browser. Numele nu începe cu „camara-”, ca service
 * worker-ul să nu-l golească la fiecare versiune nouă a aplicației.
 */
const CACHE_NAME = "fotografii-retete";
const PREFIX = "/__fotografii/";

export function browserPhotoCache(): PhotoCache | null {
  if (typeof caches === "undefined") return null;
  const open = () => caches.open(CACHE_NAME);
  return {
    async get(path) {
      const hit = await (await open()).match(PREFIX + path);
      return hit ? hit.blob() : null;
    },
    async put(path, blob) {
      await (await open()).put(PREFIX + path, new Response(blob, { headers: { "Content-Type": blob.type } }));
    },
    async delete(path) {
      await (await open()).delete(PREFIX + path);
    },
    async paths() {
      return (await (await open()).keys()).map((r) => new URL(r.url).pathname.slice(PREFIX.length));
    },
  };
}

/** Cache în memorie, pentru teste. */
export class MemoryPhotoCache implements PhotoCache {
  files = new Map<string, Blob>();
  async get(path: string) {
    return this.files.get(path) ?? null;
  }
  async put(path: string, blob: Blob) {
    this.files.set(path, blob);
  }
  async delete(path: string) {
    this.files.delete(path);
  }
  async paths() {
    return [...this.files.keys()];
  }
}
