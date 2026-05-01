import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import BrandLogo from "../Brand/BrandLogo";

type MenuItem = {
  label: string;
  to?: string;
  href?: string;
  action?: () => void | Promise<void>;
  tone?: "default" | "danger";
};

function navLinkClass(isActive = false) {
  return [
    "rounded-full px-3 py-2 text-sm transition",
    isActive ? "theme-text-primary" : "theme-ghost-link",
  ].join(" ");
}

function menuItemClass(tone: MenuItem["tone"] = "default") {
  return [
    "block w-full rounded-xl px-4 py-3 text-left text-sm transition",
    tone === "danger"
      ? "text-red-300 hover:bg-[oklch(0.72_0.18_15_/_0.1)]"
      : "theme-text-secondary hover:bg-[oklch(1_0_0_/_0.05)] hover:text-[var(--txt)]",
  ].join(" ");
}

function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(location.pathname !== "/");

  const isHome = location.pathname === "/";
  const userLabel = user?.email ? user.email.split("@")[0] : "Menu";

  useEffect(() => {
    const root = document.getElementById("scroll-root");
    const scrollTarget: HTMLElement | Window = isHome && root ? root : window;

    const getScrollTop = () =>
      scrollTarget instanceof Window ? window.scrollY : scrollTarget.scrollTop;

    const handleScroll = () => {
      setScrolled(!isHome || getScrollTop() > 30);
    };

    handleScroll();
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
    };
  }, [isHome, location.pathname]);

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
        { label: "Log in", to: "/auth" },
        { label: "Settings", to: "/settings" },
      ];

  return (
    <nav
      className={`theme-nav fixed top-0 z-[100] h-16 w-full border-b ${
        scrolled ? "theme-nav-scrolled" : ""
      }`}
    >
      <div className="flex h-full items-center justify-between gap-4 px-5 sm:px-8">
        <BrandLogo />

        <div className="hidden items-center gap-2 md:flex">
          <a href="/#features" className={navLinkClass()}>
            Features
          </a>
          <NavLink to="/interview-type" className={({ isActive }) => navLinkClass(isActive)}>
            Modes
          </NavLink>
          <a href="/#pricing" className={navLinkClass()}>
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!user && (
            <Link to="/auth" className="cta-outline hidden rounded-xl px-5 py-2 text-sm sm:inline-flex">
              Log in
            </Link>
          )}
          <Link
            to="/interview-type"
            className="cta-primary rounded-xl px-4 py-2 text-sm font-bold sm:px-5"
          >
            Try free -&gt;
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Open navigation menu"
              className="cta-outline inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm"
            >
              {user && (
                <span className="theme-logo flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                  {userLabel.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline">{user ? userLabel : "Menu"}</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>

            {menuOpen && (
              <div className="theme-panel absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-2xl p-3">
                <div className="border-b border-[var(--border)] px-3 pb-3">
                  <p className="theme-text-primary text-sm font-semibold">
                    {user ? "Account" : "Navigation"}
                  </p>
                  <p className="theme-text-dim mt-1 text-xs">
                    {user?.email ?? "Choose a destination."}
                  </p>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="md:hidden">
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
                      Modes
                    </NavLink>
                    <a
                      href="/#pricing"
                      className={menuItemClass()}
                      onClick={() => setMenuOpen(false)}
                    >
                      Pricing
                    </a>
                    <div className="mx-2 my-2 border-t border-[var(--border)]" />
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
    </nav>
  );
}

export default Navbar;
