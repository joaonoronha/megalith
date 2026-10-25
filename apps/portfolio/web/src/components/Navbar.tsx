import { useState } from "react";
import { Printer, Mail, Menu, X, Sparkles } from "lucide-react";
import { profile } from "@/data/profile";

interface NavbarProps {
  onSelectAiMode: () => void;
  isAiView: boolean;
}

export function Navbar({ onSelectAiMode, isAiView }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-slate-200/90 shadow-2xs no-print">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <a
          href="#top"
          className="font-serif text-2xl tracking-tight text-slate-900 hover:text-blue-600 transition-colors"
        >
          João <span className="text-blue-600 font-bold">N.</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a href="#about" className="hover:text-slate-900 transition-colors">
            About
          </a>
          <a href="#experience" className="hover:text-slate-900 transition-colors">
            Experience
          </a>
          <button
            type="button"
            onClick={onSelectAiMode}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all text-xs font-semibold ${
              isAiView
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>How I Build with AI</span>
          </button>
          <a href="#toolbox" className="hover:text-slate-900 transition-colors">
            Toolbox
          </a>
          <a href="#contact" className="hover:text-slate-900 transition-colors">
            Contact
          </a>
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            title="Print or save PDF résumé"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:text-slate-900 text-xs font-medium transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print CV</span>
          </button>

          <a
            href={`mailto:${profile.contact.email}`}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold tracking-wide transition shadow-sm hover:shadow-blue-500/20"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Get in touch</span>
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-6 py-5 space-y-4 text-base shadow-lg">
          <a
            href="#about"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-700 hover:text-slate-900 py-1 font-medium"
          >
            About
          </a>
          <a
            href="#experience"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-700 hover:text-slate-900 py-1 font-medium"
          >
            Experience
          </a>
          <button
            type="button"
            onClick={() => {
              onSelectAiMode();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 text-blue-600 font-semibold py-1 w-full text-left"
          >
            <Sparkles className="w-4 h-4" />
            <span>How I Build with AI</span>
          </button>
          <a
            href="#toolbox"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-700 hover:text-slate-900 py-1 font-medium"
          >
            Toolbox
          </a>
          <a
            href="#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-700 hover:text-slate-900 py-1 font-medium"
          >
            Contact
          </a>
          <div className="pt-3 border-t border-slate-200 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                handlePrint();
                setMobileMenuOpen(false);
              }}
              className="flex-1 flex justify-center items-center gap-2 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>Print CV</span>
            </button>
            <a
              href={`mailto:${profile.contact.email}`}
              className="flex-1 flex justify-center items-center gap-2 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
            >
              <Mail className="w-4 h-4" />
              <span>Contact</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
