const SVG_NS = 'http://www.w3.org/2000/svg'

const DEFAULT_WIDTH = 540
const DEFAULT_HEIGHT = 540
const DEFAULT_PIXEL_RATIO = 2

const WRITING_MODES = ['horizontal-tb', 'vertical-rl', 'vertical-lr']

const isVertical = writingMode => writingMode.startsWith('vertical')

export const resolveQuoteImageOptions = (options = {}) => {
    const writingMode = WRITING_MODES.includes(options.writingMode)
        ? options.writingMode
        : options.vertical
            ? 'vertical-rl'
            : 'horizontal-tb'

    return {
        width: options.width ?? DEFAULT_WIDTH,
        height: options.height ?? DEFAULT_HEIGHT,
        pixelRatio: options.pixelRatio ?? DEFAULT_PIXEL_RATIO,
        backgroundColor: options.backgroundColor ?? '#ffffff',
        color: options.color ?? options.textColor ?? '#000000',
        fontFamily: options.fontFamily ?? 'serif',
        fontSize: options.fontSize ?? 20,
        lineHeight: options.lineHeight ?? 1.35,
        padding: options.padding ?? 48,
        borderColor: options.borderColor ?? options.color ?? options.textColor ?? '#111827',
        borderWidth: options.borderWidth ?? 4,
        borderStyle: options.borderStyle ?? 'double',
        titleColor: options.titleColor ?? options.color ?? '#000000',
        authorColor: options.authorColor ?? options.titleColor ?? options.color ?? '#4b5563',
        titleFontSize: options.titleFontSize ?? options.fontSize ?? 20,
        authorFontSize: options.authorFontSize ?? (options.fontSize ?? 20) * 0.8,
        textAlign: options.textAlign ?? 'center',
        writingMode,
        // In vertical modes the column progression (right-to-left for
        // vertical-rl) comes from `writing-mode` itself; `direction: rtl`
        // would make each column run bottom-to-top, so it defaults to ltr.
        direction: options.direction ?? 'ltr',
    }
}

const px = n => typeof n === 'number' ? `${n}px` : n

// Largest integer font size in [min, max] at which `el` doesn't overflow.
const fit = (el, min, max) => {
    const overflows = () => el.scrollHeight > el.clientHeight
        || el.scrollWidth > el.clientWidth
    let lo = min, hi = max
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        el.style.fontSize = `${mid}px`
        if (overflows()) hi = mid - 1
        else lo = mid
    }
    el.style.fontSize = `${lo}px`
    return lo
}

// All styles on <main> and below are inline: <main> is cloned into an SVG
// <foreignObject>, where the shadow root's stylesheet doesn't apply.
const html = `<style>
:host {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
}
</style>
<main>
    <div id="mark" aria-hidden="true">“</div>
    <div id="text"><div id="content"></div></div>
    <div id="meta">
        <div id="author"></div>
        <div id="progress"></div>
        <cite id="title"></cite>
    </div>
</main>`

const oneLine = {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontStyle: 'normal',
}

customElements.define('foliate-quoteimage', class extends HTMLElement {
    #root = this.attachShadow({ mode: 'closed' })
    constructor() {
        super()
        this.#root.innerHTML = html
    }
    #$(selector) {
        return this.#root.querySelector(selector)
    }
    async getBlob({ title, author, text, progress, options = {} }) {
        const opts = resolveQuoteImageOptions(options)
        const { width, height, pixelRatio, writingMode } = opts
        const vertical = isVertical(writingMode)
        // `direction` only matters for horizontal text (Arabic, Hebrew, …)
        const direction = vertical ? 'ltr' : opts.direction

        const mainEl = this.#$('main')
        mainEl.dir = direction
        Object.assign(mainEl.style, {
            boxSizing: 'border-box',
            width: `${width}px`,
            height: `${height}px`,
            margin: '0',
            padding: px(opts.padding),
            display: 'flex',
            // `column` follows the block axis, so in vertical modes the
            // mark, text and meta are laid out as successive columns
            flexDirection: 'column',
            overflow: 'hidden',
            writingMode,
            direction,
            color: opts.color,
            backgroundColor: opts.backgroundColor,
            fontFamily: opts.fontFamily,
            fontSize: px(opts.fontSize),
            lineHeight: String(opts.lineHeight),
            textAlign: opts.textAlign,
            borderColor: opts.borderColor,
            borderStyle: opts.borderStyle,
            borderWidth: px(opts.borderWidth),
        })

        Object.assign(this.#$('#mark').style, {
            flex: 'none',
            fontSize: '3em',
            lineHeight: '1',
            marginBlockEnd: '-0.35em',
            textAlign: 'start',
            opacity: '0.6',
        })

        const textEl = this.#$('#text')
        Object.assign(textEl.style, {
            flex: '1 1 auto',
            minWidth: '0',
            minHeight: '0',
            display: 'flex',
            flexDirection: 'column',
            // `safe` keeps overflow at the end edge so it is measurable
            justifyContent: 'safe center',
            overflow: 'hidden',
            marginBlock: '0.5em',
        })
        const contentEl = this.#$('#content')
        Object.assign(contentEl.style, {
            textWrap: 'pretty',
            overflowWrap: 'anywhere',
            textOrientation: 'mixed',
        })
        contentEl.innerText = text ?? ''

        Object.assign(this.#$('#meta').style, {
            flex: 'none',
            minWidth: '0',
            minHeight: '0',
        })
        const setLine = (selector, value, color, fontSize) => {
            const el = this.#$(selector)
            el.textContent = value ?? ''
            Object.assign(el.style, oneLine, {
                display: value ? 'block' : 'none',
                color,
                fontSize: px(fontSize),
            })
        }
        setLine('#author', author ? `© ${author}` : '', opts.authorColor, opts.authorFontSize)
        setLine('#progress', progress ? `§ ${progress}` : '', opts.authorColor, opts.authorFontSize)
        setLine('#title', title, opts.titleColor, opts.titleFontSize)

        // Text is laid out as large as fits in the remaining space
        const maxFontSize = Math.max(opts.fontSize, Math.round(Math.min(width, height) / 10))
        fit(textEl, 8, maxFontSize)

        const doc = document.implementation.createDocument(SVG_NS, 'svg')
        const svg = doc.documentElement
        // Give the SVG its output size so it is rasterized sharply
        svg.setAttribute('width', width * pixelRatio)
        svg.setAttribute('height', height * pixelRatio)
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
        const obj = doc.createElementNS(SVG_NS, 'foreignObject')
        obj.setAttribute('width', width)
        obj.setAttribute('height', height)
        obj.append(doc.importNode(mainEl, true))
        svg.append(obj)

        const img = new Image()
        await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = () => reject(new Error('Failed to render quote image'))
            // Encode: text may contain `#`, which would end a data URL
            img.src = 'data:image/svg+xml;charset=utf-8,'
                + encodeURIComponent(new XMLSerializer().serializeToString(doc))
        })

        const canvas = document.createElement('canvas')
        canvas.width = width * pixelRatio
        canvas.height = height * pixelRatio
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob
            ? resolve(blob)
            : reject(new Error('Failed to encode quote image')), 'image/png'))
    }
})
