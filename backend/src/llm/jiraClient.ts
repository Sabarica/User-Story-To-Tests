/**
 * Jira API Client
 * Handles all HTTP communication with Jira REST API
 */

import axios, { AxiosInstance } from 'axios'
import { createJiraAuthHeader, JiraConfig } from '../config/jiraConfig'

export interface JiraProject {
  key: string
  name: string
  type: string
  id: string
}

export interface JiraUserStory {
  key: string
  fields: {
    summary: string
    description?: string | { content?: Array<{ content?: Array<{ text: string }> }> }
    status: { name: string }
    priority?: { name: string }
    assignee?: { displayName: string }
    issuetype: { name: string }
  }
}

export interface UserStoryData {
  key: string
  summary: string
  description: string
  status: string
  priority: string
  assignee: string
  issueType: string
}

export class JiraClient {
  private axiosInstance: AxiosInstance
  private config: JiraConfig

  constructor(config: JiraConfig) {
    this.config = config
    const authHeader = createJiraAuthHeader(config.email, config.apiToken)

    this.axiosInstance = axios.create({
      baseURL: config.apiBaseUrl,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 10000
    })
  }

  /**
   * Fetch all projects from Jira
   * Tries multiple API endpoints and falls back to extracting projects from recent issues
   */
  async fetchProjects(): Promise<JiraProject[]> {
    try {
      // Strategy 1: Try /projects/search endpoint
      try {
        const response = await this.axiosInstance.get('/projects/search', {
          params: { maxResults: 50 }
        })
        const projects: JiraProject[] = response.data.values.map((project: any) => ({
          key: project.key,
          name: project.name,
          type: project.projectTypeKey,
          id: project.id
        }))
        console.log(`✓ Fetched ${projects.length} projects using /projects/search`)
        return projects
      } catch (err1: any) {
        console.log('Strategy 1 failed (/projects/search), trying strategy 2...')
      }

      // Strategy 2: Try /projects endpoint
      try {
        const response = await this.axiosInstance.get('/projects', {
          params: { expand: 'description,lead,issueTypes', maxResults: 50 }
        })
        const projects: JiraProject[] = response.data.map((project: any) => ({
          key: project.key,
          name: project.name,
          type: project.projectTypeKey,
          id: project.id
        }))
        console.log(`✓ Fetched ${projects.length} projects using /projects`)
        return projects
      } catch (err2: any) {
        console.log('Strategy 2 failed (/projects), trying strategy 3...')
      }

      // Strategy 3: Extract projects from recent issues using POST (matches Postman collection)
      console.log('Strategy 3: Extracting projects from recent stories via POST /search/jql...')
      const jql = 'issuetype = Story ORDER BY created DESC'
      const response = await this.axiosInstance.post('/search/jql', {
        jql,
        fields: ['key', 'summary'],
        maxResults: 100
      })

      const issues = response.data.issues || response.data.values || []
      console.log(`Strategy 3: Got ${issues.length} issues from search`)

      // Extract unique project keys from issues
      const projectMap = new Map<string, string>()
      issues.forEach((issue: any) => {
        if (issue.key) {
          const projectKey = issue.key.split('-')[0]
          if (!projectMap.has(projectKey)) {
            // Use project info from issue if available, otherwise use key as name
            const projectName = issue.fields?.project?.name || `Project ${projectKey}`
            projectMap.set(projectKey, projectName)
          }
        }
      })

      const projects: JiraProject[] = Array.from(projectMap.entries()).map(([key, name], index) => ({
        key,
        name,
        type: 'software',
        id: String(index)
      }))

      console.log(`✓ Fetched ${projects.length} projects from recent stories: ${Array.from(projectMap.keys()).join(', ')}`)
      return projects
    } catch (error: any) {
      console.error('Error fetching Jira projects:', error.message)
      throw new Error(`Failed to fetch projects: ${error.message}`)
    }
  }

  /**
   * Fetch user stories for a specific project using JQL
   * API: GET /search/jql (based on Jira migration message)
   */
  async fetchUserStories(projectKey: string): Promise<UserStoryData[]> {
    try {
      // Build JQL query
      const jql = `project = "${projectKey}" AND issuetype = Story`

      // Using GET /search/jql with query parameters
      const requestParams = {
        jql,
        maxResults: 100,
        startAt: 0,
        fields: ['key', 'summary', 'description', 'status', 'priority', 'assignee'].join(',')
      }

      console.log('📤 Sending GET request to Jira:/search/jql')
      console.log('   Params:', JSON.stringify(requestParams))

      const response = await this.axiosInstance.get('/search/jql', {
        params: requestParams
      })

      console.log('📥 Response from Jira:', {
        issueCount: response.data.issues?.length || 0,
        isLast: response.data.isLast
      })

      const userStories: UserStoryData[] = response.data.issues.map((issue: JiraUserStory) =>
        this.parseUserStory(issue)
      )

      console.log(`✓ Fetched ${userStories.length} user stories from project ${projectKey}`)
      return userStories
    } catch (error: any) {
      console.error('❌ Error fetching user stories:')
      console.error('   Status:', error.response?.status)
      console.error('   Data:', error.response?.data)
      console.error('   Message:', error.message)
      throw new Error(`Failed to fetch user stories: ${error.message}`)
    }
  }

  /**
   * Parse Jira issue into UserStoryData format
   */
  private parseUserStory(issue: JiraUserStory): UserStoryData {
    // Handle complex description format from Jira API
    let description = ''
    if (issue.fields.description) {
      if (typeof issue.fields.description === 'string') {
        description = issue.fields.description
      } else if (issue.fields.description.content) {
        description = issue.fields.description.content
          .map((block: any) => {
            if (block.content) {
              return block.content.map((item: any) => item.text).join('')
            }
            return ''
          })
          .join('\n')
      }
    }

    return {
      key: issue.key,
      summary: issue.fields.summary,
      description,
      status: issue.fields.status?.name || 'Unknown',
      priority: issue.fields.priority?.name || 'No Priority',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      issueType: issue.fields.issuetype?.name || 'Story'
    }
  }

  /**
   * Test Jira connectivity
   * Returns true if credentials are valid
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.axiosInstance.get('/myself')
      console.log('✓ Jira connection successful')
      return true
    } catch (error: any) {
      console.error('✗ Jira connection failed:', error.response?.data || error.message)
      return false
    }
  }
}
