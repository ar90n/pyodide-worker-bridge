export default {
  pyodideVersion: "0.27.5",
  modules: [
    {
      input: "python/src/science.py",
      outdir: "src/generated",
    },
  ],
  bundler: "vite",
  react: true,
};
