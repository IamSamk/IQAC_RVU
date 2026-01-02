// API Base URL Configuration
// If VITE_API_BASE_URL is not set, it defaults to '' which allows:
// 1. Local development: Vite proxies /api requests to localhost:5000
// 2. Production (Vercel): Requests go to /api relative to the domain
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

console.log('🔧 API Base URL:', API_BASE_URL || '(relative)');
