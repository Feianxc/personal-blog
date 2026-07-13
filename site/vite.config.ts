import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        workflow: resolve(__dirname, 'workflow.html'),
        workflowHarnessOhbp: resolve(__dirname, 'workflow-harness-ohbp.html'),
        workflowContextRouter: resolve(__dirname, 'workflow-context-router.html'),
        workflowStockResearchDesk: resolve(__dirname, 'workflow-stock-research-desk.html'),
        field: resolve(__dirname, 'field.html'),
        homepageLab: resolve(__dirname, 'homepage-lab.html'),
        lab: resolve(__dirname, 'lab.html'),
        labBusbarPlatform: resolve(__dirname, 'lab-busbar-platform.html'),
        labProtocolStudio: resolve(__dirname, 'lab-protocol-studio.html'),
        labCadAutomation: resolve(__dirname, 'lab-cad-automation.html'),
        labOpenclawDelivery: resolve(__dirname, 'lab-openclaw-delivery.html'),
        labHtmlCanvasSignal: resolve(__dirname, 'lab-html-canvas-signal.html'),
        labOpenaiNodeProbe: resolve(__dirname, 'lab-openai-node-probe.html'),
        archive: resolve(__dirname, 'archive.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  },
})
