import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isE2E, resetSeed } from "./e2e-mode";
import "./index.css";
if (isE2E()) resetSeed(); // deterministic surface under test
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
