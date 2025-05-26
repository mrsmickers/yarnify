import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: 'http://localhost:3000/api/docs-json', // Path to your OpenAPI specification
    output: {
      mode: 'single',
      target: 'src/api/api-client.ts', // Output file for the generated client
      client: 'react-query', // Use react-query for hooks
      override: {
        mutator: {
          path: './src/api/axios-instance.ts', // Path to a custom axios instance
          name: 'axiosInstance', // Name of the exported axios instance
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'eslint --fix',
    },
  },
})
