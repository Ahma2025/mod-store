import { useEffect, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Stats from './components/Stats'
import Menu from './components/Menu'
import Experience from './components/Experience'
import Gallery from './components/Gallery'
import Reservation from './components/Reservation'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  const cursorRef = useRef(null)
  const followerRef = useRef(null)

  useEffect(() => {
    const cursor = cursorRef.current
    const follower = followerRef.current
    let mouseX = 0, mouseY = 0
    let followerX = 0, followerY = 0

    const onMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      cursor.style.left = mouseX + 'px'
      cursor.style.top = mouseY + 'px'
    }

    const animate = () => {
      followerX += (mouseX - followerX) * 0.12
      followerY += (mouseY - followerY) * 0.12
      follower.style.left = followerX + 'px'
      follower.style.top = followerY + 'px'
      requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMouseMove)
    animate()

    // Scale cursor on hover
    const links = document.querySelectorAll('a, button, .hoverable')
    links.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(2.5)'
        follower.style.transform = 'translate(-50%, -50%) scale(1.5)'
      })
      el.addEventListener('mouseleave', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)'
        follower.style.transform = 'translate(-50%, -50%) scale(1)'
      })
    })

    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  return (
    <>
      <div className="cursor" ref={cursorRef} />
      <div className="cursor-follower" ref={followerRef} />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#FAFAF8',
            border: '1px solid #C9A84C',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
      <Navbar />
      <main>
        <Hero />
        <About />
        <Stats />
        <Menu />
        <Experience />
        <Gallery />
        <Reservation />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
