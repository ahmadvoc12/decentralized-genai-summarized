import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom Metrics
export const authLatency = new Trend('auth_latency_ms');
export const llmLatency = new Trend('llm_inference_latency_ms');
export const podWriteLatency = new Trend('pod_write_latency_ms');
export const totalLatency = new Trend('total_request_latency_ms');
export const successfulRequests = new Counter('successful_requests');

// Baca jumlah VU dari environment variable (default: 1)
const TARGET_VUS = parseInt(__ENV.VUS || '1', 10);
const DURATION = __ENV.DURATION || '2m';

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: TARGET_VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    total_request_latency_ms: ['p(95)<5000'],
    llm_inference_latency_ms: ['p(95)<4000'],
    http_req_failed: ['rate<0.01'], // Maksimal 1% error
  },
};

const baseUrl = 'http://localhost:3000';

export default function () {
  // Simulasi pertumbuhan data: payload membesar seiring iterasi
  const historySize = Math.floor(Math.random() * 40) + 10;
  const mockHistory = [];
  for (let i = 0; i < historySize; i++) {
    mockHistory.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Mock history message ${i} from VU ${__VU}`
    });
  }

  const payload = JSON.stringify({
    messages: [
      ...mockHistory,
      { role: 'user', content: `Test from VU ${__VU} iter ${__ITER}` }
    ],
    provider: 'deepseek',
    model: 'deepseek/deepseek-chat:free',
    stream: false,
    sessionId: `session-${__VU}`
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const startTime = Date.now();
  const res = http.post(`${baseUrl}/api/chatAPI`, payload, params);
  const totalTime = Date.now() - startTime;

  check(res, {
    'Status is 200': (r) => r.status === 200,
  });

  if (res.status === 200) {
    successfulRequests.add(1);
    authLatency.add(parseFloat(res.headers['X-Timing-Auth'] || 0));
    llmLatency.add(parseFloat(res.headers['X-Timing-LLM'] || 0));
    podWriteLatency.add(parseFloat(res.headers['X-Timing-PodWrite'] || 0));
    totalLatency.add(totalTime);
  }

  sleep(Math.random() * 2 + 1);
}