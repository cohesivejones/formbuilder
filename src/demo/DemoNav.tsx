import { Link, useRoute } from "wouter"
import { DEMO_ROUTES, type DemoRoute } from "./routes"
import styles from "./DemoNav.module.css"

export function DemoNav() {
  return (
    <nav className={styles.nav} aria-label="Demos">
      <span className={styles.brand}>Form Builder</span>
      <ul className={styles.list}>
        {DEMO_ROUTES.map((route) => (
          <NavItem key={route.path} route={route} />
        ))}
      </ul>
    </nav>
  )
}

function NavItem({ route }: { route: DemoRoute }) {
  const [active] = useRoute(route.path)
  return (
    <li>
      <Link
        href={route.path}
        className={active ? `${styles.link} ${styles.linkActive}` : styles.link}
        aria-current={active ? "page" : undefined}
      >
        {route.label}
        <span className={styles.summary}>{route.summary}</span>
      </Link>
    </li>
  )
}
