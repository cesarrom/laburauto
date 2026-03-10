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
import ThemeToggle from '../components/ThemeToggle';

const featureCards = [
  {
    icon: ShieldCheck,
    title: 'Evidencia inviolable',
    description: 'Cada firma queda fechada, geolocalizada y auditada para responder ante seguros o autoridades en minutos.',
  },
  {
    icon: PenLine,
    title: 'Contratos en 2 minutos',
    description: 'Transformamos un chat informal en un documento completo con cláusulas locales y campos auto rellenados.',
  },
  {
    icon: Fingerprint,
    title: 'Identidad verificada',
    description: 'Solicitá DNI, selfies y comprobantes de pago sin salir de Laburauto, con retención segura de datos.',
  },
  {
    icon: TimerReset,
    title: 'Seguimiento en vivo',
    description: 'Timeline compartido para saber quién firmó, qué evidencia falta y cuándo se entrega o devuelve el vehículo.',
  },
];

const milestones = [
  {
    label: '1. Alinear condiciones',
    detail: 'Publicador o conductor responde un flujo guiado sobre tarifas, límite de km, fotos y depósito.',
  },
  {
    label: '2. Generar contrato',
    detail: 'Laburauto arma el acuerdo y envía invitaciones de firma multi-dispositivo.',
  },
  {
    label: '3. Subir evidencia',
    detail: 'Fotos, comprobantes y odómetro se cargan a la misma bitácora con trazabilidad.',
  },
  {
    label: '4. Compartir kit probatorio',
    detail: 'PDF sellado + historial para mediaciones, seguros o fuerzas de seguridad.',
  },
];

const proofPoints = [
  {
    icon: FileCheck,
    title: 'Cláusulas respaldadas',
    text: 'Modelos revisados con estudios locales y adaptables a distintas provincias argentinas.',
  },
  {
    icon: Users,
    title: 'Tercero neutral',
    text: 'Somos el árbitro imparcial que registra cada acción y simplifica la resolución de conflictos.',
  },
  {
    icon: CheckCircle2,
    title: 'Independiente de plataforma',
    text: 'Traé acuerdos iniciados en Marketplace, grupos o referidos y finalizalos en un entorno seguro.',
  },
];

const timelineEntries = [
  { time: '09:18', action: 'Publicador subió fotos del auto + kilometraje inicial.' },
  { time: '09:21', action: 'Conductor firmó el acuerdo plataforma-conductor.' },
  { time: '09:22', action: 'Sistema adjuntó comprobante de transferencia CBU.' },
  { time: '09:28', action: 'Se generó PDF sellado y se compartió el kit probatorio.' },
];

