import Navbar from "../components/Layout/Navbar";
import Footer from "../components/Layout/Footer";
import Features from "../components/Marketing/Features";
import Hero from "../components/Marketing/Hero";

function Home() {
  return (
    <div id="scroll-root" className="site-scroll-root">
      <Navbar />
      <Hero />
      <Features />
      <Footer />
    </div>
  );
}

export default Home;
