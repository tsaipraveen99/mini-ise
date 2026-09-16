import { useEffect } from 'react'
import { EnginePage } from './EnginePage'
import { Landing } from './Landing'
import { routeOf, useHash } from './router'
import { Slides } from './Slides'

const TITLES = {
  landing: 'Mini ISE: network access control, built small',
  engine: 'Policy engine · Mini ISE',
}

export default function App() {
  const hash = useHash()
  const route = routeOf(hash)

  useEffect(() => {
    if (route !== 'slides') document.title = TITLES[route]
  }, [route])

  if (route === 'slides') return <Slides hash={hash} />
  if (route === 'engine') return <EnginePage />
  return <Landing />
}
