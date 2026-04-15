/**
 * Jira API Routes
 * Endpoints for fetching Jira projects and user stories
 */

import express from 'express'
import { JiraClient } from '../llm/jiraClient'
import { loadJiraConfig } from '../config/jiraConfig'

export const jiraRouter = express.Router()

// Initialize Jira client lazily (only when first needed)
let jiraClient: JiraClient | null = null
let initError: Error | null = null
let initialized = false

function initializeJiraClient(): void {
  if (initialized) return

  initialized = true
  try {
    const config = loadJiraConfig()
    jiraClient = new JiraClient(config)
    console.log('✓ Jira client initialized successfully')
  } catch (error) {
    initError = error as Error
    console.error('⚠ Failed to initialize Jira client:', initError.message)
  }
}

/**
 * GET /api/jira/test-connection
 * Test Jira connectivity with provided credentials
 * Returns: { success: boolean, message: string }
 */
jiraRouter.get('/test-connection', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    initializeJiraClient()

    if (!jiraClient) {
      res.status(500).json({
        success: false,
        message: 'Jira client not initialized: ' + (initError?.message || 'Unknown error')
      })
      return
    }

    const isConnected = await jiraClient.testConnection()
    res.json({
      success: isConnected,
      message: isConnected ? 'Connected to Jira successfully' : 'Failed to connect to Jira'
    })
  } catch (error: any) {
    console.error('Error testing Jira connection:', error.message)
    res.status(500).json({
      success: false,
      message: `Connection test failed: ${error.message}`
    })
  }
})

/**
 * GET /api/jira/projects
 * Fetch all accessible Jira projects
 * Returns: { projects: JiraProject[] }
 */
jiraRouter.get('/projects', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    initializeJiraClient()

    if (!jiraClient) {
      res.status(500).json({
        error: 'Jira client not initialized',
        message: initError?.message
      })
      return
    }

    const projects = await jiraClient.fetchProjects()
    res.json({
      projects,
      count: projects.length
    })
  } catch (error: any) {
    console.error('Error fetching Jira projects:', error.message)
    res.status(500).json({
      error: 'Failed to fetch projects',
      message: error.message
    })
  }
})

/**
 * GET /api/jira/userstories
 * Fetch user stories for a specific project
 * Query Parameters:
 *   - projectKey (required): The Jira project key (e.g., "COR")
 * Returns: { userStories: UserStoryData[] }
 */
jiraRouter.get('/userstories', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    initializeJiraClient()

    const { projectKey } = req.query

    if (!projectKey || typeof projectKey !== 'string') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'projectKey parameter is required'
      })
      return
    }

    if (!jiraClient) {
      res.status(500).json({
        error: 'Jira client not initialized',
        message: initError?.message
      })
      return
    }

    const userStories = await jiraClient.fetchUserStories(projectKey)
    res.json({
      userStories,
      count: userStories.length,
      projectKey
    })
  } catch (error: any) {
    console.error('Error fetching user stories:', error.message)
    res.status(500).json({
      error: 'Failed to fetch user stories',
      message: error.message
    })
  }
})

/**
 * POST /api/jira/configure
 * Accept Jira credentials from frontend and reinitialize the client
 */
jiraRouter.post('/configure', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { email, apiToken, baseUrl } = req.body

    if (!email || !apiToken) {
      res.status(400).json({
        success: false,
        message: 'Email and API Token are required'
      })
      return
    }

    // Extract domain from baseUrl or use default
    let domain = ''
    if (baseUrl) {
      const match = baseUrl.match(/https?:\/\/([^.]+)\.atlassian\.net/)
      if (match) {
        domain = match[1]
      } else {
        domain = baseUrl.replace(/https?:\/\//, '').replace(/\.atlassian\.net.*/, '')
      }
    }

    if (!domain) {
      res.status(400).json({
        success: false,
        message: 'Valid Jira Base URL is required (e.g., https://your-domain.atlassian.net)'
      })
      return
    }

    const config = {
      domain,
      email,
      apiToken,
      apiBaseUrl: `https://${domain}.atlassian.net/rest/api/3`
    }

    // Reset and reinitialize
    jiraClient = new JiraClient(config)
    initError = null
    initialized = true

    // Test the connection
    const isConnected = await jiraClient.testConnection()

    if (isConnected) {
      res.json({
        success: true,
        message: `Connected to Jira as ${email}`,
        email
      })
    } else {
      jiraClient = null
      res.status(401).json({
        success: false,
        message: 'Failed to authenticate with Jira. Check your credentials.'
      })
    }
  } catch (error: any) {
    console.error('Error configuring Jira:', error.message)
    jiraClient = null
    res.status(500).json({
      success: false,
      message: `Configuration failed: ${error.message}`
    })
  }
})

/**
 * Health check for Jira integration
 * GET /api/jira/status
 */
jiraRouter.get('/status', (req: express.Request, res: express.Response): void => {
  initializeJiraClient()

  const isInitialized = jiraClient !== null
  res.json({
    initialized: isInitialized,
    error: initError?.message || null,
    timestamp: new Date().toISOString()
  })
})
