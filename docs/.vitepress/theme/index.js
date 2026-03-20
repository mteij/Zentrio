import DefaultTheme from 'vitepress/theme'
import './custom.css'
import RepoCodeBlock from './components/RepoCodeBlock.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    DefaultTheme.enhanceApp?.({ app })
    app.component('RepoCodeBlock', RepoCodeBlock)
  }
}
