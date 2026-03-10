import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-pressed={isDark}
      className={clsx(
        'relative inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70',
        'bg-surface text-text shadow-sm hover:border-brand-500/60',
        className,
      )}
    >
      <span className="relative flex h-5 w-10 items-center rounded-full bg-surface-muted/80 p-0.5 shadow-inner">
        <span
          className={clsx(
            'h-4 w-4 rounded-full bg-brand-500 transition-transform duration-300',
            isDark ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
      <span className="flex items-center gap-1 text-xs uppercase tracking-[0.25em] text-text-muted">
        {isDark ? (
          <>
            <Moon className="h-4 w-4" aria-hidden="true" />
            Noche
          </>
        ) : (
          <>
            <Sun className="h-4 w-4" aria-hidden="true" />
            Día
          </>
        )}
      </span>
    </button>
  );
}

export default ThemeToggle;
