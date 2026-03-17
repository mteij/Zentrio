import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdaptiveScreen } from './AdaptiveScreen'

describe('AdaptiveScreen', () => {
  it('renders the standard view when isTv is false', () => {
    const html = renderToStaticMarkup(
      <AdaptiveScreen
        isTv={false}
        model={{ label: 'standard' }}
        StandardView={({ model }) => <div>{model.label}</div>}
        TvView={({ model }) => <section>{model.label}</section>}
      />,
    )

    expect(html).toContain('<div>standard</div>')
  })

  it('renders the tv view when isTv is true', () => {
    const html = renderToStaticMarkup(
      <AdaptiveScreen
        isTv
        model={{ label: 'tv' }}
        StandardView={({ model }) => <div>{model.label}</div>}
        TvView={({ model }) => <section>{model.label}</section>}
      />,
    )

    expect(html).toContain('<section>tv</section>')
  })
})
