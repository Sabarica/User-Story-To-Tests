import app from './app'

// Debug environment variables
console.log('Environment variables loaded:')
console.log(`PORT: ${process.env.PORT}`)
console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN}`)
console.log(`groq_API_BASE: ${process.env.groq_API_BASE}`)
console.log(`groq_API_KEY: ${process.env.groq_API_KEY ? 'SET' : 'NOT SET'}`)
console.log(`groq_MODEL: ${process.env.groq_MODEL}`)

const PORT = process.env.PORT || 8080

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found'
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`)
  console.log(`📡 API available at http://localhost:${PORT}/api`)
  console.log(`🔍 Health check at http://localhost:${PORT}/api/health`)
  console.log(`🔌 Jira API at http://localhost:${PORT}/api/jira`)
  console.log(`   - Projects: http://localhost:${PORT}/api/jira/projects`)
  console.log(`   - User Stories: http://localhost:${PORT}/api/jira/userstories?projectKey=PROJECT_KEY`)
  console.log(`   - Test Connection: http://localhost:${PORT}/api/jira/test-connection`)
})