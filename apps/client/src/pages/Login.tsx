import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { isAxiosError } from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(searchParams.get('error') || '');
  const ssoEnabled = import.meta.env.VITE_AUTHENTIK_ENABLED === 'true';
  const ssoLoginUrl = import.meta.env.VITE_SSO_LOGIN_URL || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/app');
    } catch (err) {
      const apiError = isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined;
      setError(apiError || 'No pudimos iniciar sesión');
    }
  };

  const handleInternalLogin = () => {
    if (!ssoLoginUrl) {
      setError('SSO no está configurado en este entorno');
      return;
    }

    window.location.assign(ssoLoginUrl);
  };

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center px-4 py-12">
      <div className="max-w-5xl w-full grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.5em] text-text-muted">Laburauto · Acceso seguro</p>
          <h1 className="text-4xl font-display">Ingresá a tu panel operativo</h1>
          <p className="text-text-muted text-lg">
            Administrá contratos, evidencia y timeline de alquileres desde un único panel. Tres pasos para volver al trabajo: credenciales, verificación y firmas.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[{ label: 'Contratos activos', value: '+850' }, { label: 'Firmas digitales', value: '+7.4k' }].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border px-4 py-3 shadow-soft">
                <p className="text-xs uppercase tracking-[0.4em] text-text-muted">{stat.label}</p>
                <p className="text-2xl font-display text-brand-500">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[32px] p-8 shadow-lift">
          <div className="mb-6">
            <h2 className="text-2xl font-display">Iniciar sesión</h2>
            <p className="text-sm text-text-muted">Ingresá tus credenciales o usá el acceso interno.</p>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/40 text-red-600 px-4 py-3 rounded-2xl text-sm mb-4 shadow-soft">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-text-muted">Correo electrónico</label>
              <input
                type="email"
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background focus:border-brand-500 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-text-muted">Contraseña</label>
              <input
                type="password"
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background focus:border-brand-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand-500 text-white py-3 rounded-2xl font-semibold hover:bg-brand-600 transition shadow-lift"
            >
              Entrar al panel
            </button>
          </form>

          {ssoEnabled && (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-text-muted">
                <div className="h-px flex-1 bg-border" />
                <span>Equipo interno</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={handleInternalLogin}
                className="mt-4 w-full border border-border text-text py-3 rounded-2xl hover:border-brand-500 transition"
              >
                Continuar con Authentik (Admin)
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-text-muted">
            ¿Todavía no tenés cuenta?{' '}
            <Link to="/register" className="text-brand-500 font-semibold hover:underline">Registrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
