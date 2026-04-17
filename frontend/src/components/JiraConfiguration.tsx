import { useState, useEffect } from 'react'
import { configureJira, fetchJiraProjects, fetchUserStories } from '../api'
import { JiraProject, JiraUserStory } from '../types'

interface JiraConfigurationProps {
  onStorySelected: (story: JiraUserStory) => void
  onStoriesSelected?: (stories: JiraUserStory[]) => void
  clearKey?: number
  onDomainConfigured?: (domain: string) => void
}

export function JiraConfiguration({ onStorySelected, onStoriesSelected, clearKey, onDomainConfigured }: JiraConfigurationProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [configuredEmail, setConfiguredEmail] = useState('')
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [error, setError] = useState('')

  // Project & story selection state
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [userStories, setUserStories] = useState<JiraUserStory[]>([])
  const [selectedStoryKeys, setSelectedStoryKeys] = useState<Set<string>>(new Set())
  const [isLoadingStories, setIsLoadingStories] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)

  // React to clear signal from parent
  useEffect(() => {
    if (clearKey && clearKey > 0) {
      setSelectedStoryKeys(new Set())
      setUserStories([])
      setSelectedProject(projects.length > 0 ? projects[0].key : '')
      if (projects.length > 0) {
        loadStories(projects[0].key)
      }
    }
  }, [clearKey])

  const handleConfigure = async () => {
    if (!email.trim() || !apiKey.trim() || !baseUrl.trim()) {
      setError('Email, API Key, and Jira Base URL are required')
      return
    }

    setIsConfiguring(true)
    setError('')

    try {
      const result = await configureJira(email, apiKey, baseUrl)
      if (result.success) {
        setIsConfigured(true)
        setConfiguredEmail(email)
        setIsExpanded(false)
        onDomainConfigured?.(baseUrl)

        // Load projects
        await refreshProjects()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed')
    } finally {
      setIsConfiguring(false)
    }
  }

  const refreshProjects = async () => {
    setIsLoadingProjects(true)
    setError('')
    try {
      const loadedProjects = await fetchJiraProjects()
      setProjects(loadedProjects)
      if (loadedProjects.length > 0) {
        setSelectedProject(loadedProjects[0].key)
        loadStories(loadedProjects[0].key)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const loadStories = async (projectKey: string) => {
    if (!projectKey) return
    setIsLoadingStories(true)
    setUserStories([])
    setSelectedStoryKeys(new Set())
    try {
      const response = await fetchUserStories(projectKey)
      setUserStories(response.userStories)
    } catch {
      // silent
    } finally {
      setIsLoadingStories(false)
    }
  }

  const handleProjectChange = (key: string) => {
    setSelectedProject(key)
    loadStories(key)
  }

  const handleStoryToggle = (storyKey: string) => {
    setSelectedStoryKeys(new Set([storyKey]))
  }

  const handleImportStories = () => {
    if (selectedStoryKeys.size === 0) return
    const selectedStories = userStories.filter(s => selectedStoryKeys.has(s.key))
    if (selectedStories.length > 0) {
      onStorySelected(selectedStories[0])
    }
  }

  return (
    <>
      {/* Jira Configuration Panel */}
      <div style={styles.wrapper}>
        {/* Header */}
        <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
          <div style={styles.headerLeft}>
            <span style={styles.checkIcon}>{isConfigured ? '✅' : '⚙️'}</span>
            <span style={styles.headerTitle}>Jira Configuration</span>
          </div>
          <div style={styles.headerRight}>
            {isConfigured && (
              <span style={styles.configuredBadge}>
                Configured ({configuredEmail})
              </span>
            )}
            <span style={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Expandable config form */}
        {isExpanded && (
          <div style={styles.body}>
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>Jira Email <span style={styles.required}>*</span></label>
              <input
                type="email"
                style={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@example.com"
              />
              <span style={styles.hint}>Your Atlassian Cloud email address</span>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>API Key <span style={styles.required}>*</span></label>
              <input
                type="password"
                style={styles.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Jira API token"
              />
              <span style={styles.hint}>
                Generate from{' '}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  Atlassian API Tokens
                </a>
              </span>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Jira Base URL <span style={styles.required}>*</span></label>
              <input
                type="text"
                style={styles.input}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-domain.atlassian.net"
              />
              <span style={styles.hint}>Your Jira instance URL</span>
            </div>

            <button
              style={{
                ...styles.configureBtn,
                ...(isConfiguring ? styles.configureBtnDisabled : {})
              }}
              onClick={handleConfigure}
              disabled={isConfiguring}
            >
              {isConfiguring ? 'Configuring...' : 'Configure Jira'}
            </button>
          </div>
        )}
      </div>

      {/* Project & Story Selection - always visible below config when configured */}
      {isConfigured && (
        <div style={styles.selectionWrapper}>
          <div style={styles.selectionHeader}>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#2c3e50' }}>📋 Import from Jira</span>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGroup}>
            <label style={styles.label}>Project</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                style={{ ...styles.select, flex: 1 }}
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                disabled={isLoadingProjects}
              >
                {isLoadingProjects ? (
                  <option value="">Loading projects...</option>
                ) : projects.length === 0 ? (
                  <option value="">No projects found</option>
                ) : (
                  <>
                    <option value="">Select a project...</option>
                    {projects.map(p => (
                      <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                    ))}
                  </>
                )}
              </select>
              <button
                style={{
                  ...styles.refreshBtn,
                  ...(isLoadingProjects ? { opacity: 0.6, cursor: 'not-allowed' } : {})
                }}
                onClick={refreshProjects}
                disabled={isLoadingProjects}
                title="Refresh projects from Jira"
              >
                {isLoadingProjects ? '⏳' : '🔄'}
              </button>
            </div>
          </div>

          {isLoadingStories && (
            <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 14 }}>
              Loading user stories...
            </div>
          )}

          {!isLoadingStories && userStories.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>
                User Stories
              </label>
              <div style={styles.storiesContainer}>
                {userStories.map((story, index) => (
                  <label
                    key={story.key}
                    style={{
                      ...styles.storyRow,
                      backgroundColor: selectedStoryKeys.has(story.key) ? '#e3f2fd' : '#fff'
                    }}
                  >
                    <input
                      type="radio"
                      name="jira-story"
                      checked={selectedStoryKeys.has(story.key)}
                      onChange={() => handleStoryToggle(story.key)}
                      style={{ marginTop: 3, marginRight: 12, accentColor: '#1976d2', width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1976d2', fontSize: 13 }}>USERSTORY-{index + 1}</div>
                      <div style={{ fontSize: 14, color: '#333', marginTop: 2 }}>
                        {story.summary.substring(0, 100)}{story.summary.length > 100 ? '...' : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {story.status} · {story.priority}
                        {story.assignee && story.assignee !== 'Unassigned' ? ` · ${story.assignee}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isLoadingStories && userStories.length === 0 && selectedProject && (
            <div style={{ padding: 16, color: '#888', fontSize: 14 }}>
              No user stories found for this project.
            </div>
          )}

          <button
            style={{
              ...styles.importBtn,
              ...(selectedStoryKeys.size === 0 ? styles.importBtnDisabled : {})
            }}
            onClick={handleImportStories}
            disabled={selectedStoryKeys.size === 0}
          >
            📋 Import Selected Story
          </button>
        </div>
      )}
    </>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    border: '1px solid #c8e6c9',
    marginBottom: 24,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  checkIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#2e7d32',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  configuredBadge: {
    backgroundColor: '#00897b',
    color: 'white',
    padding: '4px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
  },
  chevron: {
    fontSize: 14,
    color: '#666',
  },
  body: {
    padding: '0 24px 24px',
  },
  error: {
    padding: '10px 14px',
    marginBottom: 16,
    borderRadius: 6,
    backgroundColor: '#ffebee',
    border: '1px solid #ef9a9a',
    color: '#c62828',
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    color: '#333',
    fontSize: 14,
  },
  required: {
    color: '#e53935',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '2px solid #e0e0e0',
    borderRadius: 6,
    fontSize: 14,
    backgroundColor: '#fafafa',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  hint: {
    display: 'block',
    marginTop: 4,
    fontSize: 12,
    color: '#888',
  },
  link: {
    color: '#1976d2',
    textDecoration: 'none',
  },
  configureBtn: {
    padding: '10px 24px',
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  configureBtnDisabled: {
    backgroundColor: '#90caf9',
    cursor: 'not-allowed',
  },
  refreshBtn: {
    padding: '8px 12px',
    backgroundColor: '#f5f5f5',
    border: '2px solid #e0e0e0',
    borderRadius: 6,
    fontSize: 18,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    lineHeight: 1,
  },
  selectionWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e0e0e0',
    padding: '24px 28px',
    marginBottom: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  selectionHeader: {
    marginBottom: 20,
  },
  select: {
    width: '100%',
    padding: 10,
    border: '2px solid #e0e0e0',
    borderRadius: 6,
    backgroundColor: '#fafafa',
    fontSize: 14,
    cursor: 'pointer',
  },
  selectedCount: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeft: '1px solid #ccc',
    color: '#666',
    fontSize: 13,
    fontWeight: 400,
  },
  storiesContainer: {
    maxHeight: 300,
    overflowY: 'auto' as const,
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  storyRow: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  importBtn: {
    padding: '10px 24px',
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  importBtnDisabled: {
    backgroundColor: '#90caf9',
    cursor: 'not-allowed',
  },
}
