import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import { App } from './saju-app'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

