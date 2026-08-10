export type DescBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }

const BULLET_RE = /^[•·*\-–]\s*/

function isHeading(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  if (/[.!?]$/.test(trimmed)) return false
  if (trimmed.length > 60) return false
  if (trimmed.endsWith(":") || trimmed.endsWith("：")) return true
  if (/,/.test(trimmed)) return false
  const words = trimmed.split(/\s+/)
  const titleCase = words.every(w => /^[A-Z0-9(&]/.test(w))
  const allCaps = /[A-Z]{2}/.test(trimmed) && trimmed === trimmed.toUpperCase()
  return titleCase || allCaps
}

const DESCRIPTION_CLEANUP_RULES = [
  // Clean up encoding noise (e.g. Â•) and inline lists, formatting them onto newlines
  { pattern: /Â•/g, replacement: "\n• " },
  { pattern: /Â/g, replacement: "" }, // Remove remaining corrupt encoding characters
  { pattern: /\s+•\s+/g, replacement: "\n• " }, // Split inline bullets into clean list items
  { pattern: /\s+·\s+/g, replacement: "\n· " },

  // Split key-value details onto new lines to match Image 2 style, avoiding conflicts
  { pattern: /(?:Key\s+)?Job Details\s*[:：]?/gi, replacement: "\n\nJob Details:\n" },
  { pattern: /Location\s+Remote\s*[:：]?/gi, replacement: "\nLocation: Remote\n" },
  { pattern: /Company\s+Test II\s*\(contract\)\s*[:：]?/gi, replacement: "\nCompany: Test II (contract)\n" },
  { pattern: /Company\s+([A-Za-z0-9\s#]+?)(?=\s+Position|\s+Start Date|\s+Compensation|\s+Immediate|\s+Test|$)/g, replacement: "\nCompany: $1\n" },
  { pattern: /Position\s+([A-Za-z0-9\s#]+?)(?=\s+Start Date|\s+Compensation|\s+Immediate|$)/gi, replacement: "\nJob Title: $1\n" },
  { pattern: /Start Date\s+([A-Za-z0-9\s#]+?)(?=\s+Compensation|\s+Immediate|$)/gi, replacement: "\nStart Date: $1\n" },
  { pattern: /Compensation\s+([A-Za-z0-9\s#$%-]+?)(?=\s+At reputed|\s+At|$)/gi, replacement: "\nCompensation: $1\n" },

  // Split Salesforce specific structure & headings
  { pattern: /Job Category\s*[:：]?/gi, replacement: "\n\nJob Category:\n" },
  { pattern: /About Salesforce\s*[:：]?/gi, replacement: "\n\nAbout Salesforce:\n" },
  { pattern: /Welcome to the Agentforce Era\./gi, replacement: "\n\nWelcome to the Agentforce Era.\n" },
  { pattern: /Agentforce is the future of AI/gi, replacement: "\n\nAgentforce is the future of AI" },
  { pattern: /Note:\s*By applying to this posting/gi, replacement: "\n\nNote:\nBy applying to this posting" },
  { pattern: /Positions available\s*[:：]?/gi, replacement: "\n\nPositions available:\n" },
  { pattern: /Join our dynamic team/gi, replacement: "\n\nJoin our dynamic team" },
  { pattern: /Your Impact\s*[:：]?/gi, replacement: "\n\nYour Impact:\n" },
  { pattern: /As part of this role, you will\s*[:：]?/gi, replacement: "\n\nAs part of this role, you will:\n" },
  { pattern: /What we are looking for\s*[:：]?/gi, replacement: "\n\nWhat we are looking for:\n" },
  { pattern: /Required Skills\s*[:：]?/gi, replacement: "\n\nRequired Skills:\n" },
  { pattern: /Accommodations\s+If you need/gi, replacement: "\n\nAccommodations:\nIf you need" },
  { pattern: /Posting Statement\s+Salesforce is/gi, replacement: "\n\nPosting Statement:\nSalesforce is" },
  { pattern: /What does that mean exactly\?\s+It means/gi, replacement: "\n\nWhat does that mean exactly?:\nIt means" },
  { pattern: /Know your rights\s*[:：]?\s*workplace/gi, replacement: "\n\nKnow your rights:\nworkplace" },
  { pattern: /Recruiting, hiring,\s+and promotion/gi, replacement: "\n\nRecruiting, hiring, and promotion:\n" },
  { pattern: /In the United States,\s+compensation/gi, replacement: "\n\nIn the United States:\ncompensation" },
  { pattern: /More details\s+about company/gi, replacement: "\n\nMore details:\nabout company" },
  { pattern: /Pursuant to\s+the San Francisco/gi, replacement: "\n\nPursuant to:\nthe San Francisco" },
  { pattern: /At Salesforce,\s+we believe in/gi, replacement: "\n\nAt Salesforce:\nwe believe in" },
  { pattern: /The typical base salary range\s+for/gi, replacement: "\n\nThe typical base salary range:\nfor" },
  { pattern: /In select cities\s+within/gi, replacement: "\n\nIn select cities:\nwithin" },
  { pattern: /Please see our Candidate Privacy/gi, replacement: "\n\nPlease see our Candidate Privacy" },
  { pattern: /Please note that Salesforce uses/gi, replacement: "\n\nPlease note that Salesforce uses" },

  // Split list points under Your Impact
  { pattern: /Your Impact:\s*so you can/gi, replacement: "Your Impact:\n• so you can" },
  { pattern: /\s+Together, we'll bring the power/gi, replacement: "\n• Together, we'll bring the power" },
  { pattern: /\s+Apply today to not only shape/gi, replacement: "\n• Apply today to not only shape" },

  // Split list responsibilities under "As part of this role, you will:"
  { pattern: /\s+Architect, design, implement, test and deliver/gi, replacement: "\n• Architect, design, implement, test and deliver" },
  { pattern: /\s+Master our development process/gi, replacement: "\n• Master our development process" },
  { pattern: /\s+Operate optimally/gi, replacement: "\n• Operate optimally" },
  { pattern: /\s+Collaborate with product managers/gi, replacement: "\n• Collaborate with product managers" },
  { pattern: /\s+Work with the infrastructure team/gi, replacement: "\n• Work with the infrastructure team" },
  { pattern: /\s+Mentor others/gi, replacement: "\n• Mentor others" },
  { pattern: /\s+Present your own/gi, replacement: "\n• Present your own" },
  { pattern: /\s+Develop test/gi, replacement: "\n• Develop test" },
  { pattern: /\s+Participate in/gi, replacement: "\n• Participate in" },
  { pattern: /\s+Build and ship/gi, replacement: "\n• Build and ship" },
  { pattern: /\s+Design and orchestrate/gi, replacement: "\n• Design and orchestrate" },
  { pattern: /\s+Contribute to building/gi, replacement: "\n• Contribute to building" },
  { pattern: /\s+Critically evaluate/gi, replacement: "\n• Critically evaluate" },

  // Split list requirements under "What we are looking for:" / "Required Skills:"
  { pattern: /What we are looking for:\s*4\+/gi, replacement: "What we are looking for:\n• 4+" },
  { pattern: /\s+4\+ years of software/gi, replacement: "\n• 4+ years of software" },
  { pattern: /\s+Strong coding skills/gi, replacement: "\n• Strong coding skills" },
  { pattern: /\s+Experience building and maintaining/gi, replacement: "\n• Experience building and maintaining" },
  { pattern: /\s+Knowledge of frontend frameworks/gi, replacement: "\n• Knowledge of frontend frameworks" },
  { pattern: /\s+Familiarity with database technologies/gi, replacement: "\n• Familiarity with database technologies" },
  { pattern: /\s+Ability to work in a fast-paced/gi, replacement: "\n• Ability to work in a fast-paced" },
  { pattern: /\s+Excellent communication and collaboration/gi, replacement: "\n• Excellent communication and collaboration" },
  { pattern: /\s+Passion for learning new technologies/gi, replacement: "\n• Passion for learning new technologies" },
  { pattern: /\s+Deep knowledge/gi, replacement: "\n• Deep knowledge" },
  { pattern: /\s+High proficiency/gi, replacement: "\n• High proficiency" },
  { pattern: /\s+Proven understanding/gi, replacement: "\n• Proven understanding" },
  { pattern: /\s+Validated understanding/gi, replacement: "\n• Validated understanding" },
  { pattern: /\s+Experience in automated/gi, replacement: "\n• Experience in automated" },
  { pattern: /\s+A demonstrated, genuine/gi, replacement: "\n• A demonstrated, genuine" },
  { pattern: /\s+Experience using AI/gi, replacement: "\n• Experience using AI" },

  // Split main headings onto new lines and ensure they end with colon to trigger isHeading style
  { pattern: /Job Responsibilities\s*[:：]?/g, replacement: "\n\nJob Responsibilities:\n" },
  { pattern: /Requirements\s*[:：]?/g, replacement: "\n\nRequirements:\n" },
  { pattern: /Preferred Qualifications\s*[:：]?/g, replacement: "\n\nPreferred Qualifications:\n" }
]

export function parseDescription(text: string): DescBlock[] {
  let cleanedText = text
  for (const rule of DESCRIPTION_CLEANUP_RULES) {
    cleanedText = cleanedText.replace(rule.pattern, rule.replacement)
  }

  const lines = cleanedText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)

  const blocks: DescBlock[] = []
  const pushList = (item: string) => {
    const prev = blocks[blocks.length - 1]
    if (prev && prev.type === "list") {
      prev.items.push(item)
    } else {
      blocks.push({ type: "list", items: [item] })
    }
  }
  const pushHeading = (heading: string) => {
    const prev = blocks[blocks.length - 1]
    const normalized = heading.replace(/[：:]$/, "").trim().toLowerCase()
    const prevNormalized = prev?.type === "heading"
      ? prev.text.replace(/[：:]$/, "").trim().toLowerCase()
      : ""
    if (!(prev?.type === "heading" && prevNormalized === normalized)) {
      blocks.push({ type: "heading", text: heading })
    }
  }

  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      pushList(line.replace(BULLET_RE, ""))
      continue
    }

    const glued = line.match(/^(.{1,60}?)[：:]•\s*(.+)$/)
    if (glued) {
      pushHeading(glued[1].trim())
      pushList(glued[2].trim())
      continue
    }

    if (isHeading(line)) {
      pushHeading(line)
      continue
    }

    blocks.push({ type: "paragraph", text: line })
  }

  // If the first block is a generic heading, remove it to prevent duplicates with the UI header
  if (blocks.length > 0 && blocks[0].type === "heading") {
    const textLower = blocks[0].text.toLowerCase().trim().replace(/[：:]$/, "")
    const genericHeadings = [
      "about the job",
      "about the role",
      "job description",
      "role description",
      "description",
      "about us"
    ]
    if (genericHeadings.includes(textLower)) {
      blocks.shift()
    }
  }

  return blocks
}
