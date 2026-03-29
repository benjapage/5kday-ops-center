# 5KDay Ops Center — Documento de Mejoras V2

## Contexto

Aplicación: **5KDay Ops Center** — Centro de control operativo para negocio de infoproductos low ticket.
Usuario: Benjamín Pagella Fangio (Admin).
Stack: React + Vite + Supabase + Vercel.
URL actual: https://5kday-ops-center.vercel.app

Este documento contiene 20 mejoras organizadas por sección, listas para implementar en Claude Code.

---

## 1. NAVEGACIÓN Y LAYOUT GENERAL

### Cambio 1 — Sidebar colapsable
- El sidebar izquierdo debe ser **colapsable por defecto** (solo íconos visibles o un botón hamburguesa).
- El dashboard principal ocupa el 100% del ancho cuando el sidebar está cerrado.
- El usuario puede desplegar el sidebar para navegar entre secciones (Dashboard, Activos Meta, Financiero, Pipeline, Equipo, Integraciones, Configuración).
- Animación suave de apertura/cierre.

### Cambio 2 — Dark mode como default
- La app arranca siempre en **modo oscuro**.
- Opción de cambiar a modo claro en Configuración, pero el default es dark.
- Todos los componentes, modales, formularios y dropdowns deben estar correctamente estilizados en dark mode (actualmente hay errores visuales al editar/crear elementos).

### Cambio 20 — Estética general
- **Tipografía de números**: Cambiar el estilo monospace/código actual por una tipografía moderna y limpia (ej: Inter, DM Sans o similar). Los números deben verse elegantes, no como una terminal.
- **Formularios y modales en dark mode**: Arreglar todos los formularios de creación/edición. Actualmente se ven mal: fondos blancos que flashean, campos ilegibles, colores incorrectos.
- **Colores negativos (Cambio 15)**: El rojo para números negativos es demasiado agresivo y predominante. Usar un tono más suave (ej: coral o salmon) o un indicador sutil como una flecha ↓ en vez de pintar todo de rojo fuerte. El pantallazo general no debe parecer una catástrofe.
- **UI general**: Pulir para que se sienta más profesional y menos "programada". Bordes más suaves, espaciado consistente, transiciones suaves.

---

## 2. DASHBOARD PRINCIPAL

El dashboard se reorganiza completamente en una estructura clara y compacta.

