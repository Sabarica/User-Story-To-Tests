import { useState, useEffect } from 'react'
import { fetchJiraProjects, fetchUserStories, testJiraConnection } from '../api'
import { JiraProject, JiraUserStory } from '../types'

interface JiraSelectorProps {
  onStorySelected: (story: JiraUserStory) => void
  onStoriesSelected?: (stories: JiraUserStory[]) => void
  onLoadingChange: (isLoading: boolean) => void
}

export function JiraSelector({ onStorySelected, onStoriesSelected, onLoadingChange }: JiraSelectorProps) {
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [userStories, setUserStories] = useState<JiraUserStory[]>([])
  const [selectedStoryKeys, setSelectedStoryKeys] = useState<Set<string>>(new Set())
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingStories, setIsLoadingStories] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [multiSelectMode, setMultiSelectMode] = useState(true)

  // Test connection and load projects on mount
  useEffect(() => {
    const initializeJira = async () => {
      try {
        setConnectionStatus('🔄 Testing Jira connection...')
        const connResult = await testJiraConnection()
        
        if (connResult.success) {
          setConnectionStatus('✅ Connected to Jira')
          
          setIsLoadingProjects(true)
          setConnectionStatus('📥 Loading projects...')
          const loadedProjects = await fetchJiraProjects()
          setProjects(loadedProjects)
          
          if (loadedProjects.length > 0) {
            setSelectedProject(loadedProjects[0].key)
            setConnectionStatus('✅ Ready')
          }
        } else {
          setConnectionStatus('⚠️ ' + connResult.message)
        }
      } catch (err) {
        setError('Failed to initialize Jira: ' + (err instanceof Error ? err.message : String(err)))
        setConnectionStatus('❌ Connection failed')
      } finally {
        setIsLoadingProjects(false)
        onLoadingChange(false)
      }
    }

    initializeJira()
  }, [onLoadingChange])

  // Load user stories when project changes
  useEffect(() => {
    const loadStories = async () => {
      if (!selectedProject) return

      try {
        setIsLoadingStories(true)
        setUserStories([])
        setSelectedStoryKeys(new Set())
        setError('')
        
        const response = await fetchUserStories(selectedProject)
        setUserStories(response.userStories)
      } catch (err) {
        setError('Failed to load user stories: ' + (err instanceof Error ? err.message : String(err)))
      } finally {
        setIsLoadingStories(false)
      }
    }

    loadStories()
  }, [selectedProject])

  // Handle story checkbox toggle
  const handleStoryToggle = (storyKey: string) => {
    const newSelection = new Set(selectedStoryKeys)
    if (newSelection.has(storyKey)) {
      newSelection.delete(storyKey)
    } else {
      if (!multiSelectMode) {
        newSelection.clear()
      }
      newSelection.add(storyKey)
    }
    setSelectedStoryKeys(newSelection)
  }

  // Handle story import (single or bulk)
  const handleImportStories = () => {
    if (selectedStoryKeys.size === 0) return

    const selectedStories = userStories.filter(s => selectedStoryKeys.has(s.key))
    
    if (multiSelectMode && onStoriesSelected) {
      // Bulk import
      onStoriesSelected(selectedStories)
    } else if (selectedStories.length > 0) {
      // Single import
      onStorySelected(selectedStories[0])
    }
  }

  // Remove a selected story
  const handleRemoveStory = (storyKey: string) => {
    const newSelection = new Set(selectedStoryKeys)
    newSelection.delete(storyKey)
    setSelectedStoryKeys(newSelection)
  }


  const selectedStories = userStories.filter(s => selectedStoryKeys.has(s.key))

  const styles = {
    container: {
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #dee2e6'
    },
    title: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '15px',
      color: '#333',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    } as React.CSSProperties,
    modeToggle: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    } as React.CSSProperties,
    modeButton: {
      padding: '6px 12px',
      fontSize: '12px',
      borderRadius: '4px',
      border: '1px solid #ddd',
      backgroundColor: '#fff',
      cursor: 'pointer',
      transition: 'all 0.2s'
    } as React.CSSProperties,
    modeButtonActive: {
      backgroundColor: '#007bff',
      color: 'white',
      borderColor: '#0056b3'
    } as React.CSSProperties,
    status: {
      padding: '10px',
      marginBottom: '15px',
      borderRadius: '4px',
      fontSize: '14px',
      backgroundColor: '#e7f3ff',
      border: '1px solid #b3d9ff',
      color: '#004085'
    },
    formGroup: {
      marginBottom: '15px'
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '500',
      color: '#333',
      fontSize: '14px'
    },
    select: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff',
      color: '#333',
      fontSize: '14px',
      fontFamily: 'inherit',
      cursor: 'pointer'
    },
    storiesContainer: {
      marginTop: '15px',
      maxHeight: '300px',
      overflowY: 'auto' as const,
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff'
    },
    storyCheckbox: {
      display: 'flex',
      alignItems: 'flex-start',
      padding: '12px',
      borderBottom: '1px solid #eee',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    } as React.CSSProperties,
    storyCheckboxInput: {
      marginTop: '4px',
      marginRight: '12px',
      cursor: 'pointer',
      accentColor: '#007bff'
    } as React.CSSProperties,
    storyCheckboxLabel: {
      flex: 1,
      cursor: 'pointer'
    } as React.CSSProperties,
    storyKey: {
      fontWeight: '600',
      color: '#007bff',
      fontSize: '13px'
    },
    storySummary: {
      fontSize: '14px',
      color: '#333',
      marginTop: '4px'
    },
    button: {
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'background-color 0.2s',
      marginRight: '10px'
    } as React.CSSProperties,
    buttonDisabled: {
      backgroundColor: '#6c757d',
      cursor: 'not-allowed'
    } as React.CSSProperties,
    selectedCount: {
      display: 'inline-block',
      marginLeft: '10px',
      paddingLeft: '10px',
      borderLeft: '1px solid #ddd',
      color: '#666',
      fontSize: '14px'
    },
    error: {
      padding: '10px',
      marginBottom: '15px',
      borderRadius: '4px',
      backgroundColor: '#f8d7da',
      border: '1px solid #f5c6cb',
      color: '#721c24',
      fontSize: '14px'
    },
    selectedStoriesSection: {
      padding: '15px',
      backgroundColor: '#fff',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      marginTop: '15px'
    },
    selectedStoriesList: {
      marginTop: '10px'
    },
    selectedStoryItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'start',
      padding: '10px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginBottom: '8px'
    } as React.CSSProperties,
    selectedStoryInfo: {
      flex: 1
    } as React.CSSProperties,
    selectedStoryTitle: {
      fontWeight: '600',
      color: '#333',
      fontSize: '13px'
    },
    selectedStoryKey: {
      color: '#007bff',
      fontSize: '12px',
      marginTop: '2px'
    },
    removeButton: {
      padding: '4px 8px',
      backgroundColor: '#dc3545',
      color: 'white',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '12px',
      marginLeft: '10px'
    } as React.CSSProperties
  }


  return (
    <div style={styles.container}>
      <div style={styles.title}>
        🔗 Import from Jira
        <div style={styles.modeToggle}>
          <span style={{ fontSize: '12px', color: '#666' }}>Mode:</span>
          <button
            style={{
              ...styles.modeButton,
              ...(multiSelectMode ? styles.modeButtonActive : {})
            }}
            onClick={() => {
              setMultiSelectMode(true)
              setSelectedStoryKeys(new Set())
            }}
          >
            📋 Multi-Select
          </button>
          <button
            style={{
              ...styles.modeButton,
              ...(!multiSelectMode ? styles.modeButtonActive : {})
            }}
            onClick={() => {
              setMultiSelectMode(false)
              setSelectedStoryKeys(new Set())
            }}
          >
            ✓ Single Select
          </button>
        </div>
      </div>
      
      {connectionStatus && (
        <div style={styles.status}>{connectionStatus}</div>
      )}

      {error && (
        <div style={styles.error}>❌ {error}</div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Project</label>
        <select
          style={styles.select}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          disabled={isLoadingProjects || projects.length === 0}
        >
          <option value="">Select a project...</option>
          {projects.map(project => (
            <option key={project.key} value={project.key}>
              {project.name} ({project.key})
            </option>
          ))}
        </select>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>
          User Stories {isLoadingStories && '(Loading...)'}
          {selectedStoryKeys.size > 0 && (
            <span style={styles.selectedCount}>
              {selectedStoryKeys.size} selected
            </span>
          )}
        </label>
        
        {userStories.length > 0 && (
          <div style={styles.storiesContainer}>
            {userStories.map(story => (
              <label
                key={story.key}
                style={{
                  ...styles.storyCheckbox,
                  backgroundColor: selectedStoryKeys.has(story.key) ? '#e7f3ff' : '#fff'
                }}
              >
                <input
                  type="checkbox"
                  style={styles.storyCheckboxInput}
                  checked={selectedStoryKeys.has(story.key)}
                  onChange={() => handleStoryToggle(story.key)}
                />
                <div style={styles.storyCheckboxLabel}>
                  <div style={styles.storyKey}>{story.key}</div>
                  <div style={styles.storySummary}>
                    {story.summary.substring(0, 70)}
                    {story.summary.length > 70 ? '...' : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {!isLoadingStories && userStories.length === 0 && selectedProject && (
          <div style={{ padding: '10px', color: '#666', fontSize: '14px' }}>
            No user stories found for this project
          </div>
        )}
      </div>

      <button
        style={{
          ...styles.button,
          ...(selectedStoryKeys.size === 0 || isLoadingStories ? styles.buttonDisabled : {})
        }}
        onClick={handleImportStories}
        disabled={selectedStoryKeys.size === 0 || isLoadingStories}
        onMouseEnter={(e) => {
          if (!(selectedStoryKeys.size === 0 || isLoadingStories)) {
            e.currentTarget.style.backgroundColor = '#0056b3'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#007bff'
        }}
      >
        {multiSelectMode ? '📋 Import Selected Stories' : '📋 Import Story Details'}
      </button>

      {selectedStories.length > 0 && (
        <div style={styles.selectedStoriesSection}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#333' }}>
            ✓ Selected ({selectedStories.length})
          </div>
          <div style={styles.selectedStoriesList}>
            {selectedStories.map(story => (
              <div key={story.key} style={styles.selectedStoryItem}>
                <div style={styles.selectedStoryInfo}>
                  <div style={styles.selectedStoryTitle}>{story.summary}</div>
                  <div style={styles.selectedStoryKey}>{story.key}</div>
                </div>
                <button
                  style={styles.removeButton}
                  onClick={() => handleRemoveStory(story.key)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c82333'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc3545'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
