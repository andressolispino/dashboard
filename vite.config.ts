import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  const publicSheetId = mode === "github-pages"
    ? String(localEnv.VITE_PUBLIC_GOOGLE_SHEET_ID || "").trim()
    : String(localEnv.VITE_GOOGLE_SHEET_ID || "").trim();

  return {
    base: "./",
    define: {
      __PUBLIC_SHEET_ID__: JSON.stringify(publicSheetId),
    },
    build: {
      target: "es2022",
      sourcemap: false,
    },
  };
});