### Layout del dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  "Buenos días, Benjamín"    [═══════ Meta del mes ════════]  │
│  Resumen operativo · Fecha        US$17k / US$60k  28%      │
├──────────────────────────────┬──────────────────────────────┤
│  CUADRANTE SUPERIOR IZQ.    │  CUADRANTE SUPERIOR DER.     │
│                              │                              │
│  Gráfico de barras           │  WhatsApp                    │
│  Facturación + Profit        │  Números + estados           │
│  diario (últimos 30 días)    │  Barras de calentamiento     │
│                              │                              │
├──────────────────────────────┬──────────────────────────────┤
│                              │  CUADRANTE INFERIOR DER.     │
│                              │                              │
│                              │  Alertas de hoy              │
│                              │  Baneos, restricciones,      │
│                              │  vencimientos                │
│                              │                              │
├────────────────┬─────────────┴───────┬─────────────────────┤
│  FILA INFERIOR │                     │                      │
│  (3 columnas)  │                     │                      │
│                │                     │                      │
│  Pipeline      │  Tareas del día     │  Creativos           │
│  activo        │  (checklist)        │  (subidos/pendientes)│
│                │                     │                      │
└────────────────┴─────────────────────┴─────────────────────┘
```

### Cambio 3+4 — Gráfico de barras (cuadrante superior izquierdo)
- **Eliminar la fila de 5 cards de métricas superiores** (Profit, Facturación, Inversiones, Revenue Shopify, ROAS). Ocupan mucho espacio y no son tan visuales.
- **Reemplazar con un gráfico de barras** que muestre facturación y profit diario de los últimos 30 días.
- Barras limpias y uniformes. Color violeta/azul oscuro para facturación, verde para profit.
- Estilo compacto — es un vistazo rápido, no el gráfico completo del módulo financiero.
- Puede incluir los números clave (profit del mes, facturación, ROAS) como indicadores pequeños encima o al costado del gráfico.

### Cambio 5 — Fuente de datos: Shopify (no Meta)
- El dashboard se alimenta **exclusivamente de Shopify** para facturación, revenue y ventas.
- **Sacar la integración con Meta Ads** del dashboard principal — no está funcionando bien y genera datos poco confiables.
- Lo único que se mantiene de Meta es el dato de **inversión en anuncios**, que se carga manualmente o desde otra fuente.
- En una fase 2 se reevalúa la conexión con Meta.

### Cambio 6 — WhatsApp (cuadrante superior derecho)
- Módulo de WhatsApp con los números, estados (listo/calentando/baneado) y barras de calentamiento.
- **Mejorar estéticamente**: botones más pulidos, indicadores más visuales, tipografía más limpia que la versión actual.
- Mantener los badges de color: verde = listas, amarillo = calentando, rojo = baneadas.

### Cambio 6 — Alertas de hoy (cuadrante inferior derecho)
- Alertas relevantes: baneos, restricciones, números que vencen, BMs en riesgo, etc.
- Si no hay alertas, mostrar un mensaje positivo tipo "Todo en orden ✓".

### Cambio 7 — Meta del mes (en el header)
- Mover la meta del mes al header, al lado derecho de "Buenos días, Benjamín".
- Indicador compacto: número objetivo (US$ 60.000), progreso actual (US$ 17.076), porcentaje (28%), y una **barra de progreso** visual mostrando cuánto falta.
- Siempre visible, no ocupa un cuadrante entero.
- Desglose rápido debajo de la barra: Inversión Ads, Apps/Tools, Equipo, Margen Neto.

### Cambio 8 — Pipeline activo (fila inferior, columna izquierda)
- Lista de ofertas activas con datos enriquecidos por cada una:
  - **Nombre del producto**
  - **Canal**: Shopify / WhatsApp (badge)
  - **Idioma**: EN / ES / PT / etc. (badge)
  - **Anuncios activos esta semana**: número
  - **Indicador de performance**: algún KPI rápido (ej: ROAS o status)

### Cambio 9 — Tareas del día (fila inferior, columna del medio)
- **Checklist de tareas de hoy**, vinculado a Notion Calendar.
- Cada tarea muestra: hora + descripción.
- El usuario puede tachar/completar tareas directamente desde el dashboard.
- Ejemplo:
  - ☐ 7:00 — Reunión con Yane
  - ☐ 7:00 — Subir anuncios Esqueletización
  - ☑ 9:00 — Revisar métricas del día anterior
- **Integración con Notion Calendar vía API** para sincronización automática.
- Las tareas están vinculadas con las ofertas del Pipeline (Cambio 16).

### Cambio 10 — Creativos (fila inferior, columna derecha)
- Lista de anuncios/creativos del día: subidos y pendientes de subir.
- Cada creativo muestra: nombre, estado (subido ✓ / pendiente ○), oferta asociada.
- **Fase 1**: carga manual.
- **Fase 2**: vinculación con Google Drive para sincronización automática.

---

## 3. ACTIVOS META

### Cambio 11 — Reestructurar con foco en números y perfiles (no BMs)

La sección de Activos Meta se reorganiza para centrarse en lo que importa operativamente: números de WhatsApp y perfiles de Meta. Los BMs pasan a ser un dato secundario.

**Bloque 1 — Números de WhatsApp:**
Cada número muestra:
- Estado: listo / calentando / baneado (con color)
- Oferta asignada
- País (bandera + código)
- BM al que pertenece (dato secundario)
- Contador general de stock: cuántos números necesitás comprar

**Bloque 2 — Perfiles de Meta:**
Cada perfil muestra:
- Estado: calentando / activo / baneado
- **Función del perfil** (badge/etiqueta): ej. "publicitario", "calentamiento", "soporte"
- BM vinculado (dato secundario)
- Contador de stock: cuántos perfiles necesitás comprar

### Cambio 12 — Vinculación en cascada y correcciones

**Relación entre activos:**
```
Perfil → BM → Número de WA
              → Cuenta Publicitaria
