import { GenerateRequest, GenerateResponse, JiraUserStoriesResponse, JiraProjectsResponse, JiraProject, TestCase } from './types'
import { extractAcceptanceCriteria } from './utils/criteriaParser'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8091/api')

export async function generateTests(request: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: GenerateResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error generating tests:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

/**
 * Configure Jira with credentials from the UI
 */
export async function configureJira(email: string, apiToken: string, baseUrl: string): Promise<{ success: boolean; message: string; email?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/configure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, apiToken, baseUrl }),
    })

    const data = await response.json()
    if (!response.ok) {
      return { success: false, message: data.message || 'Configuration failed' }
    }
    return data
  } catch (error) {
    console.error('Error configuring Jira:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to configure Jira' }
  }
}

/**
 * Test Jira connectivity
 */
export async function testJiraConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/test-connection`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error testing Jira connection:', error)
    throw error instanceof Error ? error : new Error('Failed to test connection')
  }
}

/**
 * Fetch all Jira projects (placeholder - returns hardcoded projects for now)
 * Data fetched from user's Jira instance
 */
export async function fetchJiraProjects(): Promise<JiraProject[]> {
  const response = await fetch(`${API_BASE_URL}/jira/projects`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.message || `Failed to fetch projects (HTTP ${response.status})`)
  }

  const data: JiraProjectsResponse = await response.json()
  return data.projects
}

/**
 * Fetch user stories for a specific project from Jira
 * Applies acceptance criteria parsing to each story
 */
export async function fetchUserStories(projectKey: string): Promise<JiraUserStoriesResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/jira/userstories?projectKey=${encodeURIComponent(projectKey)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: JiraUserStoriesResponse = await response.json()
    
    // Enhance stories with parsed acceptance criteria
    data.userStories = data.userStories.map(story => ({
      ...story,
      description: extractAcceptanceCriteria(
        story.description,
        story.summary,
        story.status,
        story.priority,
        story.assignee
      )
    }))

    return data
  } catch (error) {
    console.error('Error fetching user stories:', error)
    throw error instanceof Error ? error : new Error('Failed to fetch user stories')
  }
}

/**
 * Check if a Jira issue already has test case attachments
 */
export async function checkExistingAttachments(issueKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/check-attachments?issueKey=${encodeURIComponent(issueKey)}`)
    const data = await response.json()
    return data.hasExisting === true
  } catch {
    return false
  }
}

/**
 * Map generated test cases to a Jira user story as a comment
 */
export async function mapTestCasesToJira(issueKey: string, testCases: TestCase[], mode: 'overwrite' | 'version' = 'overwrite'): Promise<{ success: boolean; message: string; jiraBaseUrl?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/jira/map-testcases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ issueKey, testCases, mode }),
    })

    const data = await response.json()
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to map test cases' }
    }
    return data
  } catch (error) {
    console.error('Error mapping test cases:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Failed to map test cases' }
  }
}