import axios from 'axios';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: import.meta.env.MODE === 'test' ? 750 : 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});
