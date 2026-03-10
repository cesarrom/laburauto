---
title: Identidad visual de Laburauto
last_updated: 2026-03-09
---

## Principios

1. **Confianza legal**: la interfaz debe transmitir orden, trazabilidad y respaldo jurídico.
2. **Cercanía operativa**: lenguaje directo, guiado y en español rioplatense.
3. **Bajo estrés**: superficies claras, jerarquías simples y buen contraste para evitar fricción durante firmas o reclamos.

## Tipografías

| Rol            | Familia                                           | Uso principal                               |
| -------------- | ------------------------------------------------- | ------------------------------------------- |
| Display        | _Space Grotesk Variable_                          | Titulares, métricas clave, CTAs             |
| Texto / UI     | _Inter Variable_                                  | Cuerpo, formularios, navegación             |
| Monoespaciada* | `ui-monospace`, SFMono, Menlo (fallback del sistema) | Códigos y valores de seguimiento (opcional) |

_*No se carga una fuente monoespaciada adicional para optimizar el bundle._

## Paleta cromática

| Token              | Light mode                               | Dark mode                                | Uso |
| ------------------ | ---------------------------------------- | ---------------------------------------- | --- |
| `brand-500`        | `#2563EB`                                 | `#60A5FA`                                 | Botones primarios, focos interactivos |
| `brand-600`        | `#1D4ED8`                                 | `#3B82F6`                                 | Hover / estados activos |
| `brand-950`        | `#0A1B4F`                                 | `#E0F2FE`                                 | Gradientes, acentos hero |
| `background`       | `#F8FAFC`                                 | `#050816`                                 | Fondo general |
| `surface`          | `#FFFFFF`                                 | `#0F172A`                                 | Tarjetas, barras laterales |
| `surface-muted`    | `#EFF3FF`                                 | `#111C33`                                 | Badges, highlights secundarios |
| `border`           | `rgba(15,23,42,0.08)`                     | `rgba(148,163,184,0.35)`                  | Divisores, inputs |
| `text`             | `#0F172A`                                 | `#F8FAFC`                                 | Texto primario |
| `text-muted`       | `#475569`                                 | `#CBD5F5`                                 | Líneas descriptivas |
| `success`          | `#0F9D58`                                 | `#34D399`                                 | Estados verificados |
| `warning`          | `#F97316`                                 | `#FDBA74`                                 | Alertas preventivas |
| `danger`           | `#DC2626`                                 | `#F87171`                                 | Errores críticos |

## Tonos y lenguaje visual

- Gradientes sutiles blanco → celeste para reforzar legalidad y cielo abierto.
- Ilustraciones basadas en tarjetas, líneas y badges de “bitácora”.
- Microinteracciones: opacidades y sombras suaves, sin animaciones estridentes.

## Motion & Animaciones

- **Principio "respirar"**: máximo dos animaciones simultáneas en pantalla completa. Priorizar loops lentos (12–18s) para fondos y pulsos cortos (150–250 ms) para interacción.
- **Hero & fillers**: usar gradientes animados (`orbit`), partículas sutiles o brillos desplazados para dar vida sin distraer. Opacidad ≤ 0.25.
- **Componentes clave**: timeline, tarjetas de evidencia y CTAs pueden emplear `slide-up` con delay escalonado (40 ms) para reforzar jerarquía.
- **Estados de feedback**: emplear `shadow-glow` y `pulse` en hover/focus, respetando `prefers-reduced-motion` (las animaciones deben desactivarse cuando el usuario lo pida).
- **Duraciones estándar**:
  - Entradas: 220 ms (curva `cubic-bezier(0.4, 0, 0.2, 1)`)
  - Hover/focus: 140 ms
  - Loops decorativos: mínimo 10 s para evitar fatiga visual

## Radios

| Token            | Valor | Aplicación |
| ---------------- | ----- | ---------- |
| `radius-xs`      | `6px` | Badges, chips |
| `radius-sm`      | `12px`| Botones secundarios |
| `radius-md`      | `16px`| Botones primarios, inputs |
| `radius-lg`      | `24px`| Tarjetas y contenedores hero |
| `radius-full`    | `999px`| Pills, toggles |

## Sombras

| Token         | Definición                                               | Uso |
| ------------- | -------------------------------------------------------- | --- |
| `shadow-soft` | `0 10px 30px rgba(15,23,42,0.08)`                        | Tarjetas base |
| `shadow-lift` | `0 20px 45px rgba(37,99,235,0.18)`                       | CTA principales |
| `shadow-glow` | `0 0 0 1px rgba(37,99,235,0.35), 0 10px 50px rgba(14,165,233,0.35)` | Estados de foco/acento |

## Patrones reutilizables

- **Tarjeta bitácora**: superficie `surface`, borde tenue, layout vertical con timestamp destacado.
- **Badge de estado**: fondo `surface-muted`, texto `brand-700`, radio `full`.
- **Timeline**: conectores con degradado brand-500 → brand-300.

## Accesibilidad

- Contrastes mínimos AA (4.5:1) para texto cuerpo.
- Soporte para tema claro/oscuro con `prefers-color-scheme` + toggle manual.
- Tiempos de animación <= 200ms y cumpliendo `prefers-reduced-motion`.
