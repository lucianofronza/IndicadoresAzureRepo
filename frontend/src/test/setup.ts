import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.VITE_API_URL = 'http://localhost:8080'

// Global test setup
beforeAll(async () => {
  // Setup code that runs before all tests
})

afterAll(async () => {
  // Cleanup code that runs after all tests
})
