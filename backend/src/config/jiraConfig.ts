/**
 * Jira Configuration Module
 * Manages environment variables and connectivity settings for Jira integration
 */

export interface JiraConfig {
  domain: string
  email: string
  apiToken: string
  apiBaseUrl: string
}

/**
 * Load Jira configuration from environment variables
 * These should be set in .env file before application startup
 */
export function loadJiraConfig(): JiraConfig {
  const domain = process.env.JIRA_DOMAIN
  const email = process.env.JIRA_EMAIL
  const apiToken = process.env.JIRA_API_TOKEN

  if (!domain) {
    throw new Error('JIRA_DOMAIN environment variable is not set')
  }
  if (!email) {
    throw new Error('JIRA_EMAIL environment variable is not set')
  }
  if (!apiToken) {
    throw new Error('JIRA_API_TOKEN environment variable is not set')
  }

  const apiBaseUrl = `https://${domain}.atlassian.net/rest/api/3`

  return {
    domain,
    email,
    apiToken,
    apiBaseUrl
  }
}

/**
 * Check if Jira is properly configured
 * Returns true if all required env vars are set
 */
export function isJiraConfigured(): boolean {
  return !!(
    process.env.JIRA_DOMAIN &&
    process.env.JIRA_EMAIL &&
    process.env.JIRA_API_TOKEN
  )
}

/**
 * Create Base64 encoded authentication header for Jira API
 * Jira uses Basic Auth with format: email:apiToken
 */
export function createJiraAuthHeader(email: string, apiToken: string): string {
  const credentials = `${email}:${apiToken}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}
