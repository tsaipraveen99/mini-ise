import { useEffect, useState } from 'react'
import { Landing } from './Landing'
import { Slides } from './Slides'

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const onSlides = hash.startsWith('#/slides')

  useEffect(() => {
    if (!onSlides) document.title = 'Mini ISE: zero-trust network access, built small'
  }, [onSlides])

  return onSlides ? <Slides hash={hash} /> : <Landing />
}
