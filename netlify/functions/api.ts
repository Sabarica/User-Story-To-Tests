import serverless from 'serverless-http'
import app from '../../backend/src/app'

export const handler = serverless(app, {
  request: (request: any) => {
    // Netlify redirect strips /api prefix via /:splat; re-add it for Express routing
    if (request.url && !request.url.startsWith('/api')) {
      request.url = '/api' + request.url
    }
  }
})
