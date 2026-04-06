import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Footer from '../components/Footer';

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
