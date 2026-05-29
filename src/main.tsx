import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply saved theme before render to avoid flash
const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('app-theme')) || 'dark';
document.documentElement.classList.remove('dark', 'light');
document.documentElement.classList.add(saved);

createRoot(document.getElementById("root")!).render(<App />);
