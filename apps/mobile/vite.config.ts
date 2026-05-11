import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const stub = (name: string) => path.resolve(here, "web/stubs", name);

export default defineConfig({
  root: path.resolve(here, "web"),
  plugins: [react()],
  define: {
    __DEV__: "true",
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
    "process.env.EXPO_PUBLIC_API_URL": JSON.stringify(process.env.EXPO_PUBLIC_API_URL ?? "")
  },
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js"],
    alias: [
      { find: /^react-native$/, replacement: "react-native-web" },
      { find: /^react-native-tts$/, replacement: stub("react-native-tts.ts") },
      { find: /^react-native-keychain$/, replacement: stub("react-native-keychain.ts") },
      { find: /^react-native-image-picker$/, replacement: stub("react-native-image-picker.ts") },
      { find: /^react-native-document-picker$/, replacement: stub("react-native-document-picker.ts") },
      { find: /^react-native-fs$/, replacement: stub("react-native-fs.ts") },
      { find: /^lucide-react-native$/, replacement: "lucide-react" },
      { find: "@fintwin/shared", replacement: path.resolve(here, "../../packages/shared/src/index.ts") }
    ]
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".tsx", ".ts", ".jsx", ".js"],
      jsx: "automatic",
      loader: { ".js": "jsx" }
    }
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    host: true,
    proxy: {
      "/dashboard": "http://localhost:4000",
      "/spending-dna": "http://localhost:4000",
      "/campaigns": "http://localhost:4000",
      "/subscriptions": "http://localhost:4000",
      "/simulations": "http://localhost:4000",
      "/agent": "http://localhost:4000",
      "/documents": "http://localhost:4000",
      "/actions": "http://localhost:4000",
      "/business": "http://localhost:4000"
    }
  }
});