```

- Todos los activos deben estar vinculados entre sí.
- **Si un BM se restringe**, los números y cuentas publicitarias vinculadas a ese BM deben mostrar automáticamente una alerta o cambiar de estado visual.
- **Perfil ID**: sacar como campo obligatorio al agregar un perfil. Permitir crear perfiles con nombre/alias sin requerir un ID técnico.
- **Vista en dark mode**: calibrar los colores de la tabla y badges para que se lean correctamente.

### Cambio 14 — Campos de función/tipo en activos

- **Cuentas publicitarias**: campo que indique si vende por **WhatsApp** o por **Landing (Shopify)**. Badge visible.
- **BMs**: campo de **función del BM** (ej: "para números", "para cuentas publicitarias", "mixto"). Badge/etiqueta visible.
- **Perfiles**: campo de **función del perfil** (ej: "publicitario", "calentamiento", "admin"). Badge/etiqueta visible.

---

## 4. MÓDULO FINANCIERO

### Cambio 13 — Rediseño del módulo financiero

**Sacar:**
- La tabla grande del P&L diario — es muy negativa visualmente y poco útil como vista principal.

**Mantener:**
- Los bloques de métricas de arriba (Ingresos del mes, Inversiones, Profit, ROAS) — están buenos.

**Nuevo layout: 4 cuadrantes:**

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│    Suscripciones        │    Inversión en Meta     │
│    (apps y tools)       │    (gasto en ads)        │
│                         │                         │
├─────────────────────────┼─────────────────────────┤
│                         │                         │
│  Facturación WhatsApp   │  Facturación Shopify     │
│  (ingresos canal WA)    │  (ingresos canal landing)│
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

- Cada cuadrante vinculado a la cuenta publicitaria correspondiente.
- Los cuadrantes de facturación (WA y Shopify) muestran datos de las cuentas publicitarias según su tipo (definido en Cambio 14).
- El gráfico de barras detallado (Ingresos, Gastos y Profit diario) se mantiene en la pestaña "Gráfico", pero no es la vista principal.

---

## 5. PIPELINE

### Cambio 16 — Rediseño de la sección Pipeline

**Sacar:**
- Cuadraditos de arriba (Activas/Pausadas/Archivadas) — dato irrelevante como bloque grande.
- Columna "Meta facturación" — irrelevante.
- Columnas "Inicio" y "Días" — irrelevantes.

**Modificar:**
- **País/Canal**: permitir **múltiples países** por oferta (ej: una oferta corre en AR + US + BR simultáneamente). Selector multi-select, no single.
- **Creativos semana**: mostrar como progreso vs objetivo → "3/10" en vez de solo "3".

**Agregar:**
- **Vinculación oferta → cuenta publicitaria**: cada oferta se conecta a su CP (la oferta apunta a la CP, no al revés).
- **Columna/sección de tareas por oferta**: vinculada al checklist del dashboard principal y a Notion Calendar. Si tenés una tarea "subir upsell a Esqueletización Botánica", aparece tanto en el dashboard como dentro de esa oferta en Pipeline.

### Cambio 17 — Detalle por oferta: log + notas

En la vista de detalle de cada oferta:

**Sacar:**
- Meta de facturación.

**Mejorar — Notas de campaña se divide en dos:**

**A) Log de campaña (cronológico):**
- Entradas con fecha/hora + acción + resultado.
- Cada cambio se registra como entrada nueva que se apila cronológicamente.
- Ejemplo:
  - 27/03 14:30 — "Cambié a Cost Cap $5 en CP3"
  - 27/03 18:00 — "Subí presupuesto de $50 a $100"
  - 26/03 10:00 — "Pausé ad set 2, CTR bajo"
- Nunca se pierde historial.

**B) Notas libres:**
- Campo de texto abierto para ideas, estrategias, próximos pasos.
- Tipo bloc de notas permanente de esa oferta.
- Más rico que un textarea simple: idealmente con formato básico (negritas, bullets).

### Cambio 18 — Banco de creativos

- Actualmente no funciona — está vacío y sin vinculación.
- **Fase 1**: Si no se puede conectar Drive aún, como mínimo: un embed o link directo que abra la carpeta de Google Drive correspondiente a cada oferta.
- **Fase 2**: Vinculación con Google Drive vía API. Los creativos (imágenes, videos) aparecen directamente desde una carpeta específica de Drive. Vista tipo grilla de thumbnails/galería, sin subir nada manualmente.

---

## 6. INTEGRACIONES (ROADMAP)

### Cambio 19 — Visión de integraciones

**Fase 1 (inmediata):**
- **Shopify**: fuente principal de datos de facturación y ventas.
- **Notion Calendar**: sincronización de tareas (checklist del dashboard + tareas por oferta en Pipeline).

**Fase 2 (corto plazo):**
- **Google Drive**: vinculación para banco de creativos y archivos por oferta.
- **UTMify**: fuente principal de datos financieros fuera de Meta.
- **Mobile/responsive**: la app debe funcionar correctamente en celular (responsive design o PWA).

**Fase 3 (mediano plazo):**
- **Meta Ads**: reconexión cuando sea estable y confiable.
- **ManyChat**: integración multi-cuenta (un ManyChat por número).
- **Agentes de Claude**: poder asignarle tareas a agentes de IA desde la app, vinculados a ofertas específicas. Ej: "Agente, haceme el producto para la oferta X" y que arranque a trabajar.

---

## Resumen de prioridades

| Prioridad | Cambios | Impacto |
|-----------|---------|---------|
| 🔴 Alta | 1, 2, 3, 4, 5, 6, 7, 20 | Dashboard principal usable y visual |
| 🟡 Media | 8, 9, 10, 11, 12, 14 | Activos y Pipeline funcionales |
| 🟢 Normal | 13, 15, 16, 17 | Módulos secundarios mejorados |
| 🔵 Fase 2 | 18, 19 | Integraciones y expansión |

---

## Notas para Claude Code

- El proyecto ya existe y está deployado en Vercel.
- La base de datos está en Supabase con tablas existentes para números WA, BMs, cuentas publicitarias, ofertas, finanzas y equipo.
- Implementar los cambios de forma incremental, empezando por el dashboard principal (Cambios 1-10) y luego las secciones internas.
- Testear en dark mode después de cada cambio significativo.
- Mantener la estructura de componentes React existente donde sea posible.
