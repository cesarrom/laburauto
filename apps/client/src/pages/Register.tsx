import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRegister } from '../hooks/useApi';
import { registerSchema, type RegisterData } from '../schemas/validation';
import type { User } from '@laburauto/shared';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      const result = await registerMutation.mutateAsync({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      login(result.token, result.user as unknown as User);
      navigate('/onboarding');
    } catch (error) {
      console.error('Registration failed:', error);
      alert('No pudimos crear tu cuenta. Intentá nuevamente.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center px-4 py-16">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.5em] text-text-muted">Laburauto · Alta de cuenta</p>
          <h1 className="text-4xl font-display">Formalizá tu operativa en minutos</h1>
          <p className="text-text-muted text-lg">
            Con una sola cuenta gestionás contratos, evidencia y cronologías para cada alquiler. Te guiamos paso a paso para que tu flota y tus conductores estén cubiertos.
          </p>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
            <p className="text-xs uppercase tracking-[0.4em] text-text-muted">Incluye</p>
            <ul className="mt-3 space-y-2 text-sm text-text">
              <li>• Generador de contratos jurídicamente consistentes</li>
              <li>• Bitácora probatoria y firmas digitales</li>
              <li>• Acceso a soporte prioritario en disputas</li>
            </ul>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[32px] p-8 shadow-lift">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-display">Crear cuenta</h2>
              <p className="text-sm text-text-muted">Completa tus datos para comenzar.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-text-muted">Nombre y apellido</label>
              <input
                {...register('name')}
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background focus:border-brand-500 focus:outline-none"
                placeholder="Camila Rodríguez"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-text-muted">Correo electrónico</label>
              <input
                type="email"
                {...register('email')}
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background focus:border-brand-500 focus:outline-none"
                placeholder="camila@tuempresa.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-text-muted">Contraseña</label>
              <input
                type="password"
                {...register('password')}
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background focus:border-brand-500 focus:outline-none"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-text-muted">Repetir contraseña</label>
              <input
                type="password"
                {...register('confirmPassword')}
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-border bg-background focus:border-brand-500 focus:outline-none"
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || registerMutation.isPending}
              className="w-full bg-brand-500 text-white py-3 rounded-2xl font-semibold hover:bg-brand-600 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-lift"
            >
              {registerMutation.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>

            {registerMutation.isError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-600 px-4 py-3 rounded-2xl text-sm">
                {registerMutation.error?.message || 'No pudimos registrar tu cuenta. Volvé a intentar.'}
              </div>
            )}
          </form>

          <div className="mt-6 text-center text-sm text-text-muted">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-brand-500 font-semibold hover:underline">
              Iniciá sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
