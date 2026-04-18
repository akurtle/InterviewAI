import Navbar from '../components/Layout/Navbar';
import Hero from '../components/Marketing/Hero';
import Features from '../components/Marketing/Features';
import Footer from '../components/Layout/Footer';

function Home() {
  return (<div className="theme-page-shell">
      <Navbar />
      <Hero />
      <Features />
      <Footer />
    </div>
  )
}

export default Home
