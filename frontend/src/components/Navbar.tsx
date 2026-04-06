import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

type MenuItem = {
  label: string;
  to?: string;
  href?: string;
  action?: () => void | Promise<void>;
  tone?: "default" | "danger";
};

function navLinkClass(isActive: boolean) {
  return [
    "rounded-full px-4 py-2 text-sm font-medium transition",
    isActive
      ? "theme-button-secondary theme-text-primary"
      : "theme-ghost-link",
  ].join(" ");
}

function menuItemClass(tone: MenuItem["tone"] = "default") {
  return [
    "block w-full rounded-2xl px-4 py-3 text-left text-sm transition",
    tone === "danger"
      ? "text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
      : "theme-text-secondary hover:bg-white/5 hover:text-white",
  ].join(" ");
}

function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isHome = location.pathname === "/";
  const userLabel = useMemo(() => {
    if (!user?.email) {
      return "Menu";
    }

    return user.email.split("@")[0];
  }, [user?.email]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  const menuItems: MenuItem[] = user
    ? [
        { label: "My Sessions", to: "/user" },
        { label: "Settings", to: "/settings" },
        { label: "Sign Out", action: () => signOut(), tone: "danger" },
      ]
    : [
        { label: "Log In", to: "/auth" },
        { label: "Settings", to: "/settings" },
      ];

  return (
    <nav className="theme-nav fixed top-0 z-50 w-full border-b backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="theme-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg">
              <span className="text-lg font-bold text-white">AI</span>
            </div>
            <div className="min-w-0">
              <p className="theme-text-primary truncate text-base font-semibold sm:text-lg">
                InterviewAI
              </p>
              <p className="theme-text-muted hidden text-xs sm:block">
                Practice, review, and track interviews
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {!isHome && (
              <NavLink to="/" className={({ isActive }) => navLinkClass(isActive)}>
                Home
              </NavLink>
            )}
            <a href="/#features" className={navLinkClass(isHome && location.hash === "#features")}>
              Features
            </a>
            <NavLink
              to="/interview-type"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              Practice
            </NavLink>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/get-started"
              className="theme-button-primary rounded-full px-4 py-2 text-sm font-semibold sm:px-5"
            >
              Get Started
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label="Open navigation menu"
                className="theme-button-secondary inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium sm:px-4"
              >
                {user && (
                  <span className="theme-logo flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white">
                    {userLabel.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline">{user ? userLabel : "Menu"}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"}
                  />
                </svg>
              </button>

              {menuOpen && (
                <div className="theme-panel absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-3xl p-3">
                  <div className="border-b border-white/10 px-3 pb-3">
                    <p className="theme-text-primary text-sm font-semibold">
                      {user ? "Account" : "Navigation"}
                    </p>
                    <p className="theme-text-muted mt-1 text-xs">
                      {user?.email ?? "Pick where you want to go next."}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="lg:hidden">
                      {!isHome && (
                        <NavLink to="/" className={() => menuItemClass()} onClick={() => setMenuOpen(false)}>
                          Home
                        </NavLink>
                      )}
                      <a
                        href="/#features"
                        className={menuItemClass()}
                        onClick={() => setMenuOpen(false)}
                      >
                        Features
                      </a>
                      <NavLink
                        to="/interview-type"
                        className={() => menuItemClass()}
                        onClick={() => setMenuOpen(false)}
                      >
                        Practice
                      </NavLink>
                      <div className="mx-2 my-2 border-t border-white/10" />
                    </div>

                    {menuItems.map((item) => {
                      if (item.to) {
                        return (
                          <NavLink
                            key={item.label}
                            to={item.to}
                            className={() => menuItemClass(item.tone)}
                            onClick={() => setMenuOpen(false)}
                          >
                            {item.label}
                          </NavLink>
                        );
                      }

                      if (item.href) {
                        return (
                          <a
                            key={item.label}
                            href={item.href}
                            className={menuItemClass(item.tone)}
                            onClick={() => setMenuOpen(false)}
                          >
                            {item.label}
                          </a>
                        );
                      }

                      return (
                        <button
                          key={item.label}
                          type="button"
                          className={menuItemClass(item.tone)}
                          onClick={() => {
                            setMenuOpen(false);
                            void item.action?.();
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
