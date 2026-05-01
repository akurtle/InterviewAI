import BrandLogo from "../Brand/BrandLogo";

function Footer() {
  return (
    <footer className="theme-footer border-t px-6 py-8">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo />
        <p className="theme-text-dim text-sm">
          &copy; 2026 TalkItOut AI &middot; Privacy &middot; Terms
        </p>
      </div>
    </footer>
  );
}

export default Footer;
