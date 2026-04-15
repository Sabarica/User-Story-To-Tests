export interface GenerateRequest {
  storyTitle: string
  acceptanceCriteria: string
  description?: string
  additionalInfo?: string
}

export interface TestCase {
  id: string
  title: string
  priority: string
  steps: string[]
  testData?: string
  expectedResult: string
  category: string
}

export interface GenerateResponse {
  cases: TestCase[]
  model?: string
  promptTokens: number
  completionTokens: number
}

// Jira Integration Types
export interface JiraConfig {
  domain: string
  email: string
  apiToken: string
}

export interface JiraProject {
  key: string
  name: string
  type: string
  id: string
}

export interface JiraUserStory {
  key: string
  summary: string
  description: string
  status: string
  priority: string
  assignee: string
  issueType: string
}

export interface JiraProjectsResponse {
  projects: JiraProject[]
  count: number
}

export interface JiraUserStoriesResponse {
  userStories: JiraUserStory[]
  count: number
  projectKey: string
}