const stats = [
  { label: 'Contratos generados', value: '+4.2k' },
  { label: 'Disputas mediadas', value: '92%' },
  { label: 'Tiempo promedio', value: '1.8 min' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-500">
      <header className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-950/10 via-transparent to-transparent dark:from-brand-950/25 pointer-events-none" />
        <div className="absolute -top-40 right-[-140px] h-[520px] w-[520px] rounded-full bg-brand-500/20 blur-3xl opacity-70 animate-orbit" />
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-8 relative z-10">
          <Link to="/" className="flex items-center gap-3 font-display text-lg tracking-tight">
            <div className="h-11 w-11 rounded-2xl bg-surface text-brand-600 flex items-center justify-center shadow-soft">
              <Car className="h-5 w-5" />
            </div>
            Laburauto
          </Link>
          <div className="hidden md:flex items-center gap-3 text-sm">
            <ThemeToggle />
            <Link to="/login" className="px-4 py-2 rounded-full border border-border/70 text-text-muted hover:text-text transition-colors">Ingresar</Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2 font-semibold text-white shadow-lift hover:bg-brand-600"
            >
              Crear cuenta
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-6 pb-20 pt-10 md:pt-16 relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted shadow-soft">
              Alquileres P2P · Respaldados legalmente
            </p>
          </div>
          <div className="orbit-gradient rounded-[36px] bg-surface/80 px-6 py-10 md:px-12 shadow-soft">
            <h1 className="text-4xl md:text-6xl font-display font-semibold leading-tight">
              Formalizá cualquier alquiler informal en minutos
              <span className="block text-brand-500">sin abogados ni fricción innecesaria.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-text-muted max-w-3xl mx-auto">
              Laburauto convierte tu intercambio en WhatsApp en un contrato defendible, con identidades verificadas, firmas digitales y bitácora compartida para que ambos lados estén cubiertos ante cualquier imprevisto.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex justify-center items-center gap-2 rounded-2xl bg-brand-500 px-8 py-3 text-base font-semibold text-white shadow-lift hover:bg-brand-600"
              >
                Crear contrato gratis
                <PenLine className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex justify-center items-center gap-2 rounded-2xl border border-border px-8 py-3 text-base font-semibold text-text"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-surface border border-border px-6 py-4 shadow-soft animate-fade-up"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <p className="text-sm uppercase tracking-[0.4em] text-text-muted">{stat.label}</p>
                <p className="mt-2 text-3xl font-display text-brand-500">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-6xl mx-auto px-6 -mt-12">
          <div className="grid md:grid-cols-4 gap-4">
            {featureCards.map(({ icon: Icon, title, description }, index) => (
              <div
                key={title}
                className="rounded-3xl bg-surface border border-border p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="h-12 w-12 rounded-2xl bg-surface-muted flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-brand-500" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-text-muted">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <p className="text-xs uppercase tracking-[0.4em] text-brand-500">Cómo funciona</p>
            <h2 className="mt-4 text-3xl md:text-4xl font-display font-semibold">Pensado para acuerdos que nacen fuera de Laburauto.</h2>
            <p className="mt-4 text-text-muted">
              Si se conocieron por Marketplace, grupos o referencias, pueden traer el acuerdo a Laburauto para sumar estructura legal, trazabilidad y soporte. No intermediamos el viaje; damos el andamiaje documental y operativo que falta.
            </p>
            <div className="mt-8 space-y-6">
              {milestones.map(({ label, detail }, index) => (
                <div key={label} className="flex gap-4 animate-fade-up" style={{ animationDelay: `${0.15 + index * 0.08}s` }}>
                  <div className="mt-1 h-8 w-8 rounded-full bg-surface-muted text-brand-600 flex items-center justify-center font-semibold">
                    {label.split('.')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-sm text-text-muted">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-surface border border-border p-8 shadow-lift animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3 text-sm text-text-muted">
              <ScrollText className="h-5 w-5 text-brand-500" />
              Bitácora de evidencia
            </div>
            <div className="mt-6 space-y-4 text-sm">
              {timelineEntries.map((entry, index) => (
                <div key={entry.time} className="flex gap-3 items-start animate-fade-up" style={{ animationDelay: `${0.25 + index * 0.08}s` }}>
                  <div className="text-brand-500 font-semibold">{entry.time}</div>
                  <p className="text-text flex-1 border-b border-border pb-3">{entry.action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="rounded-[36px] border border-border bg-surface p-10 shadow-soft">
            <div className="grid md:grid-cols-3 gap-6">
              {proofPoints.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="flex gap-4 animate-fade-up" style={{ animationDelay: `${0.1 + index * 0.1}s` }}>
                  <div className="h-12 w-12 rounded-2xl bg-surface-muted flex items-center justify-center">
                    <Icon className="h-5 w-5 text-brand-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-brand-500">Kit probatorio</p>
                <p className="text-lg text-text-muted max-w-2xl">
                  Cada evento queda reflejado en un PDF único con firmas, fotos, pagos y registros cronológicos para enviarlo a aseguradoras, estudios legales o fuerzas de seguridad sin perder contexto.
                </p>
              </div>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-text hover:border-brand-500"
              >
                Ver demo del contrato
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <div className="flex items-center gap-2 text-text">
            <Car className="h-4 w-4 text-brand-500" /> Laburauto &copy; {new Date().getFullYear()}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/login" className="hover:text-text">Ingresar</Link>
            <Link to="/register" className="hover:text-text">Crear cuenta</Link>
            <a href="mailto:hola@laburauto.com" className="hover:text-text">Contacto</a>
            <ThemeToggle className="md:hidden" />
          </div>
        </div>
      </footer>
    </div>
  );
}
