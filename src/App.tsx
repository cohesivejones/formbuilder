import { Redirect, Route, Switch } from "wouter"
import { DemoNav } from "./demo/DemoNav"
import { FullBuilderPage } from "./demo/FullBuilderPage"
import { LockedDownFormPage } from "./demo/LockedDownFormPage"
import { RendererPage } from "./demo/RendererPage"
import { ConditionsPage } from "./demo/ConditionsPage"
import styles from "./App.module.css"

function App() {
  return (
    <div className={styles.shell}>
      <DemoNav />
      <div className={styles.page}>
        <Switch>
          <Route path="/" component={FullBuilderPage} />
          <Route path="/locked-down" component={LockedDownFormPage} />
          <Route path="/renderer" component={RendererPage} />
          <Route path="/conditions" component={ConditionsPage} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </div>
    </div>
  )
}

export default App
