import assert from "node:assert/strict";
import { execSync } from "node:child_process";

if (process.platform === "win32") {
  // Let's clear process.env variables we want to test first
  const testVars = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "XAI_API_KEY", "XAI_MODEL", "OneDrive", "TEMP"];
  const originalVals = {};
  for (const v of testVars) {
    originalVals[v] = process.env[v];
    delete process.env[v];
  }
  
  // Now define the loadWin32Env logic
  function testLoad() {
    const output = execSync("reg query HKCU\\Environment", { stdio: ["ignore", "pipe", "ignore"] }).toString();
    const lines = output.split(/\r?\n/);
    const registryVars = new Map();
    
    for (const line of lines) {
      const match = line.match(/^\s+(\S+)\s+(REG_SZ|REG_EXPAND_SZ)\s+(.+)$/);
      if (match) {
        const name = match[1];
        const type = match[2];
        const value = match[3].trim();
        registryVars.set(name, { type, value });
      }
    }
    
    for (const [name, info] of registryVars.entries()) {
      if (!process.env[name]) {
        let finalValue = info.value;
        if (info.type === "REG_EXPAND_SZ") {
          finalValue = finalValue.replace(/%([^%]+)%/g, (m, key) => {
            if (process.env[key] !== undefined) {
              return process.env[key];
            }
            if (registryVars.has(key)) {
              return registryVars.get(key).value;
            }
            return m;
          });
        }
        process.env[name] = finalValue;
      }
    }
    return registryVars;
  }
  
  const regVars = testLoad();
  
  // Verify that registry variables are now in process.env
  for (const [name, info] of regVars.entries()) {
    assert.ok(process.env[name], `Expected ${name} to be loaded into process.env`);
    // Verify that REG_EXPAND_SZ is expanded
    if (info.type === "REG_EXPAND_SZ" && info.value.includes("%")) {
      assert.ok(!process.env[name].includes("%"), `Expected ${name} to be fully expanded, but got: ${process.env[name]}`);
    }
  }
  
  // Restore process.env
  for (const v of testVars) {
    if (originalVals[v] !== undefined) {
      process.env[v] = originalVals[v];
    } else {
      delete process.env[v];
    }
  }
  
  console.log("HKCU Environment loading tests passed successfully!");
} else {
  console.log("Skipping win32 registry env test on non-win32 platform.");
}
