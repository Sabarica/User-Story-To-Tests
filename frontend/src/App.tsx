import { useState } from 'react'
import { generateTests, mapTestCasesToJira, checkExistingAttachments } from './api'
import { GenerateRequest, GenerateResponse, TestCase, JiraUserStory } from './types'
import { DownloadButtons } from './components/DownloadButtons'
import { JiraConfiguration } from './components/JiraConfiguration'
import { LLMModelSelector } from './components/LLMModelSelector'

function App() {
  const [formData, setFormData] = useState<GenerateRequest>({
    storyTitle: '',
    acceptanceCriteria: '',
    description: '',
    additionalInfo: ''
  })
  const [results, setResults] = useState<GenerateResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set())
  const [storiesQueue, setStoriesQueue] = useState<JiraUserStory[]>([])
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0)
  const [selectedModel, setSelectedModel] = useState<string>('llama-4-scout')
  const [clearKey, setClearKey] = useState<number>(0)
  const [importedStoryKey, setImportedStoryKey] = useState<string>('')
  const [isMapping, setIsMapping] = useState<boolean>(false)
  const [mapResult, setMapResult] = useState<{ success: boolean; message: string } | null>(null)
  const [editingTestCaseId, setEditingTestCaseId] = useState<string | null>(null)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [originalTestCase, setOriginalTestCase] = useState<TestCase | null>(null)
  const [editHistory, setEditHistory] = useState<TestCase[]>([])
  const [jiraDomain, setJiraDomain] = useState<string>('')
  const [mappedToJira, setMappedToJira] = useState<boolean>(false)
  const [showMapModeDialog, setShowMapModeDialog] = useState<boolean>(false)
  const [editWarnings, setEditWarnings] = useState<string[]>([])

  const handleRemoveTestCase = (testCaseId: string) => {
    setRemoveConfirmId(testCaseId)
  }

  const confirmRemoveTestCase = () => {
    if (!results || !removeConfirmId) return
    const updatedCases = results.cases.filter(tc => tc.id !== removeConfirmId)
    setResults({ ...results, cases: updatedCases })
    if (editingTestCaseId === removeConfirmId) setEditingTestCaseId(null)
    const newExpanded = new Set(expandedTestCases)
    newExpanded.delete(removeConfirmId)
    setExpandedTestCases(newExpanded)
    setRemoveConfirmId(null)
  }

  const handleRefreshTestCaseIds = () => {
    if (!results) return
    const refreshedCases = results.cases.map((tc, index) => ({
      ...tc,
      id: `TC-${String(index + 1).padStart(3, '0')}`
    }))
    setResults({ ...results, cases: refreshedCases })
    setExpandedTestCases(new Set())
    setEditingTestCaseId(null)
  }

  const handleEditTestCase = (testCaseId: string) => {
    if (editingTestCaseId === testCaseId) {
      setEditingTestCaseId(null)
      setEditWarnings([])
    } else {
      if (results) {
        const tc = results.cases.find(c => c.id === testCaseId)
        if (tc) {
          setOriginalTestCase({ ...tc, steps: [...tc.steps] })
          setEditHistory([])
        }
      }
      setEditingTestCaseId(testCaseId)
      setEditWarnings([])
      if (!expandedTestCases.has(testCaseId)) {
        toggleTestCaseExpansion(testCaseId)
      }
    }
  }

  /** Compute edit warnings by comparing current state to original */
  const computeEditWarnings = (testCaseId: string, field: keyof TestCase, value: string | string[]): string[] => {
    if (!results || !originalTestCase) return []
    const warnings: string[] = []
    const tc = results.cases.find(c => c.id === testCaseId)
    if (!tc) return []

    // Use the incoming value for the changed field, current state for others
    const currentPriority = field === 'priority' ? (value as string) : tc.priority
    const currentTestData = field === 'testData' ? (value as string) : (tc.testData || '')
    const currentSteps = field === 'steps' ? (value as string[]) : tc.steps
    const currentCategory = field === 'category' ? (value as string) : tc.category

    // Category change warning
    const origCategory = originalTestCase.category
    if (origCategory !== currentCategory) {
      if (origCategory === 'Authorization') {
        warnings.push(`Category changed from Authorization to ${currentCategory} — ensure security test coverage is maintained.`)
      } else if (origCategory === 'Negative' && currentCategory === 'Positive') {
        warnings.push(`Category changed from Negative to Positive — ensure negative test scenarios are still covered.`)
      } else if (currentCategory === 'Edge') {
        warnings.push(`Category changed to Edge — confirm this test targets boundary conditions.`)
      } else {
        warnings.push(`Category changed from ${origCategory} to ${currentCategory} — verify this aligns with the test objective.`)
      }
    }

    // Priority change warning
    const origPriority = originalTestCase.priority
    if (origPriority === 'High' && currentPriority === 'Low') {
      warnings.push(`Priority downgraded from High to Low — this was originally a High priority test case. Please verify this change is intentional.`)
    } else if (origPriority === 'High' && currentPriority === 'Medium') {
      warnings.push(`Priority changed from High to Medium — ensure this test case doesn't cover critical functionality.`)
    } else if (origPriority === 'Low' && currentPriority === 'High') {
      warnings.push(`Priority upgraded from Low to High — confirm this test case covers critical acceptance criteria.`)
    }

    // Test data warning
    const origTestData = originalTestCase.testData || ''
    if (origTestData.trim() && !currentTestData.trim()) {
      warnings.push(`Test data has been cleared — test cases without test data may be incomplete or difficult to execute.`)
    } else if (origTestData.trim() && currentTestData.trim() && currentTestData.trim().length < origTestData.trim().length * 0.3) {
      warnings.push(`Test data has been significantly reduced — ensure the remaining data is sufficient for test execution.`)
    }

    // Steps warning
    if (currentSteps.length <= 1) {
      warnings.push(`Only ${currentSteps.length} step remaining — a test case typically needs multiple steps for proper validation.`)
    } else if (currentSteps.length === 2 && originalTestCase.steps.length > 3) {
      warnings.push(`Steps reduced from ${originalTestCase.steps.length} to ${currentSteps.length} — verify that the remaining steps provide adequate test coverage.`)
    }

    // Empty step warning
    const emptySteps = currentSteps.filter(s => !s.trim()).length
    if (emptySteps > 0) {
      warnings.push(`${emptySteps} empty step(s) detected — fill in all steps before saving.`)
    }

    return warnings
  }

  const handleUpdateTestCase = (testCaseId: string, field: keyof TestCase, value: string | string[]) => {
    if (!results) return
    const currentTc = results.cases.find(c => c.id === testCaseId)
    if (currentTc) {
      setEditHistory(prev => [...prev, { ...currentTc, steps: [...currentTc.steps] }])
    }
    const updatedCases = results.cases.map(tc =>
      tc.id === testCaseId ? { ...tc, [field]: value } : tc
    )
    setResults({ ...results, cases: updatedCases })
    setEditWarnings(computeEditWarnings(testCaseId, field, value))
  }

  const handleCancelEdit = () => {
    if (!results || !editingTestCaseId || !originalTestCase) {
      setEditingTestCaseId(null)
      return
    }
    const restoredCases = results.cases.map(tc =>
      tc.id === editingTestCaseId ? { ...originalTestCase, steps: [...originalTestCase.steps] } : tc
    )
    setResults({ ...results, cases: restoredCases })
    const newExpanded = new Set(expandedTestCases)
    newExpanded.delete(editingTestCaseId)
    setExpandedTestCases(newExpanded)
    setEditingTestCaseId(null)
    setOriginalTestCase(null)
    setEditHistory([])
    setEditWarnings([])
  }

  const handleUndoEdit = () => {
    if (!results || !editingTestCaseId || editHistory.length === 0) return
    const previousState = editHistory[editHistory.length - 1]
    const updatedCases = results.cases.map(tc =>
      tc.id === editingTestCaseId ? { ...previousState, steps: [...previousState.steps] } : tc
    )
    setResults({ ...results, cases: updatedCases })
    setEditHistory(prev => prev.slice(0, -1))
    // Recompute warnings for the restored state
    if (originalTestCase) {
      const warnings: string[] = []
      // Category warnings
      const cat = previousState.category
      const ocat = originalTestCase.category
      if (ocat !== cat) {
        if (ocat === 'Authorization') warnings.push(`Category changed from Authorization to ${cat} — ensure security test coverage is maintained.`)
        else if (ocat === 'Negative' && cat === 'Positive') warnings.push('Category changed from Negative to Positive — ensure negative test scenarios are still covered.')
        else if (cat === 'Edge') warnings.push('Category changed to Edge — confirm this test targets boundary conditions.')
        else warnings.push(`Category changed from ${ocat} to ${cat} — verify this aligns with the test objective.`)
      }
      // Priority warnings
      const p = previousState.priority
      const op = originalTestCase.priority
      if (op === 'High' && p === 'Low') warnings.push('Priority downgraded from High to Low — this was originally a High priority test case. Please verify this change is intentional.')
      else if (op === 'High' && p === 'Medium') warnings.push('Priority changed from High to Medium — ensure this test case doesn\'t cover critical functionality.')
      const td = previousState.testData || ''
      const otd = originalTestCase.testData || ''
      if (otd.trim() && !td.trim()) warnings.push('Test data has been cleared — test cases without test data may be incomplete or difficult to execute.')
      if (previousState.steps.length <= 1) warnings.push(`Only ${previousState.steps.length} step remaining — a test case typically needs multiple steps for proper validation.`)
      const empty = previousState.steps.filter(s => !s.trim()).length
      if (empty > 0) warnings.push(`${empty} empty step(s) detected — fill in all steps before saving.`)
      setEditWarnings(warnings)
    }
  }

  const handleAddStep = (testCaseId: string) => {
    if (!results) return
    const tc = results.cases.find(c => c.id === testCaseId)
    if (!tc) return
    handleUpdateTestCase(testCaseId, 'steps', [...tc.steps, ''])
  }

  const handleRemoveStep = (testCaseId: string, stepIndex: number) => {
    if (!results) return
    const tc = results.cases.find(c => c.id === testCaseId)
    if (!tc || tc.steps.length <= 1) return
    handleUpdateTestCase(testCaseId, 'steps', tc.steps.filter((_, i) => i !== stepIndex))
  }

  const handleUpdateStep = (testCaseId: string, stepIndex: number, value: string) => {
    if (!results) return
    const tc = results.cases.find(c => c.id === testCaseId)
    if (!tc) return
    const newSteps = [...tc.steps]
    newSteps[stepIndex] = value
    handleUpdateTestCase(testCaseId, 'steps', newSteps)
  }

  const handleClearAll = () => {
    setFormData({ storyTitle: '', acceptanceCriteria: '', description: '', additionalInfo: '' })
    setResults(null)
    setError(null)
    setExpandedTestCases(new Set())
    setStoriesQueue([])
    setCurrentStoryIndex(0)
    setSelectedModel('llama-4-scout')
    setClearKey(prev => prev + 1)
    setImportedStoryKey('')
    setMapResult(null)
    setEditingTestCaseId(null)
    setRemoveConfirmId(null)
    setJiraDomain('')
    setMappedToJira(false)
    setShowMapModeDialog(false)
    setEditWarnings([])
  }

  const toggleTestCaseExpansion = (testCaseId: string) => {
    const newExpanded = new Set(expandedTestCases)
    if (newExpanded.has(testCaseId)) {
      newExpanded.delete(testCaseId)
    } else {
      newExpanded.add(testCaseId)
    }
    setExpandedTestCases(newExpanded)
  }

  const handleInputChange = (field: keyof GenerateRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleJiraStoryImport = (story: JiraUserStory) => {
    setImportedStoryKey(story.key)
    setFormData(prev => ({
      ...prev,
      storyTitle: story.summary,
      description: story.description,
      acceptanceCriteria: `Status: ${story.status}\nPriority: ${story.priority}\nAssignee: ${story.assignee}`
    }))
    setError(null)
  }

  const handleJiraStoriesImport = (stories: JiraUserStory[]) => {
    if (stories.length === 0) return
    
    setStoriesQueue(stories)
    setCurrentStoryIndex(0)
    setFormData({
      storyTitle: stories[0].summary,
      description: stories[0].description,
      acceptanceCriteria: `Status: ${stories[0].status}\nPriority: ${stories[0].priority}\nAssignee: ${stories[0].assignee}`
    })
    setError(null)
  }

  const handleNextStory = () => {
    if (currentStoryIndex < storiesQueue.length - 1) {
      const nextIndex = currentStoryIndex + 1
      const nextStory = storiesQueue[nextIndex]
      setCurrentStoryIndex(nextIndex)
      setFormData({
        storyTitle: nextStory.summary,
        description: nextStory.description,
        acceptanceCriteria: `Status: ${nextStory.status}\nPriority: ${nextStory.priority}\nAssignee: ${nextStory.assignee}`
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.storyTitle.trim() || !formData.acceptanceCriteria.trim()) {
      setError('Story Title and Acceptance Criteria are required')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await generateTests(formData)
      setResults(response)
      setMappedToJira(false)
      setMapResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tests')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMapToJira = async () => {
    if (!results || !importedStoryKey) return
    // Check if issue already has test case attachments
    const hasExisting = await checkExistingAttachments(importedStoryKey)
    if (hasExisting) {
      setShowMapModeDialog(true)
    } else {
      // First-time mapping — directly map without asking
      handleMapWithMode('overwrite')
    }
  }

  const handleMapWithMode = async (mode: 'overwrite' | 'version') => {
    if (!results || !importedStoryKey) return
    setShowMapModeDialog(false)
    setIsMapping(true)
    setMapResult(null)
    const result = await mapTestCasesToJira(importedStoryKey, results.cases, mode)
    setMapResult(result)
    setIsMapping(false)
    if (result.success) {
      setMappedToJira(true)
      if (result.jiraBaseUrl) {
        setJiraDomain(result.jiraBaseUrl)
      }
    }
  }

  return (
    <div>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background-color: #f5f5f5;
          color: #333;
          line-height: 1.6;
        }
        
        .container {
          max-width: 95%;
          width: 100%;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }
        
        @media (min-width: 768px) {
          .container {
            max-width: 90%;
            padding: 30px;
          }
        }
        
        @media (min-width: 1024px) {
          .container {
            max-width: 85%;
            padding: 40px;
          }
        }
        
        @media (min-width: 1440px) {
          .container {
            max-width: 1800px;
            padding: 50px;
          }
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .title {
          font-size: 2.5rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .subtitle {
          color: #666;
          font-size: 1.1rem;
        }
        
        .form-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        
        .form-input, .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e1e8ed;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .form-input:focus, .form-textarea:focus {
          outline: none;
          border-color: #3498db;
        }
        
        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }
        
        .submit-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .submit-btn:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .submit-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        
        .error-banner {
          background: #e74c3c;
          color: white;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 18px;
        }
        
        .results-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .results-header {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e8ed;
        }
        
        .results-title {
          font-size: 1.8rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .results-meta {
          color: #666;
          font-size: 14px;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .results-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        
        .results-table th,
        .results-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e1e8ed;
        }
        
        .results-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .results-table tr:hover {
          background: #f8f9fa;
        }
        
        .category-positive { color: #27ae60; font-weight: 600; }
        .category-negative { color: #e74c3c; font-weight: 600; }
        .category-edge { color: #f39c12; font-weight: 600; }
        .category-authorization { color: #9b59b6; font-weight: 600; }
        .category-non-functional { color: #34495e; font-weight: 600; }
        
        .priority-high { color: #e74c3c; font-weight: 600; background: #ffe0e0; padding: 4px 8px; border-radius: 4px; display: inline-block; }
        .priority-medium { color: #f39c12; font-weight: 600; background: #fff5e6; padding: 4px 8px; border-radius: 4px; display: inline-block; }
        .priority-low { color: #27ae60; font-weight: 600; background: #e8f8f5; padding: 4px 8px; border-radius: 4px; display: inline-block; }
        
        .test-case-id {
          cursor: pointer;
          color: #3498db;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 4px;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .test-case-id:hover {
          background: #f8f9fa;
        }
        
        .test-case-id.expanded {
          background: #e3f2fd;
          color: #1976d2;
        }
        
        .expand-icon {
          font-size: 10px;
          transition: transform 0.2s;
        }
        
        .expand-icon.expanded {
          transform: rotate(90deg);
        }
        
        .expanded-details {
          margin-top: 15px;
          background: #fafbfc;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 20px;
        }
        
        .step-item {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .step-header {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          align-items: start;
        }
        
        .step-id {
          font-weight: 600;
          color: #2c3e50;
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          text-align: center;
          font-size: 12px;
        }
        
        .step-description {
          color: #2c3e50;
          line-height: 1.5;
        }
        
        .step-test-data {
          color: #666;
          font-style: italic;
          font-size: 14px;
        }
        
        .step-expected {
          color: #27ae60;
          font-weight: 500;
          font-size: 14px;
        }
        
        .step-labels {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 10px;
          font-weight: 600;
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
      
      <div className="container">
        <div className="header">
          <h1 className="title">User Story to Tests</h1>
          <p className="subtitle">Generate comprehensive test cases from your user stories</p>
        </div>
        
        <JiraConfiguration 
          onStorySelected={handleJiraStoryImport}
          onStoriesSelected={handleJiraStoriesImport}
          clearKey={clearKey}
          onDomainConfigured={setJiraDomain}
        />
        
        <LLMModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
        
        <form onSubmit={handleSubmit} className="form-container">
          {storiesQueue.length > 0 && (
            <div style={{
              backgroundColor: '#e3f2fd',
              border: '1px solid #90caf9',
              borderRadius: '6px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ color: '#1565c0', fontSize: '14px', fontWeight: '500' }}>
                📋 Story {currentStoryIndex + 1} of {storiesQueue.length}: {storiesQueue[currentStoryIndex].key}
              </div>
              <button
                type="button"
                onClick={handleNextStory}
                disabled={currentStoryIndex >= storiesQueue.length - 1}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentStoryIndex >= storiesQueue.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  opacity: currentStoryIndex >= storiesQueue.length - 1 ? 0.5 : 1
                }}
              >
                Next Story →
              </button>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="storyTitle" className="form-label">
              Story Title *
            </label>
            <input
              type="text"
              id="storyTitle"
              className="form-input"
              value={formData.storyTitle}
              onChange={(e) => handleInputChange('storyTitle', e.target.value)}
              placeholder="Enter the user story title..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              className="form-textarea"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Additional description (optional)..."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="acceptanceCriteria" className="form-label">
              Acceptance Criteria *
            </label>
            <textarea
              id="acceptanceCriteria"
              className="form-textarea"
              value={formData.acceptanceCriteria}
              onChange={(e) => handleInputChange('acceptanceCriteria', e.target.value)}
              placeholder="Enter the acceptance criteria..."
              required
            />
          </div>
          
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                padding: '12px 24px',
                borderRadius: 6,
                border: '2px solid #e74c3c',
                backgroundColor: '#fff',
                color: '#e74c3c',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e74c3c'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#e74c3c' }}
            >
              🗑️ Clear
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading}
              style={{ flex: 1 }}
            >
              {isLoading ? '⏳ Generating Test Cases...' : '🚀 Generate Test Cases'}
            </button>
          </div>
        </form>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="loading">
            Generating test cases...
          </div>
        )}

        {results && (
          <div className="results-container">
            <div className="results-header">
              <h2 className="results-title">Generated Test Cases</h2>
              <div className="results-meta">
                {results.cases.length} test case(s) generated
                {results.model && ` • Model: ${results.model}`}
                {results.promptTokens > 0 && ` • Tokens: ${results.promptTokens + results.completionTokens}`}
              </div>
            </div>
            
            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Test Case ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Expected Result</th>
                    <th style={{width: '180px', textAlign: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
                        Actions
                        <button
                          onClick={handleRefreshTestCaseIds}
                          title="Refresh test case IDs to sequential order"
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: '1px solid #3498db',
                            backgroundColor: '#fff',
                            color: '#3498db',
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          🔄
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.cases.map((testCase: TestCase) => (
                    <>
                      <tr key={testCase.id}>
                        <td>
                          <div 
                            className={`test-case-id ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}
                            onClick={() => toggleTestCaseExpansion(testCase.id)}
                          >
                            <span className={`expand-icon ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}>
                              ▶
                            </span>
                            {testCase.id}
                          </div>
                        </td>
                        <td>{testCase.title}</td>
                        <td>
                          <span className={`category-${testCase.category.toLowerCase()}`}>
                            {testCase.category}
                          </span>
                        </td>
                        <td>
                          <span className={`priority-${testCase.priority.toLowerCase()}`}>
                            {testCase.priority}
                          </span>
                        </td>
                        <td>{testCase.expectedResult}</td>
                        <td style={{textAlign: 'center', verticalAlign: 'middle'}}>
                          <div style={{display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center'}}>
                            <button
                              onClick={() => handleEditTestCase(testCase.id)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 4,
                                border: editingTestCaseId === testCase.id ? '2px solid #e74c3c' : '2px solid #3498db',
                                backgroundColor: '#fff',
                                color: editingTestCaseId === testCase.id ? '#e74c3c' : '#3498db',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {editingTestCaseId === testCase.id ? '✕ Close' : '✏️ Edit'}
                            </button>
                            <button
                              onClick={() => handleRemoveTestCase(testCase.id)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 4,
                                border: '2px solid #e74c3c',
                                backgroundColor: '#fff',
                                color: '#e74c3c',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedTestCases.has(testCase.id) && (
                        <tr key={`${testCase.id}-details`}>
                          <td colSpan={6}>
                            <div className="expanded-details">
                              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e1e8ed'}}>
                                <div>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Category</p>
                                  {editingTestCaseId === testCase.id ? (
                                    <select
                                      value={testCase.category}
                                      onChange={(e) => handleUpdateTestCase(testCase.id, 'category', e.target.value)}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: 4,
                                        border: '2px solid #3498db',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <option value="Positive">Positive</option>
                                      <option value="Negative">Negative</option>
                                      <option value="Edge">Edge</option>
                                      <option value="Authorization">Authorization</option>
                                      <option value="Non-Functional">Non-Functional</option>
                                    </select>
                                  ) : (
                                    <span className={`category-${testCase.category.toLowerCase()}`}>{testCase.category}</span>
                                  )}
                                </div>
                                <div>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Priority</p>
                                  {editingTestCaseId === testCase.id ? (
                                    <select
                                      value={testCase.priority}
                                      onChange={(e) => handleUpdateTestCase(testCase.id, 'priority', e.target.value)}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: 4,
                                        border: '2px solid #3498db',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <option value="High">High</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Low">Low</option>
                                    </select>
                                  ) : (
                                    <span className={`priority-${testCase.priority.toLowerCase()}`}>{testCase.priority}</span>
                                  )}
                                </div>
                                <div>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Test Data</p>
                                  {editingTestCaseId === testCase.id ? (
                                    <textarea
                                      value={testCase.testData || ''}
                                      onChange={(e) => handleUpdateTestCase(testCase.id, 'testData', e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: 4,
                                        border: '2px solid #3498db',
                                        fontSize: 14,
                                        resize: 'vertical',
                                        minHeight: 60,
                                      }}
                                    />
                                  ) : (
                                    <span style={{color: '#2c3e50', fontStyle: 'italic'}}>{testCase.testData || 'N/A'}</span>
                                  )}
                                </div>
                              </div>

                              {editingTestCaseId === testCase.id && (
                                <div style={{marginBottom: '15px'}}>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Expected Result</p>
                                  <textarea
                                    value={testCase.expectedResult}
                                    onChange={(e) => handleUpdateTestCase(testCase.id, 'expectedResult', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      borderRadius: 4,
                                      border: '2px solid #3498db',
                                      fontSize: 14,
                                      resize: 'vertical',
                                      minHeight: 50,
                                      marginBottom: 15,
                                    }}
                                  />
                                </div>
                              )}

                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                                <h4 style={{color: '#2c3e50'}}>Test Steps for {testCase.id}</h4>
                                {editingTestCaseId === testCase.id && (
                                  <button
                                    onClick={() => handleAddStep(testCase.id)}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: 4,
                                      border: '2px solid #27ae60',
                                      backgroundColor: '#fff',
                                      color: '#27ae60',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    + Add Step
                                  </button>
                                )}
                              </div>
                              <div className="step-labels">
                                <div>Step ID</div>
                                <div>Step Description</div>
                                <div>Test Data</div>
                                <div>{editingTestCaseId === testCase.id ? 'Actions' : 'Expected Result'}</div>
                              </div>
                              {testCase.steps.map((step, index) => (
                                <div key={index} className="step-item">
                                  <div className="step-header">
                                    <div className="step-id">S{String(index + 1).padStart(2, '0')}</div>
                                    {editingTestCaseId === testCase.id ? (
                                      <>
                                        <div>
                                          <input
                                            type="text"
                                            value={step}
                                            onChange={(e) => handleUpdateStep(testCase.id, index, e.target.value)}
                                            style={{
                                              width: '100%',
                                              padding: '8px',
                                              borderRadius: 4,
                                              border: '2px solid #3498db',
                                              fontSize: 14,
                                            }}
                                            placeholder="Enter step description..."
                                          />
                                        </div>
                                        <div className="step-test-data">{testCase.testData || 'N/A'}</div>
                                        <div>
                                          <button
                                            onClick={() => handleRemoveStep(testCase.id, index)}
                                            disabled={testCase.steps.length <= 1}
                                            style={{
                                              padding: '6px 12px',
                                              borderRadius: 4,
                                              border: '2px solid #e74c3c',
                                              backgroundColor: '#fff',
                                              color: '#e74c3c',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              cursor: testCase.steps.length <= 1 ? 'not-allowed' : 'pointer',
                                              opacity: testCase.steps.length <= 1 ? 0.4 : 1,
                                            }}
                                          >
                                            🗑️ Remove
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="step-description">{step}</div>
                                        <div className="step-test-data">{testCase.testData || 'N/A'}</div>
                                        <div className="step-expected">
                                          {index === testCase.steps.length - 1 ? testCase.expectedResult : 'Step completed successfully'}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {editingTestCaseId === testCase.id && editWarnings.length > 0 && (
                                <div style={{
                                  marginTop: 14,
                                  padding: '14px 16px',
                                  backgroundColor: '#fff8e1',
                                  border: '1px solid #ffe082',
                                  borderLeft: '4px solid #f9a825',
                                  borderRadius: 6,
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: editWarnings.length > 1 ? 8 : 0 }}>
                                    <span style={{ fontSize: 16 }}>⚠️</span>
                                    <strong style={{ fontSize: 13, color: '#e65100', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      {editWarnings.length === 1 ? 'Suggestion' : `${editWarnings.length} Suggestions`}
                                    </strong>
                                  </div>
                                  {editWarnings.map((w, i) => (
                                    <div key={i} style={{ fontSize: 13, color: '#5d4037', lineHeight: 1.6, paddingLeft: 24, marginTop: i === 0 ? 4 : 6 }}>
                                      • {w}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {editingTestCaseId === testCase.id && (
                                <div style={{marginTop: 16, paddingTop: 16, borderTop: '1px solid #e1e8ed', display: 'flex', justifyContent: 'flex-end', gap: 10}}>
                                  <button
                                    onClick={handleCancelEdit}
                                    style={{
                                      padding: '8px 20px',
                                      borderRadius: 6,
                                      border: '2px solid #e0e0e0',
                                      backgroundColor: '#fff',
                                      color: '#666',
                                      fontSize: 14,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✕ Cancel
                                  </button>
                                  <button
                                    onClick={handleUndoEdit}
                                    disabled={editHistory.length === 0}
                                    style={{
                                      padding: '8px 20px',
                                      borderRadius: 6,
                                      border: '2px solid #f39c12',
                                      backgroundColor: '#fff',
                                      color: '#f39c12',
                                      fontSize: 14,
                                      fontWeight: 600,
                                      cursor: editHistory.length === 0 ? 'not-allowed' : 'pointer',
                                      opacity: editHistory.length === 0 ? 0.4 : 1,
                                    }}
                                  >
                                    ↩ Undo
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingTestCaseId(null)
                                      setOriginalTestCase(null)
                                      setEditHistory([])
                                      setEditWarnings([])
                                      const newExpanded = new Set(expandedTestCases)
                                      newExpanded.delete(testCase.id)
                                      setExpandedTestCases(newExpanded)
                                    }}
                                    style={{
                                      padding: '8px 20px',
                                      borderRadius: 6,
                                      border: 'none',
                                      backgroundColor: '#27ae60',
                                      color: '#fff',
                                      fontSize: 14,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✓ Done Editing
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{
              marginTop: 24,
              padding: '20px 24px',
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
              borderTop: '3px solid #3498db',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}>
                {/* Left: Export buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: '#2c3e50', fontSize: 14, whiteSpace: 'nowrap' }}>📥 Export:</span>
                  <DownloadButtons results={results} storyTitle={formData.storyTitle} />
                </div>

                {/* Right: JIRA actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {importedStoryKey && !mappedToJira && (
                    <button
                      onClick={handleMapToJira}
                      disabled={isMapping}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: isMapping ? '#90caf9' : '#1976d2',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isMapping ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      title="Attach generated test cases as an Excel file to the Jira user story"
                    >
                      {isMapping ? '⏳ Mapping...' : '📋 Map to JIRA'}
                    </button>
                  )}
                  {mappedToJira && importedStoryKey && jiraDomain && (
                    <button
                      onClick={() => {
                        const base = jiraDomain.replace(/\/+$/, '')
                        const url = `${base}/browse/${importedStoryKey}`
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 6,
                        border: '2px solid #0052CC',
                        backgroundColor: '#0052CC',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      title="Open this user story in Jira to view the attached test cases"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0747A6' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0052CC' }}
                    >
                      🔗 View in JIRA
                    </button>
                  )}
                </div>
              </div>

              {mapResult && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <span style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    backgroundColor: mapResult.success ? '#e8f5e9' : '#ffebee',
                    color: mapResult.success ? '#2e7d32' : '#c62828',
                    fontSize: 13,
                    fontWeight: 500,
                    border: `1px solid ${mapResult.success ? '#c8e6c9' : '#ef9a9a'}`,
                    display: 'inline-block',
                  }}>
                    {mapResult.success ? '✅' : '❌'} {mapResult.message}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remove Test Case Confirmation Dialog */}
        {removeConfirmId && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: '32px 36px',
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2c3e50', marginBottom: 12 }}>
                ⚠️ Confirm Removal
              </div>
              <div style={{ fontSize: 15, color: '#555', marginBottom: removeConfirmId && results?.cases.find(tc => tc.id === removeConfirmId)?.priority === 'High' ? 12 : 24 }}>
                Are you sure you want to remove the Test Case <strong style={{ color: '#e74c3c' }}>{removeConfirmId}</strong>?
              </div>
              {removeConfirmId && results?.cases.find(tc => tc.id === removeConfirmId)?.priority === 'High' && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#fff3e0',
                  border: '1px solid #ffe0b2',
                  borderLeft: '4px solid #e65100',
                  borderRadius: 6,
                  marginBottom: 20,
                  fontSize: 13,
                  color: '#bf360c',
                  lineHeight: 1.6,
                }}>
                  ⚠️ <strong>This is a High priority test case</strong> — removing it may reduce coverage of critical acceptance criteria.
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setRemoveConfirmId(null)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 6,
                    border: '2px solid #e0e0e0',
                    backgroundColor: '#fff',
                    color: '#666',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  No
                </button>
                <button
                  onClick={confirmRemoveTestCase}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#e74c3c',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Map Mode Selection Dialog */}
        {showMapModeDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              padding: '36px 40px 32px',
              maxWidth: 480,
              width: '92%',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2c3e50' }}>
                  Map Test Cases to JIRA
                </div>
              </div>
              <div style={{ fontSize: 15, color: '#555', marginBottom: 28, lineHeight: 1.7, textAlign: 'center' }}>
                Should the test cases be <strong style={{ color: '#e67e22' }}>overwritten</strong> or should we maintain a <strong style={{ color: '#1976d2' }}>version history</strong>?
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button
                  onClick={() => handleMapWithMode('overwrite')}
                  style={{
                    padding: '14px 20px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#e67e22',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flex: 1,
                    transition: 'background-color 0.2s',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d35400' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e67e22' }}
                >
                  🔄 Overwrite
                </button>
                <button
                  onClick={() => handleMapWithMode('version')}
                  style={{
                    padding: '14px 20px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flex: 1,
                    transition: 'background-color 0.2s',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1565c0' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1976d2' }}
                >
                  📚 Version History
                </button>
              </div>
              <button
                onClick={() => setShowMapModeDialog(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 8,
                  border: '2px solid #e0e0e0',
                  backgroundColor: '#fff',
                  color: '#888',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#bbb'; e.currentTarget.style.color = '#555' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#888' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App