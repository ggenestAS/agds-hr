import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import appCss from "../styles/app.css?url";

// FOUC-prevention: set the theme class before paint from localStorage/matchMedia
// (the hand-rolled useTheme reads the same key). Runs inline in <head>.
const themeScript = `(function(){try{var t=localStorage.getItem("agds-hr-theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Albert People" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      {/* Body never scrolls — panes scroll, the page does not (§9.1). */}
      <body className="h-dvh overflow-hidden">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
