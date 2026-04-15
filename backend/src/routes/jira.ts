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
