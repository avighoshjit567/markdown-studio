import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import prettier from 'prettier/standalone'
import markdownParser from 'prettier/plugins/markdown'
import clsx from 'clsx'
import {
  Bold,
  Braces,
  CheckSquare,
  Clipboard,
  Code2,
  Copy,
  Download,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  Heading1,
  Image,
  Italic,
  LayoutPanelLeft,
  Link,
  List,
  ListOrdered,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Printer,
  Quote,
  Save,
  Search,
  Settings2,
  Sparkles,
  SplitSquareHorizontal,
  Sun,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react'
import './App.css'

type Doc = {
  id: string
  title: string
  content: string
  updatedAt: number
}

type Template = {
  name: string
  description: string
  content: string
}

type LayoutMode = 'split' | 'editor' | 'preview'
type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'markdown-studio-documents'
const ACTIVE_DOC_KEY = 'markdown-studio-active-document'
const THEME_KEY = 'markdown-studio-theme'

const sampleDocument = `# Markdown Studio

A focused workspace for writing, cleaning, previewing, and exporting Markdown.

## What you can do

- Write with syntax highlighting
- Preview GitHub-flavored Markdown
- Format messy Markdown
- Export to Markdown, HTML, or PDF
- Save multiple local documents
- Start from practical templates

## Demo Table

| Feature | Status |
| --- | --- |
| Live preview | Done |
| Local documents | Done |
| Formatter | Done |

> Paste your draft, clean it up, and export it without leaving the browser.

\`\`\`ts
const tool = 'Markdown Studio'
console.log(\`\${tool} is ready\`)
\`\`\`
`

const templates: Template[] = [
  {
    name: 'README',
    description: 'Project overview, setup, usage, and license.',
    content: `# Project Name

Short description of what the project does and who it helps.

## Features

- Feature one
- Feature two
- Feature three

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Usage

Explain the main workflow here.

## License

MIT
`,
  },
  {
    name: 'Blog Post',
    description: 'Structured article draft with sections and checklist.',
    content: `# Blog Post Title

Short hook that explains why this topic matters.

## Introduction

Set context and describe the reader's problem.

## Main Idea

Explain the core point with examples.

## Practical Steps

1. First step
2. Second step
3. Third step

## Conclusion

Summarize the takeaway and next action.
`,
  },
  {
    name: 'Meeting Notes',
    description: 'Agenda, decisions, tasks, and follow-ups.',
    content: `# Meeting Notes

**Date:** ${new Date().toISOString().slice(0, 10)}
**Attendees:** Name, Name, Name

## Agenda

- Topic one
- Topic two

## Decisions

- Decision one

## Action Items

- [ ] Owner: task
- [ ] Owner: task

## Notes

Add notes here.
`,
  },
  {
    name: 'API Docs',
    description: 'Endpoint documentation with request and response blocks.',
    content: `# API Documentation

## Endpoint

\`POST /api/resource\`

## Request

\`\`\`json
{
  "name": "Example"
}
\`\`\`

## Response

\`\`\`json
{
  "id": "res_123",
  "name": "Example"
}
\`\`\`

## Errors

| Code | Meaning |
| --- | --- |
| 400 | Invalid request |
| 401 | Unauthorized |
`,
  },
  {
    name: 'Changelog',
    description: 'Release notes grouped by version.',
    content: `# Changelog

## 1.0.0

### Added

- Initial release

### Changed

- Improved editor workflow

### Fixed

- Fixed formatting edge cases
`,
  },
]

const createDoc = (title = 'Untitled Document', content = sampleDocument): Doc => ({
  id: crypto.randomUUID(),
  title,
  content,
  updatedAt: Date.now(),
})

const cleanTitle = (content: string, fallback: string) => {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))

  return heading ? heading.replace(/^#\s+/, '').slice(0, 72) : fallback
}

