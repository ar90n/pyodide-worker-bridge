export default {
  pyodideVersion: "0.27.5",
  modules: [
    {
      input: "python/src/engine.py",
      outdir: "src/generated",
    },
  ],
  bundler: "vite",
  react: true,
};
