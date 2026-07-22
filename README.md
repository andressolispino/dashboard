# Dashboard de Prácticas Empresariales · Unicomfacauca

Dashboard web responsive para analizar evolución semestral, organizaciones aliadas, áreas de trabajo, duración, continuidad y alcance territorial de las prácticas empresariales.

## Privacidad por diseño

- La vista pública solo maneja semestre, organización, fechas, proyecto, categoría analítica, ubicación y totales agregados.
- El respaldo incluido en `src/data/fallback.json` no contiene nombres de estudiantes, tutores, teléfonos ni correos.
- El Excel original, `.env.local`, `dist` y otras fuentes sensibles están excluidos por `.gitignore`.
- El proceso de publicación ejecuta una auditoría y falla si detecta hojas de cálculo, archivos de entorno, mapas de código fuente o campos no autorizados en el respaldo.

Importante: no use como fuente pública el archivo maestro que contiene datos personales. Para actualización en vivo desde GitHub Pages se necesita **otro archivo de Google Sheets**, anonimizado y compartido solo para lectura.

## Ejecutar localmente

Requiere Node.js 24 o superior y pnpm 11.9.0.

```bash
npx pnpm@11.9.0 install --frozen-lockfile
npx pnpm@11.9.0 dev
```

La configuración local está en `.env.local`, que no se sube al repositorio. En este equipo conserva la conexión directa con la hoja institucional.

## Verificar la versión publicable

```bash
npx pnpm@11.9.0 run verify:public
npx pnpm@11.9.0 preview
```

`verify:public` ejecuta pruebas, compila el sitio y audita el contenido de `dist`.

## Modo administrador local

GitHub Pages es estático y no puede proteger información personal. Por eso el modo administrador funciona únicamente mediante el servidor local incluido, con contraseña validada en servidor, cookie `HttpOnly`, límite de intentos y sesión temporal.

En `.env.local`, agregue una frase privada de al menos 12 caracteres:

```text
ADMIN_PASSWORD=una-frase-larga-y-privada
```

Después ejecute:

```bash
npx pnpm@11.9.0 run serve:secure
```

Abra `http://127.0.0.1:4173` y seleccione **Modo administrador**. La contraseña y los datos personales no se incorporan al sitio estático.

## Actualización semestral

1. Agregue los registros en `Consolidado` sin alterar los encabezados.
2. Use semestre `AAAA-1` o `AAAA-2`.
3. Registre fechas reales de inicio y finalización.
4. Diligencie ciudad y departamento en P y Q; R y S conservan la fuente y el estado de validación.
5. Regenerar el respaldo público:

```bash
npx pnpm@11.9.0 run generate:fallback
```

Revise el cambio de `src/data/fallback.json` antes de publicarlo.

## Publicar en GitHub Pages

El proyecto está preparado, pero este repositorio local **no se ha subido ni publicado**.

1. Cree un repositorio en GitHub y suba los archivos respetando `.gitignore`.
2. Use `main` como rama principal.
3. En **Settings → Pages**, seleccione **GitHub Actions**.
4. Envíe los cambios a `main` o ejecute manualmente **Publicar dashboard en GitHub Pages** desde Actions.

El flujo `.github/workflows/deploy-pages.yml` instala las versiones bloqueadas, prueba, compila, audita y publica `dist`. Las rutas son relativas, por lo que funciona tanto en `usuario.github.io` como en `usuario.github.io/nombre-repositorio/`.

### Conexión pública en vivo opcional

Sin configuración adicional, GitHub Pages usa el respaldo agregado incluido: es la opción segura.

Para actualización en vivo:

1. Cree un **archivo de Google Sheets separado** que no contenga ninguna columna personal.
2. Conserve una pestaña `Consolidado` con las columnas públicas esperadas.
3. Compártalo como lector para cualquier persona con el enlace.
4. En **Settings → Secrets and variables → Actions → Variables**, cree `PUBLIC_GOOGLE_SHEET_ID` con el ID de esa hoja anonimizada.

Nunca coloque el ID de la hoja maestra privada en esa variable.
