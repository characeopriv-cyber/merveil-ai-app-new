import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PlusHub from "./plusHub.jsx";
import DeveloperPlatform from "./DeveloperPlatformFixed.jsx";
import "./index.css";

const isDeveloper = window.location.pathname === "/developer" || window.location.pathname.startsWith("/developer/");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isDeveloper ? <DeveloperPlatform /> : <><App /><PlusHub /></>}
  </React.StrictMode>
);
