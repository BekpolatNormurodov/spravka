"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode, User, Lock, Eye, EyeSlash, Login } from "iconsax-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Xatolik: ${res.status}`);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Noma'lum xatolik";
      console.error("Login error:", errorMsg);
      setError(`Serverga ulanib bo'lmadi: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="grid place-items-center h-16 w-16 rounded-2xl bg-brand-600 shadow-glow mb-4">
            <ScanBarcode size={34} color="#fff" variant="Bold" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">QRCode Pro</h1>
          <p className="text-sm text-slate-400 mt-1">
            Boshqaruv paneliga kirish
          </p>
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-5">
          <div>
            <label className="label">Login</label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                className="input pl-11"
                placeholder="Login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Parol</label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                className="input pl-11 pr-11"
                type={show ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {show ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              "Kirilmoqda..."
            ) : (
              <>
                <Login size={18} color="#fff" />
                Kirish
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            Admin login credentials must be configured with environment variables.
          </p>
        </form>
      </div>
    </main>
  );
}
