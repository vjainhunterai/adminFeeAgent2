import React from 'react'

/**
 * Simple markdown renderer for agent chat messages.
 * Supports: **bold**, `code`, ```code blocks```, tables, \n, - lists
 */
export default function MarkdownRenderer({ text }) {
  if (!text) return null

  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g)

  return (
    <div>
      {parts.map((part, i) => {
        // Code block
        if (part.startsWith('```')) {
          const code = part.replace(/```\w*\n?/, '').replace(/\n?```$/, '')
          return <pre key={i}>{code}</pre>
        }

        // Check if this part contains a markdown table
        const lines = part.split('\n')
        const elements = []
        let tableBuffer = []
        let inTable = false

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li]
          const isTableRow = /^\|.*\|$/.test(line.trim())
          const isSeparator = /^\|[\s\-:|]+\|$/.test(line.trim())

          if (isTableRow) {
            tableBuffer.push(line.trim())
            inTable = true
          } else {
            if (inTable && tableBuffer.length > 0) {
              elements.push(renderTable(tableBuffer, `table-${i}-${li}`))
              tableBuffer = []
              inTable = false
            }
            if (line.trim()) {
              elements.push(<p key={`${i}-${li}`} style={{ margin: '3px 0' }}>{renderInline(line)}</p>)
            } else if (li > 0 && li < lines.length - 1) {
              elements.push(<br key={`br-${i}-${li}`} />)
            }
          }
        }

        // Flush remaining table
        if (tableBuffer.length > 0) {
          elements.push(renderTable(tableBuffer, `table-${i}-end`))
        }

        return <React.Fragment key={i}>{elements}</React.Fragment>
      })}
    </div>
  )
}

function renderInline(text) {
  // Bold **text**
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g)
  return parts.map((p, j) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={j}>{p.slice(2, -2)}</strong>
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return <code key={j}>{p.slice(1, -1)}</code>
    }
    // List items
    if (p.trim().startsWith('- ')) {
      return <span key={j}>{'  '}&bull; {p.trim().slice(2)}</span>
    }
    return p
  })
}

function renderTable(rows, key) {
  // Filter out separator rows
  const dataRows = rows.filter((r) => !/^\|[\s\-:|]+\|$/.test(r))
  if (dataRows.length === 0) return null

  const parseRow = (row) =>
    row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map((c) => c.trim())

  const header = parseRow(dataRows[0])
  const body = dataRows.slice(1).map(parseRow)

  return (
    <table key={key}>
      <thead>
        <tr>{header.map((h, i) => <th key={i}>{renderInline(h)}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j}>{renderInline(cell)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}
