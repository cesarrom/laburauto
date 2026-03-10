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
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25)_0%,_transparent_50%)] pointer-events-none" />
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-8 relative z-10">
          <div className="flex items-center gap-3 font-semibold text-lg tracking-tight text-slate-900">
            <div className="h-11 w-11 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Car className="h-5 w-5 text-blue-600" />
            </div>
            Laburauto
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-slate-600">
            <Link to="/login" className="hover:text-slate-900 transition-colors">Ingresar</Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-2 text-sm font-semibold shadow-lg shadow-blue-200"
            >
              Crear cuenta
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 pb-20 pt-10 md:pt-16 text-center relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
            Alquileres P2P · Respaldados legalmente
          </p>
          <h1 className="mt-6 text-4xl md:text-6xl font-semibold leading-tight text-slate-900">
            Formalizá cualquier alquiler informal en minutos
            <span className="text-blue-600"> sin abogados ni fricción.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600">
            Laburauto transforma una charla de WhatsApp en un contrato defendible, capturando identidades, firmas y evidencia sincronizada para que ambas partes estén cubiertas si algo cambia.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-blue-200"
            >
              Crear contrato gratis
              <PenLine className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex justify-center items-center gap-2 rounded-xl border border-slate-200 px-8 py-3 text-base font-semibold text-slate-700"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-6xl mx-auto px-6 -mt-12">
          <div className="grid md:grid-cols-4 gap-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-blue-500">Cómo funciona</p>
            <h2 className="mt-4 text-3xl md:text-4xl font-semibold text-slate-900">Pensado para acuerdos que nacen fuera de Laburauto.</h2>
            <p className="mt-4 text-slate-600">
              Conocieron al conductor por Marketplace, un grupo de WhatsApp o referencias. Traen el acuerdo a Laburauto para sumar estructura, cláusulas y trazabilidad. No asignamos viajes: damos el soporte legal y operativo que falta.
            </p>
            <div className="mt-8 space-y-6">
              {milestones.map(({ label, detail }) => (
                <div key={label} className="flex gap-4">
                  <div className="mt-1 h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold">
                    {label.split('.')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-sm text-slate-600">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white border border-slate-100 p-8 shadow-lg">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <ScrollText className="h-5 w-5 text-blue-500" />
              Bitácora de evidencia
            </div>
            <div className="mt-6 space-y-4 text-sm">
              {[
                { time: '09:18', action: 'Publicador subió fotos del vehículo + kilometraje.' },
                { time: '09:21', action: 'Conductor firmó acuerdo plataforma-conductor.' },
                { time: '09:22', action: 'Sistema adjuntó comprobante de pago (transferencia CBU).' },
                { time: '09:28', action: 'Ambas partes recibieron PDF sellado + kit de evidencia.' },
              ].map((entry) => (
                <div key={entry.time} className="flex gap-3 items-start">
                  <div className="text-blue-600 font-semibold">{entry.time}</div>
                  <p className="text-slate-700 flex-1 border-b border-slate-100 pb-3">{entry.action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="rounded-[36px] border border-slate-100 bg-white p-10 shadow-xl">
            <div className="grid md:grid-cols-3 gap-6">
              {proofPoints.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{title}</p>
                    <p className="text-sm text-slate-600">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-blue-500">Kit probatorio</p>
                <p className="text-lg text-slate-600 max-w-2xl">
                  Cada acción queda replicada en un PDF único con firmas, fotos, pagos y registro cronológico para compartir con aseguradoras, estudios legales o fuerzas de seguridad.
                </p>
              </div>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-800"
              >
                Ver demo del contrato
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2 text-slate-600">
            <Car className="h-4 w-4 text-blue-600" /> Laburauto © {new Date().getFullYear()}
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-slate-900">Ingresar</Link>
            <Link to="/register" className="hover:text-slate-900">Crear cuenta</Link>
            <a href="mailto:hola@laburauto.com" className="hover:text-slate-900">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
