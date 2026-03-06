// Buffer polyfill MUST be first - before any imports that might use Buffer
import { Buffer } from "buffer";
(window as any).Buffer = (window as any).Buffer || Buffer;
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/gate-theme.css";

createRoot(document.getElementById("root")!).render(<App />);
