/**
 * Utility for parsing user story descriptions and extracting acceptance criteria
 * Handles: User Story Format (As a...) and Given-When-Then format
 */

export interface ParsedCriteria {
  actor?: string
  action?: string
  benefit?: string
  givenWhenThen: string[]
  rawCriteria: string
}

/**
 * Parse user story description to extract acceptance criteria
 * Supports:
 * 1. "As a <role>, I want <action>, so that <benefit>"
 * 2. "Given <context>", "When <action>", "Then <result>"
 * 3. Generic acceptance criteria
 */
export function parseAcceptanceCriteria(description: string): ParsedCriteria {
  const criteria: ParsedCriteria = {
    actor: undefined,
    action: undefined,
    benefit: undefined,
    givenWhenThen: [],
    rawCriteria: description
  }

  if (!description) return criteria

  // Parse "As a... I want... so that..." format
  const userStoryRegex = /As\s+a\s+([^,]+),\s*I\s+want\s+([^,]+),\s*so\s+that\s+([^.]+)/i
  const userStoryMatch = description.match(userStoryRegex)
  if (userStoryMatch) {
    criteria.actor = userStoryMatch[1].trim()
    criteria.action = userStoryMatch[2].trim()
    criteria.benefit = userStoryMatch[3].trim()
  }

  // Parse "Given-When-Then" format
  const givenWhenThenRegex = /(Given|When|Then)\s+([^.!?\n]+[.!?]?)/gi
  let match
  while ((match = givenWhenThenRegex.exec(description)) !== null) {
    criteria.givenWhenThen.push(`${match[1]} ${match[2]}`)
  }

  return criteria
}

/**
 * Format parsed criteria into human-readable acceptance criteria text
 */
export function formatAcceptanceCriteria(parsed: ParsedCriteria): string {
  const lines: string[] = []

  // Add user story format if parsed
  if (parsed.actor || parsed.action || parsed.benefit) {
    lines.push(`As a ${parsed.actor || 'user'},`)
    lines.push(`I want to ${parsed.action || 'perform an action'},`)
    lines.push(`so that ${parsed.benefit || 'achieve a goal'}`)
    lines.push('')
  }

  // Add Given-When-Then if found
  if (parsed.givenWhenThen.length > 0) {
    lines.push('Acceptance Criteria:')
    parsed.givenWhenThen.forEach(criterion => {
      lines.push(`• ${criterion}`)
    })
    lines.push('')
  }

  // Add original if no parsing was done
  if (lines.length === 0 && parsed.rawCriteria) {
    lines.push('Description:')
    lines.push(parsed.rawCriteria)
  }

  return lines.join('\n')
}

/**
 * Extract acceptance criteria from different sources
 */
export function extractAcceptanceCriteria(
  description?: string,
  _summary?: string,
  status?: string,
  priority?: string,
  assignee?: string
): string {
  const parts: string[] = []

  // Parse description for user story format
  if (description) {
    const parsed = parseAcceptanceCriteria(description)
    if (parsed.actor && parsed.action && parsed.benefit) {
      parts.push(`As a ${parsed.actor}, I want to ${parsed.action}, so that ${parsed.benefit}`)
    } else if (parsed.givenWhenThen.length > 0) {
      parts.push(parsed.givenWhenThen.join('\n'))
    } else if (description.length > 0) {
      // Use description as-is if no pattern found
      parts.push(description.substring(0, 200))
    }
  }

  // Add metadata
  if (status || priority || assignee) {
    parts.push('')
    if (status) parts.push(`Status: ${status}`)
    if (priority) parts.push(`Priority: ${priority}`)
    if (assignee) parts.push(`Assignee: ${assignee}`)
  }

  return parts.join('\n').trim()
}
