---
title: PRD · Identidad visual + modo claro/oscuro
last_updated: 2026-03-09
owner: cascade
---

## Contexto
La app heredó estilos utilitarios de Tailwind sin un lenguaje visual coherente. La landing nueva luce distinta al resto y no existe soporte oficial para modo claro/oscuro ni lineamientos de animación. Necesitamos unificar tokens, tipografías y comportamiento para que el producto comunique el valor legal-operativo de Laburauto.

## Objetivos
1. Definir un sistema de diseño reutilizable (tipografías, colores, radios, sombras, motion) alineado a la identidad argentina.
2. Implementar toggles y utilidades para soportar light/dark, incluyendo `prefers-color-scheme` + persistencia manual.
3. Aplicar el sistema al landing hero + componentes clave (timeline, tarjetas, CTA) con animaciones discretas.

## No objetivos
- No se reescriben todas las vistas internas (Home, Dashboard). Se crea la base para migrarlas luego.
- No se incorporan librerías de componentes externas (Mantine, MUI). Todo se mantiene con Tailwind + CSS propio.

## Requerimientos funcionales
1. **Tokens globales**
   - Definir CSS variables para tipografías, radios, sombras y colores (`--la-color-*`).
   - Exponer helpers de Tailwind (theme extend) para reutilizar tokens.
2. **Themado**
   - Detectar tema inicial por `prefers-color-scheme`.
   - Permitir override manual guardado en `localStorage` (`laburauto-theme`).
   - Exponer hook `useTheme` para leer/modificar estado.
3. **Animaciones**
   - Crear clases utilitarias (`animate-orbit`, `animate-fade-up`, `animate-pulse-soft`).
   - Respetar `prefers-reduced-motion` (desactivar loops o reducir amplitud).
4. **Landing**
   - Aplicar tokens (fuentes Space Grotesk + Inter), gradientes definidos y animaciones.
   - Agregar toggle de tema visible en navbar.
   - Ajustar secciones para que cambien colores según modo.
5. **Accesibilidad**
   - Contraste AA mínimo.
   - Toggle accesible (aria-pressed, focus-visible).

## KPI / éxito
- LCP del landing dentro de ±5% vs versión actual (sin penalizar performance).
- Selección de tema persiste entre cargas.
- Animaciones máximas: 2 hero + 1 timeline, sin jitter.

## Riesgos
- Tailwind v4 (usada) aún experimental: validar configuración extendida.
- Posible desalineación con páginas internas hasta migración futura.

## Plan de trabajo
1. **Infraestructura**: instalar `@fontsource-variable/space-grotesk` y `@fontsource-variable/inter`, definir CSS variables, actualizar Tailwind.
2. **Theme Provider**: crear contexto o extender `UIContext` para almacenar tema + hook `useTheme`. Implementar detección inicial y persistencia.
3. **Estilos globales**: actualizar `index.css` con capas base, definir clases de animación y background generativo.
4. **Landing**: integrar toggle, aplicar tokens, agregar animaciones (gradiente orbit, reveal en cards, pulso CTA).
5. **QA**: revisar responsive, dark/light parity y ejecutar `pnpm --filter client build`.
6. **Documentación**: actualizar `identity.md` si surge ajuste adicional (ya contiene motion).
