/**
 * Configuration file loader and validator.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

export interface BridgeConfig {
  pyodideVersion: string;
  modules: ModuleConfig[];
  react?: boolean;
  bundler?: "vite" | "webpack" | "inline";
}

export interface ModuleConfig {
  input: string;
  outdir: string;
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

const DEFAULT_CONFIG: Partial<BridgeConfig> = {
  react: true,
  bundler: "vite",
};

/**
 * Attempt to load a pyodide-bridge config file.
 *
 * @param configPath - Path to the config file (default: ./pyodide-bridge.config.ts)
 * @returns The loaded and validated config, or null if no config file found
 */
export async function loadConfig(configPath?: string): Promise<BridgeConfig | null> {
  const resolvedPath = configPath || findConfigFile();
  if (!resolvedPath) {
    return null;
  }

  const absolutePath = path.resolve(resolvedPath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const fileUrl = pathToFileURL(absolutePath).href;
    const module = await import(fileUrl);
    const config = module.default as BridgeConfig;
    return validateConfig(config);
  } catch (err) {
    throw new ConfigValidationError(
      `Failed to load config file ${resolvedPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Look for a config file in the current directory.
 */
function findConfigFile(): string | null {
  const candidates = [
    "pyodide-bridge.config.ts",
    "pyodide-bridge.config.js",
    "pyodide-bridge.config.mjs",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Validate and apply defaults to a config object.
 */
function validateConfig(config: unknown): BridgeConfig {
  if (typeof config !== "object" || config === null) {
    throw new ConfigValidationError("Config must be an object");
  }

  const cfg = config as Record<string, unknown>;

  if (typeof cfg.pyodideVersion !== "string") {
    throw new ConfigValidationError("Config.pyodideVersion must be a string");
  }

  if (!Array.isArray(cfg.modules) || cfg.modules.length === 0) {
    throw new ConfigValidationError("Config.modules must be a non-empty array");
  }

  for (let i = 0; i < cfg.modules.length; i++) {
    const mod = cfg.modules[i] as Record<string, unknown>;
    if (typeof mod.input !== "string") {
      throw new ConfigValidationError(`Config.modules[${i}].input must be a string`);
    }
    if (typeof mod.outdir !== "string") {
      throw new ConfigValidationError(`Config.modules[${i}].outdir must be a string`);
    }
  }

  if (cfg.bundler !== undefined && !["vite", "webpack", "inline"].includes(cfg.bundler as string)) {
    throw new ConfigValidationError('Config.bundler must be "vite", "webpack", or "inline"');
  }

  return {
    ...DEFAULT_CONFIG,
    ...cfg,
  } as BridgeConfig;
}

/**
 * Build a BridgeConfig from CLI arguments, merging with config file if available.
 */
export function mergeCliArgs(
  fileConfig: BridgeConfig | null,
  cliArgs: {
    input?: string;
    outdir?: string;
    pyodideVersion?: string;
    bundler?: string;
    react?: boolean;
  },
): BridgeConfig {
  if (fileConfig) {
    // CLI args override config file
    return {
      pyodideVersion: cliArgs.pyodideVersion || fileConfig.pyodideVersion,
      modules: fileConfig.modules,
      react: cliArgs.react !== undefined ? cliArgs.react : fileConfig.react,
      bundler:
        (cliArgs.bundler as BridgeConfig["bundler"]) || fileConfig.bundler || DEFAULT_CONFIG.bundler,
    };
  }

  // No config file: require --input and --outdir
  if (!cliArgs.input || !cliArgs.outdir) {
    throw new ConfigValidationError(
      "Either provide a config file or use --input and --outdir CLI arguments",
    );
  }

  if (!cliArgs.pyodideVersion) {
    throw new ConfigValidationError("--pyodide-version is required when not using a config file");
  }

  return {
    pyodideVersion: cliArgs.pyodideVersion,
    modules: [{ input: cliArgs.input, outdir: cliArgs.outdir }],
    react: cliArgs.react !== undefined ? cliArgs.react : DEFAULT_CONFIG.react,
    bundler:
      (cliArgs.bundler as BridgeConfig["bundler"]) || (DEFAULT_CONFIG.bundler as "vite"),
  };
}
