export const BROWSER_AGENT_READ_ONLY_CAPTURE_SCRIPT = String.raw`(() => {
  const textOf = (node) => (node && node.innerText ? String(node.innerText).replace(/\s+/g, ' ').trim() : '');
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const bounds = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const readableBlocks = () => Array.from(document.querySelectorAll('article,[role="article"],.markdown-body,.markdown,.js-comment-body,.comment-body,.timeline-comment,.issue-body,.description,.content,p,li,blockquote,pre'))
    .filter(visible)
    .map((element, index) => {
      const text = textOf(element);
      return {
        blockId: "readable-" + index,
        role: element.tagName === 'ARTICLE' ? 'article' : element.tagName === 'PRE' ? 'code' : /issue|comment|discussion|timeline-comment/i.test(String(element.className || '')) || element.closest('.js-comment-body,.timeline-comment,[data-testid*="issue"]') ? 'issue_body' : /markdown|doc|documentation/i.test(String(element.className || '')) ? 'docs_section' : 'paragraph',
        text: text.slice(0, 1200),
        score: Math.min(text.length, 1200),
        truncated: text.length > 1200,
      };
    })
    .filter((block) => block.text.length >= 40)
    .slice(0, 8);
  const inferPageType = () => {
    const path = location.pathname.toLowerCase();
    const bodyText = textOf(document.body).toLowerCase();
    if (/\/issues\/\d+/.test(path) || document.querySelector('.js-issue-title,.gh-header-title')) return 'issue';
    if (document.querySelector('article,[role="article"]')) return 'article';
    if (document.querySelector('form input,form textarea,form select')) return 'form';
    if (document.querySelector('[class*="dashboard"],[class*="chart"],[class*="metric"],canvas,svg')) return 'dashboard';
    if (/docs|documentation|guide|reference|api/.test(path) || document.querySelector('.markdown,.markdown-body,[class*="docs"]')) return 'docs';
    if (bodyText.length < 220 && document.querySelector('#root,#app')) return 'spa';
    return 'unknown';
  };
  const visualEvidence = () => Array.from(document.querySelectorAll('figure,img,picture,video,a[href$=".png"],a[href$=".jpg"],a[href$=".jpeg"],a[href$=".gif"],a[href$=".webp"],a[href$=".pdf"],a[href*="user-attachments"],a[href*="assets"],a[href*="uploads"]'))
    .filter(visible)
    .slice(0, 16)
    .map((element, index) => {
      const img = element.tagName === 'IMG' ? element : element.querySelector('img');
      const src = img ? img.currentSrc || img.src || '' : element.href || '';
      let srcOrigin = null;
      try { srcOrigin = src ? new URL(src, location.href).origin : null; } catch (_) { srcOrigin = null; }
      return {
        evidenceId: "visual-" + index,
        kind: element.tagName === 'VIDEO' ? 'video' : element.tagName === 'A' ? 'attachment' : element.tagName === 'FIGURE' ? 'figure' : 'image',
        label: (textOf(element) || (img && img.alt) || element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('download') || 'visual evidence').slice(0, 180),
        altText: img && img.alt ? String(img.alt).slice(0, 240) : null,
        srcOrigin,
        nearbyText: textOf(element.closest('.markdown-body,.js-comment-body,.comment-body,article,main,section,li,div') || element).slice(0, 520),
        visible: true,
        sensitive: /token|secret|password|authorization|cookie/i.test(src),
      };
    });
  const safeInput = (input, index) => {
    const type = String(input.getAttribute('type') || 'text').toLowerCase();
    const sensitive = type === 'password' || type === 'hidden' || /token|secret|authorization|password/i.test(input.name || input.id || input.placeholder || '');
    return {
      targetId: "input-" + index,
      kind: type === 'checkbox' || type === 'radio' ? type : 'input',
      label: input.labels && input.labels[0] ? textOf(input.labels[0]) : (input.getAttribute('aria-label') || input.name || input.id || ''),
      accessibleName: input.getAttribute('aria-label'),
      text: null,
      href: null,
      placeholder: input.placeholder || null,
      valuePreview: sensitive ? null : String(input.value || '').slice(0, 120),
      disabled: Boolean(input.disabled),
      visible: visible(input),
      sensitive,
      bounds: bounds(input),
    };
  };
  const blocks = readableBlocks();
  const primaryText = blocks.length > 0 ? blocks.map((block) => block.text).join(' ') : textOf(document.body);
  return {
    title: document.title || null,
    url: location.href,
    selectedText: String(window.getSelection ? window.getSelection() : '').slice(0, 1000),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    visibleText: primaryText.slice(0, 12000),
    pageType: inferPageType(),
    primaryContent: {
      text: primaryText.slice(0, 12000),
      source: blocks.length > 0 ? 'readable_block' : 'body_fallback',
      score: blocks.reduce((total, block) => total + block.score, 0),
      truncated: primaryText.length > 12000,
    },
    readableBlocks: blocks,
    noiseDiagnostics: [],
    visualEvidence: visualEvidence(),
    headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).slice(0, 80).map((element, index) => ({
      targetId: "heading-" + index,
      role: 'heading',
      level: Number(element.tagName.slice(1)),
      text: textOf(element),
      truncated: false,
    })),
    links: Array.from(document.querySelectorAll('a[href]')).filter(visible).slice(0, 80).map((element, index) => ({
      targetId: "link-" + index,
      kind: 'link',
      label: textOf(element) || element.getAttribute('aria-label') || element.href,
      accessibleName: element.getAttribute('aria-label'),
      text: textOf(element),
      href: element.href,
      placeholder: null,
      valuePreview: null,
      disabled: false,
      visible: true,
      sensitive: false,
      bounds: bounds(element),
    })),
    buttons: Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')).filter(visible).slice(0, 80).map((element, index) => ({
      targetId: "button-" + index,
      kind: 'button',
      label: textOf(element) || element.getAttribute('aria-label') || element.value || '',
      accessibleName: element.getAttribute('aria-label'),
      text: textOf(element),
      href: null,
      placeholder: null,
      valuePreview: null,
      disabled: Boolean(element.disabled),
      visible: true,
      sensitive: false,
      bounds: bounds(element),
    })),
    forms: Array.from(document.querySelectorAll('form')).filter(visible).slice(0, 20).map((form, index) => ({
      formId: "form-" + index,
      label: form.getAttribute('aria-label') || textOf(form).slice(0, 160),
      method: form.method || null,
      actionOrigin: form.action ? new URL(form.action, location.href).origin : null,
      fields: Array.from(form.querySelectorAll('input,textarea,select')).slice(0, 40).map(safeInput),
      submitTargets: Array.from(form.querySelectorAll('button[type="submit"],input[type="submit"]')).slice(0, 10).map((element, submitIndex) => ({
        targetId: "form-" + index + "-submit-" + submitIndex,
        kind: 'submit',
        label: textOf(element) || element.value || 'Submit',
        accessibleName: element.getAttribute('aria-label'),
        text: textOf(element),
        href: null,
        placeholder: null,
        valuePreview: null,
        disabled: Boolean(element.disabled),
        visible: visible(element),
        sensitive: false,
        bounds: bounds(element),
      })),
      sensitive: false,
    })),
  };
})()`;
