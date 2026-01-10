const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);

const resolveRequestWithPackageExports = (context, moduleName, platform) => {
  if (moduleName === "expo-application" && platform === "web") {
    return {
      filePath: path.resolve(__dirname, "src/expo-application.web.ts"),
      type: "sourceFile",
    };
  }

  if (platform === "web" && (moduleName === "x402" || moduleName.startsWith("x402/"))) {
    return {
      filePath: path.resolve(__dirname, "src/x402-client.web.ts"),
      type: "sourceFile",
    };
  }

  if (moduleName === "ox") {
    const oxEntry = path.resolve(__dirname, "node_modules/ox/_esm/index.js");
    if (fs.existsSync(oxEntry)) {
      return { filePath: oxEntry, type: "sourceFile" };
    }
  }

  if (moduleName.startsWith("ox/")) {
    const subpath = moduleName.slice(3).replace(/\.js$/u, "");
    const oxFile = path.resolve(__dirname, "node_modules/ox/_esm", `${subpath}.js`);
    if (fs.existsSync(oxFile)) {
      return { filePath: oxFile, type: "sourceFile" };
    }
  }

  if (moduleName === "jose") {
    const ctx = {
      ...context,
      unstable_conditionNames: ["browser"],
    };
    return ctx.resolveRequest(ctx, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.resolveRequest = resolveRequestWithPackageExports;

module.exports = config;
