import Link from "next/link";
import { ScanBarcode } from "iconsax-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-10 max-w-md w-full text-center animate-fade-in">
        <div className="grid place-items-center h-16 w-16 rounded-2xl bg-white/5 mx-auto mb-4">
          <ScanBarcode size={32} className="text-slate-500" />
        </div>
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-slate-400 mt-2">
          Bunday QR kod yoki sahifa topilmadi
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Bosh sahifaga
        </Link>
      </div>
    </main>
  );
}
