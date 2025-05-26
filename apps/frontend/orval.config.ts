import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: 'http://localhost:3000/api/docs-json', // Path to your OpenAPI specification
    output: {
      mode: 'single',
      target: '../api/api-client.ts', // Output file for the generated client
      client: 'react-query', // Use react-query for hooks
      override: {
        mutator: { path: './src/api/axios-instance.ts', name: 'axiosInstance' }, // Path to a custom axios instance
        query: {
          usePrefetch: false,
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'nextId',
          signal: true,
        },
      },
    },
  },
})
