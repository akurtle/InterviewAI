import Footer from "../components/Layout/Footer";
import Navbar from "../components/Layout/Navbar";
import ThemePicker from "../components/Settings/ThemePicker";

export default function Settings() {
  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden px-6 pb-20 pt-32">
        <div className="theme-grid-overlay absolute inset-0 opacity-70" />
        <div className="absolute inset-0 opacity-35">
          <div className="theme-glow-primary absolute left-[10%] top-[16%] h-72 w-72 rounded-full blur-3xl" />
          <div className="theme-glow-secondary absolute bottom-[12%] right-[14%] h-72 w-72 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="mb-12 max-w-3xl">
            <p className="theme-accent-text text-sm uppercase tracking-[0.25em]">Settings</p>
            <h1 className="theme-text-primary mt-4 text-5xl font-bold md:text-6xl">
              Make the interface feel like yours
            </h1>
            <p className="theme-text-muted mt-4 max-w-2xl text-lg">
              Theme changes are saved locally and applied across the landing pages, resume flow, and interview studio.
            </p>
          </div>

          <div className="theme-panel rounded-[28px] p-8 backdrop-blur">
            <ThemePicker />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
