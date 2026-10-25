import { Mail, Phone, ExternalLink, Printer, Github, Linkedin } from "lucide-react";
import { profile } from "@/data/profile";

export function ContactSection() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <section id="contact" className="border-t border-slate-200/90 bg-slate-50/70 py-24 md:py-36 text-center">
      <div className="mx-auto max-w-4xl px-6 space-y-8">
        <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold">
          05 — Say hello
        </div>

        <h2 className="font-serif text-5xl sm:text-6xl md:text-7xl leading-[1.05] text-slate-900 text-balance font-normal">
          Let's build something{" "}
          <em className="text-blue-600 italic font-medium">
            worth shipping.
          </em>
        </h2>

        <p className="text-slate-600 text-lg md:text-xl font-light max-w-xl mx-auto leading-relaxed text-pretty">
          Always open to conversations about engineering leadership, agentic AI architecture, high-velocity squads, and
          building product-first cultures.
        </p>

        {/* Primary Contact Buttons */}
        <div className="pt-4 flex flex-wrap justify-center items-center gap-4">
          <a
            href={`mailto:${profile.contact.email}`}
            className="px-6 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold tracking-wide transition shadow-md hover:shadow-blue-500/20 flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>{profile.contact.email}</span>
          </a>

          <a
            href={`tel:${profile.contact.phone}`}
            className="px-6 py-3.5 rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-800 text-sm font-semibold transition shadow-xs flex items-center gap-2"
          >
            <Phone className="w-4 h-4 text-blue-600" />
            <span>{profile.contact.phone}</span>
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-3.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-sm font-medium transition shadow-xs flex items-center gap-2 no-print"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Executive Résumé</span>
          </button>
        </div>

        {/* Social channels */}
        <div className="pt-8 flex justify-center items-center gap-6 text-sm text-slate-600 font-medium">
          <a
            href={profile.contact.linkedin}
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-600 transition flex items-center gap-1.5"
          >
            <Linkedin className="w-4 h-4 text-blue-600" />
            <span>LinkedIn</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <span className="text-slate-300">·</span>
          <a
            href={profile.contact.github}
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-600 transition flex items-center gap-1.5"
          >
            <Github className="w-4 h-4 text-blue-600" />
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    </section>
  );
}
