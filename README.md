# Dashboard de Prácticas Empresariales · Unicomfacauca

Dashboard web estático para consultar la evolución de las prácticas empresariales, organizaciones aliadas, proyectos, continuidad y alcance territorial.

Sitio: <https://andressolispino.github.io/dashboard/>

## Publicación sin servidor

La aplicación funciona completamente en GitHub Pages. No usa contraseñas, sesiones ni un backend propio.

El directorio público contiene exclusivamente:

- Nombre del estudiante.
- Semestre.
- Organización.
- Proyecto o actividad.
- Nombre del tutor empresarial, cuando está disponible.
- Ciudad, departamento y temática.

No se publican correos, teléfonos, celulares, horarios, opiniones ni otros datos de contacto. `scripts/audit-public-build.mjs` valida los campos autorizados y bloquea patrones de correo o teléfono antes de cada despliegue.

## Fuente de datos

Google Sheets continúa siendo la fuente maestra. Durante la compilación, `scripts/generate-fallback.mjs` consulta la pestaña `Consolidado` y genera dos archivos sanitizados:

- `src/data/fallback.json`: indicadores y gráficos.
- `src/data/directory.json`: directorio académico sin contactos.

El identificador de la hoja se guarda como variable restringida `GOOGLE_SHEET_ID` de GitHub Actions y no se incorpora al sitio. El flujo se ejecuta al actualizar `main`, manualmente y cada lunes.

## Desarrollo local

Requisitos: Node.js 24 y pnpm 11.9.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Para regenerar los datos desde Sheets, cree `.env.local` a partir de `.env.example` y ejecute:

```bash
pnpm generate:public
```

## Verificación

```bash
pnpm verify:public
```

Este comando ejecuta pruebas, compila la versión de GitHub Pages y audita que no se publiquen hojas de cálculo, variables privadas, mapas de código, correos o teléfonos.

## Mapa geográfico

El mapa usa Leaflet y teselas de OpenStreetMap. Los puntos representan centroides de ciudad, no direcciones particulares ni ubicaciones exactas de personas. Al seleccionar un punto se filtra el dashboard por ciudad.

## Despliegue

`.github/workflows/deploy-pages.yml` genera los datos sanitizados, instala dependencias bloqueadas, prueba, compila, audita y publica `dist` en GitHub Pages.
