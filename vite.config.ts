import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/envmng.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