const loadDocuments = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return [createDoc()]
    const parsed = JSON.parse(stored) as Doc[]
    return parsed.length ? parsed : [createDoc()]
  } catch {
    return [createDoc()]
  }
}

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [documents, setDocuments] = useState<Doc[]>(loadDocuments)
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_DOC_KEY) ?? documents[0]?.id)
  const [layout, setLayout] = useState<LayoutMode>('split')
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem(THEME_KEY) as ThemeMode) || 'dark')
  const [query, setQuery] = useState('')
  const [fontSize, setFontSize] = useState(15)
  const [toast, setToast] = useState('Saved locally')
  const [isFormatting, setIsFormatting] = useState(false)
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const activeDoc = documents.find((doc) => doc.id === activeId) ?? documents[0]
  const content = activeDoc?.content ?? ''

  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const chars = content.length
    const reading = Math.max(1, Math.ceil(words / 220))
    const lines = content.split('\n').length
    return { words, chars, reading, lines }
  }, [content])

  const filteredDocuments = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    if (!normalized) return documents
    return documents.filter((doc) => `${doc.title} ${doc.content}`.toLowerCase().includes(normalized))
  }, [documents, query])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
  }, [documents])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_DOC_KEY, activeId)
  }, [activeId])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const timer = window.setTimeout(() => setToast('Saved locally'), 600)
    return () => window.clearTimeout(timer)
  }, [content])

  const updateActiveDoc = (nextContent: string) => {
    setToast('Saving...')
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === activeDoc.id
          ? {
              ...doc,
              title: cleanTitle(nextContent, doc.title),
              content: nextContent,
              updatedAt: Date.now(),
            }
          : doc,
      ),
    )
  }

  const addDocument = (doc?: Partial<Doc>) => {
    const next = createDoc(doc?.title ?? 'Untitled Document', doc?.content ?? '# Untitled Document\n\nStart writing...')
    setDocuments((current) => [{ ...next, ...doc, id: next.id, updatedAt: Date.now() }, ...current])
    setActiveId(next.id)
    setToast('Document created')
  }

  const deleteDocument = (id: string) => {
    if (documents.length === 1) {
      updateActiveDoc('# Untitled Document\n\nStart writing...')
      setToast('Document reset')
      return
    }

    const remaining = documents.filter((doc) => doc.id !== id)
    setDocuments(remaining)
    if (activeId === id) setActiveId(remaining[0]?.id)
    setToast('Document deleted')
  }

  const insertMarkdown = (before: string, after = '', placeholder = 'text') => {
    const view = editorRef.current?.view
    if (!view) return

    const selection = view.state.selection.main
    const selected = view.state.sliceDoc(selection.from, selection.to)
    const value = selected || placeholder
    const replacement = `${before}${value}${after}`
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: replacement },
      selection: { anchor: selection.from + before.length, head: selection.from + before.length + value.length },
    })
    view.focus()
  }

  const insertBlock = (block: string) => {
    const view = editorRef.current?.view
    if (!view) return
    const position = view.state.selection.main.head
    const prefix = position > 0 && view.state.doc.sliceString(position - 1, position) !== '\n' ? '\n\n' : ''
    view.dispatch({
      changes: { from: position, insert: `${prefix}${block}` },
      selection: { anchor: position + prefix.length + block.length },
    })
    view.focus()
  }

  const formatDocument = async () => {
    setIsFormatting(true)
    setToast('Formatting...')
    try {
      const formatted = await prettier.format(content, {
        parser: 'markdown',
        plugins: [markdownParser],
        proseWrap: 'preserve',
      })
      updateActiveDoc(formatted)
      setToast('Markdown formatted')
    } catch {
      setToast('Could not format this document')
    } finally {
      setIsFormatting(false)
    }
  }

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(content)
    setToast('Markdown copied')
  }

  const copyHtml = async () => {
    await navigator.clipboard.writeText(previewRef.current?.innerHTML ?? '')
    setToast('HTML copied')
  }

  const exportMarkdown = () => {
    downloadFile(`${activeDoc.title || 'document'}.md`, content, 'text/markdown;charset=utf-8')
    setToast('Markdown exported')
  }

  const exportHtml = () => {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${activeDoc.title}</title>
  <style>
    body { color: #172026; font: 16px/1.65 Inter, system-ui, sans-serif; margin: 40px auto; max-width: 860px; padding: 0 24px; }
    pre { background: #10161d; color: #f6f8fa; overflow: auto; padding: 16px; border-radius: 8px; }
    code { background: #eef2f5; padding: 2px 5px; border-radius: 4px; }
    pre code { background: transparent; padding: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8dee4; padding: 8px 10px; text-align: left; }
    blockquote { border-left: 4px solid #2f7d6f; color: #59636e; margin-left: 0; padding-left: 16px; }
  </style>
</head>
<body>
${previewRef.current?.innerHTML ?? ''}
</body>
</html>`
    downloadFile(`${activeDoc.title || 'document'}.html`, html, 'text/html;charset=utf-8')
    setToast('HTML exported')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    const imported = await file.text()
    addDocument({
      title: cleanTitle(imported, file.name.replace(/\.md$/i, '')),
      content: imported,
    })
    setToast('Markdown imported')
  }

  const applyTemplate = (template: Template) => {
    addDocument({ title: template.name, content: template.content })
    setToast(`${template.name} template added`)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Documents and templates">
        <div className="brand">
          <div className="brand-mark">
            <FileText size={22} />
          </div>
          <div>
            <strong>Markdown Studio</strong>
            <span>Editor, viewer, formatter</span>
          </div>
        </div>

        <label className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" />
        </label>

        <button className="primary-action" type="button" onClick={() => addDocument()}>
          <Plus size={18} />
          New document
        </button>

        <section className="sidebar-section">
          <div className="section-title">Documents</div>
          <div className="document-list">
            {filteredDocuments.map((doc) => (
              <button
                className={clsx('document-item', doc.id === activeDoc.id && 'active')}
                key={doc.id}
                type="button"
                onClick={() => setActiveId(doc.id)}
              >
                <span>{doc.title}</span>
                <small>{new Date(doc.updatedAt).toLocaleDateString()}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section template-section">
          <div className="section-title">Templates</div>
          <div className="template-list">
            {templates.map((template) => (
              <button key={template.name} className="template-item" type="button" onClick={() => applyTemplate(template)}>
                <span>{template.name}</span>
                <small>{template.description}</small>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="title-group">
            <input
              value={activeDoc.title}
              aria-label="Document title"
              onChange={(event) =>
                setDocuments((current) =>
                  current.map((doc) =>
                    doc.id === activeDoc.id ? { ...doc, title: event.target.value, updatedAt: Date.now() } : doc,
                  ),
                )
              }
            />
            <span>{toast}</span>
          </div>

          <div className="topbar-actions">
            <div className="segmented" aria-label="Layout mode">
              <button className={clsx(layout === 'editor' && 'active')} type="button" title="Editor only" onClick={() => setLayout('editor')}>
                <PanelRightClose size={17} />
              </button>
              <button className={clsx(layout === 'split' && 'active')} type="button" title="Split view" onClick={() => setLayout('split')}>
                <SplitSquareHorizontal size={17} />
              </button>
              <button className={clsx(layout === 'preview' && 'active')} type="button" title="Preview only" onClick={() => setLayout('preview')}>
                <PanelLeftClose size={17} />
              </button>
            </div>
            <button className="icon-button" type="button" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <nav className="toolbar" aria-label="Formatting toolbar">
          <button type="button" title="Bold" onClick={() => insertMarkdown('**', '**', 'bold text')}>
            <Bold size={17} />
          </button>
          <button type="button" title="Italic" onClick={() => insertMarkdown('*', '*', 'italic text')}>
            <Italic size={17} />
          </button>
          <button type="button" title="Heading" onClick={() => insertBlock('# Heading\n\n')}>
            <Heading1 size={17} />
          </button>
          <button type="button" title="Quote" onClick={() => insertBlock('> Quote\n\n')}>
            <Quote size={17} />
          </button>
          <button type="button" title="Bullet list" onClick={() => insertBlock('- First item\n- Second item\n')}>
            <List size={17} />
          </button>
          <button type="button" title="Numbered list" onClick={() => insertBlock('1. First item\n2. Second item\n')}>
            <ListOrdered size={17} />
          </button>
          <button type="button" title="Task list" onClick={() => insertBlock('- [ ] Task one\n- [ ] Task two\n')}>
            <CheckSquare size={17} />
          </button>
          <button type="button" title="Inline code" onClick={() => insertMarkdown('`', '`', 'code')}>
            <Code2 size={17} />
          </button>
          <button type="button" title="Code block" onClick={() => insertBlock('```js\nconsole.log("Hello")\n```\n')}>
            <Braces size={17} />
          </button>
          <button type="button" title="Link" onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}>
            <Link size={17} />
          </button>
          <button type="button" title="Image" onClick={() => insertBlock('![Alt text](https://example.com/image.png)\n')}>
            <Image size={17} />
          </button>
          <button type="button" title="Table" onClick={() => insertBlock('| Column | Value |\n| --- | --- |\n| Example | 123 |\n')}>
            <Table2 size={17} />
          </button>
          <span className="toolbar-divider" />
          <button type="button" title="Format Markdown" onClick={formatDocument} disabled={isFormatting}>
            <Sparkles size={17} />
            <span>Format</span>
          </button>
          <button type="button" title="Copy Markdown" onClick={copyMarkdown}>
            <Copy size={17} />
          </button>
          <button type="button" title="Copy HTML" onClick={copyHtml}>
            <Clipboard size={17} />
          </button>
          <button type="button" title="Import Markdown" onClick={() => fileInputRef.current?.click()}>
            <Upload size={17} />
          </button>
          <button type="button" title="Export Markdown" onClick={exportMarkdown}>
            <Download size={17} />
          </button>
          <button type="button" title="Export HTML" onClick={exportHtml}>
            <FileDown size={17} />
          </button>
          <button type="button" title="Print or save PDF" onClick={() => window.print()}>
            <Printer size={17} />
          </button>
          <button type="button" title="Delete document" onClick={() => deleteDocument(activeDoc.id)}>
            <Trash2 size={17} />
          </button>
          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </nav>

        <section className={clsx('panes', `mode-${layout}`)}>
          <div className="pane editor-pane">
            <div className="pane-label">
              <span>
                <LayoutPanelLeft size={15} />
                Editor
              </span>
              <label>
                <Settings2 size={14} />
                <input
                  type="range"
                  min="13"
                  max="20"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                />
              </label>
            </div>
            <CodeMirror
              ref={editorRef}
              value={content}
              height="100%"
              theme={theme === 'dark' ? oneDark : 'light'}
              extensions={[markdown()]}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
              onChange={updateActiveDoc}
              style={{ fontSize }}
            />
          </div>

          <div className="pane preview-pane">
            <div className="pane-label">
              <span>
                <Eye size={15} />
                Preview
              </span>
              <span>{stats.reading} min read</span>
            </div>
            <article className="preview-content" ref={previewRef}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {content}
              </ReactMarkdown>
            </article>
          </div>
        </section>

        <footer className="statusbar">
          <span>
            <Save size={14} />
            Auto-save on
          </span>
          <span>{stats.words} words</span>
          <span>{stats.chars} characters</span>
          <span>{stats.lines} lines</span>
          <span className="status-hide-mobile">Local-first workspace</span>
          <button type="button" onClick={() => addDocument({ title: activeDoc.title, content })}>
            <FilePlus2 size={14} />
            Duplicate
          </button>
        </footer>
      </section>
    </main>
  )
}

export default App
