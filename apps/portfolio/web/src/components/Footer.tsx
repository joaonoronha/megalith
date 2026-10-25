import { profile } from "@/data/profile";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white py-10 transition-colors no-print">
      <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          <span>© {currentYear} {profile.name}. All rights reserved.</span>
        </div>
        <div className="font-serif italic text-slate-700 text-sm">
          Lisbon → the world.
        </div>
      </div>
    </footer>
  );
}
