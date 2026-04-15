import { useState } from 'react'
import { generateTests } from './api'
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

  const handleClearAll = () => {
    setFormData({ storyTitle: '', acceptanceCriteria: '', description: '', additionalInfo: '' })
    setResults(null)
    setError(null)
    setExpandedTestCases(new Set())
    setStoriesQueue([])
    setCurrentStoryIndex(0)
    setSelectedModel('llama-4-scout')
    setClearKey(prev => prev + 1)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tests')
    } finally {
      setIsLoading(false)
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
          
          <div style={{ display: 'flex', gap: 12 }}>
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
                      </tr>
                      {expandedTestCases.has(testCase.id) && (
                        <tr key={`${testCase.id}-details`}>
                          <td colSpan={5}>
                            <div className="expanded-details">
                              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e1e8ed'}}>
                                <div>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Category</p>
                                  <span className={`category-${testCase.category.toLowerCase()}`}>{testCase.category}</span>
                                </div>
                                <div>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Priority</p>
                                  <span className={`priority-${testCase.priority.toLowerCase()}`}>{testCase.priority}</span>
                                </div>
                                <div>
                                  <p style={{color: '#666', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px'}}>Test Data</p>
                                  <span style={{color: '#2c3e50', fontStyle: 'italic'}}>{testCase.testData || 'N/A'}</span>
                                </div>
                              </div>
                              <h4 style={{marginBottom: '15px', color: '#2c3e50'}}>Test Steps for {testCase.id}</h4>
                              <div className="step-labels">
                                <div>Step ID</div>
                                <div>Step Description</div>
                                <div>Test Data</div>
                                <div>Expected Result</div>
                              </div>
                              {testCase.steps.map((step, index) => (
                                <div key={index} className="step-item">
                                  <div className="step-header">
                                    <div className="step-id">S{String(index + 1).padStart(2, '0')}</div>
                                    <div className="step-description">{step}</div>
                                    <div className="step-test-data">{testCase.testData || 'N/A'}</div>
                                    <div className="step-expected">
                                      {index === testCase.steps.length - 1 ? testCase.expectedResult : 'Step completed successfully'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            
            <DownloadButtons results={results} storyTitle={formData.storyTitle} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App