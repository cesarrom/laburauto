import { Link } from 'react-router-dom';
import {
  Car,
  PenLine,
  ShieldCheck,
  TimerReset,
  ScrollText,
  Fingerprint,
  ArrowUpRight,
  FileCheck,
  Users,
  CheckCircle2,
} from 'lucide-react';

const featureCards = [
  {
    icon: ShieldCheck,
    title: 'Tamper-proof evidence',
    description: 'Every signature is timestamped, geo-tagged, and linked to each party so disputes are easier to resolve.',
  },
  {
    icon: PenLine,
    title: 'Contracts in under 2 minutes',
    description: 'We turn your informal WhatsApp agreement into a structured document with key clauses auto-filled for you.',
  },
  {
    icon: Fingerprint,
    title: 'Identity capture built-in',
    description: 'Collect IDs, photos, and payment proof securely, without juggling multiple apps or spreadsheets.',
  },
  {
    icon: TimerReset,
    title: 'Live status transparency',
    description: 'See who has signed, who still needs to, and when hand-offs happen—all from a shared timeline.',
  },
];

const milestones = [
  {
    label: '1. Align on terms',
    detail: 'Publishers or renters answer a guided questionnaire—pricing, mileage limits, photos, and deposit info.',
  },
  {
    label: '2. Generate contract',
    detail: 'Laburauto assembles a jurisdiction-ready agreement and invites each party to review and sign digitally.',
  },
  {
    label: '3. Share evidence',
    detail: 'Upload payment proof, vehicle photos, and odometer readings so there is a single audit log if something goes wrong.',
  },
  {
    label: '4. Stay protected',
    detail: 'Both sides receive a signed PDF + timeline that can be shared with insurers, law enforcement, or support teams.',
  },
];

const proofPoints = [
  {
    icon: FileCheck,
    title: 'Structured legal docs',
    text: 'Template clauses are vetted with local counsel, so casual rentals don’t rely on copy-paste contracts.',
  },
  {
    icon: Users,
    title: 'Neutral third-party',
    text: 'We sit between renter and publisher as the audit trail, making it easier to mediate any disagreement.',
  },
  {
    icon: CheckCircle2,
    title: 'Platform agnostic',
    text: 'Even if you met on Facebook Marketplace, you can finalize the deal here without rebuilding trust from scratch.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#1f4ed8_0%,_transparent_55%)] opacity-30 pointer-events-none" />
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-8">
          <div className="flex items-center gap-3 font-semibold text-lg tracking-tight">
            <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center">
              <Car className="h-5 w-5" />
            </div>
            Laburauto
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-white/70">
            <Link to="/login" className="hover:text-white transition-colors">Log in</Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-5 py-2 text-sm font-semibold"
            >
              Get started
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 pb-20 pt-10 md:pt-16 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/80">
            Peer-to-peer rentals · Legalized
          </p>
          <h1 className="mt-6 text-4xl md:text-6xl font-semibold leading-tight text-white">
            Formalize any informal car rental in minutes—
            <span className="text-blue-300"> without lawyers or friction.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/70">
            Laburauto turns a simple WhatsApp chat into a defensible contract, capturing ID proofs, signatures, and a synced audit log
            so both parties stay protected if plans change.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex justify-center items-center gap-2 rounded-xl bg-blue-500 px-8 py-3 text-base font-semibold text-white shadow-2xl shadow-blue-500/30"
            >
              Create a free agreement
              <PenLine className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex justify-center items-center gap-2 rounded-xl border border-white/30 px-8 py-3 text-base font-semibold text-white/90"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-6xl mx-auto px-6 -mt-12">
          <div className="grid md:grid-cols-4 gap-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-3xl bg-white/5 border border-white/10 p-6 backdrop-blur">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-blue-200" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-blue-200/80">How it works</p>
            <h2 className="mt-4 text-3xl md:text-4xl font-semibold">Built for rentals that start outside Laburauto.</h2>
            <p className="mt-4 text-white/70">
              Whether you met on Facebook Marketplace, a WhatsApp group, or a neighborhood forum, you can bring the deal into Laburauto to add
              structure and legal protections. We don’t match drivers—we give them the paperwork, guardrails, and audit trail the gig deserves.
            </p>
            <div className="mt-8 space-y-6">
              {milestones.map(({ label, detail }) => (
                <div key={label} className="flex gap-4">
                  <div className="mt-1 h-8 w-8 rounded-full bg-blue-500/10 text-blue-200 flex items-center justify-center font-semibold">
                    {label.split('.')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-sm text-white/70">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur">
            <div className="flex items-center gap-3 text-sm text-white/60">
              <ScrollText className="h-5 w-5 text-blue-200" />
              Digital audit log preview
            </div>
            <div className="mt-6 space-y-4 text-sm">
              {[
                { time: '09:18', action: 'Publisher submitted vehicle photos + mileage.' },
                { time: '09:21', action: 'Renter signed renter-platform agreement.' },
                { time: '09:22', action: 'System captured payment proof (CBU transfer).' },
                { time: '09:28', action: 'Both parties received sealed PDF + evidence kit.' },
              ].map((entry) => (
                <div key={entry.time} className="flex gap-3 items-start">
                  <div className="text-blue-200 font-semibold">{entry.time}</div>
                  <p className="text-white/80 flex-1 border-b border-white/5 pb-3">{entry.action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="rounded-[36px] border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-10">
            <div className="grid md:grid-cols-3 gap-6">
              {proofPoints.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue-200" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-white/70">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-blue-200/80">Evidence kit</p>
                <p className="text-lg text-white/80 max-w-2xl">
                  From signatures to disputes, every action is mirrored into a consolidated PDF evidence kit you can share with insurers or legal counsel.
                </p>
              </div>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90"
              >
                Explore demo agreement
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/30">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4" /> Laburauto © {new Date().getFullYear()}
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-white">Log in</Link>
            <Link to="/register" className="hover:text-white">Create account</Link>
            <a href="mailto:hola@laburauto.com" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
