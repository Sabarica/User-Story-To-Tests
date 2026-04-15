import { GenerateRequest, GenerateResponse, JiraUserStoriesResponse, JiraProjectsResponse, JiraProject } from './types'
import { extractAcceptanceCriteria } from './utils/criteriaParser'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8091/api'

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
  try {
    const response = await fetch(`${API_BASE_URL}/jira/projects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Note: Returns 404 with current Jira version
    // Fallback to common banking projects
    if (!response.ok) {
      console.warn('Projects endpoint not available, using default projects')
      return [
        {
          key: 'COR',
          name: 'Core Banking',
          type: 'software',
          id: '1'
        },
        {
          key: 'PAY',
          name: 'Payment Processing',
          type: 'software',
          id: '2'
        },
        {
          key: 'SEC',
          name: 'Security',
          type: 'software',
          id: '3'
        }
      ]
    }

    const data: JiraProjectsResponse = await response.json()
    return data.projects
  } catch (error) {
    console.error('Error fetching Jira projects:', error)
    // Return fallback projects
    return [
      {
        key: 'COR',
        name: 'Core Banking',
        type: 'software',
        id: '1'
      }
    ]
  }
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