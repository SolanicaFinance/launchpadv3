import "./polyfills";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/gate-theme.css";

async function bootstrap() {
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
