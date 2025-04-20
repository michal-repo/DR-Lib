// src/lib/apiClient.ts
import { getToken } from './auth';

interface ApiClientOptions extends RequestInit {
  // Add any custom options if needed in the future
}

// Define a type for the expected success/error structure if consistent
// interface ApiResponse<T = any> {
//   status: { code: number; message: string };
//   data?: T;
//   error_details?: any;
// }

const apiClient = async <T = any>(
  endpoint: string,
  options: ApiClientOptions = {},
  authenticate: boolean = false // Flag to indicate if auth header is needed
): Promise<T> => { // Return the parsed JSON body directly
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("API URL is not configured.");
  }

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && typeof options.body === 'string') { // Assuming body is stringified JSON
      headers.set('Content-Type', 'application/json');
  }

  if (authenticate) {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      // Optionally handle missing token case before making the call
      console.warn(`Attempted authenticated request to ${endpoint} without a token.`);
      // Depending on desired behavior, you might throw an error here
      // or let the API handle the 401. Letting API handle is usually fine.
    }
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  // Attempt to parse JSON regardless of status code, as errors might have JSON body
  let responseBody;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
      try {
          responseBody = await response.json();
      } catch (jsonError) {
          // Handle cases where header says JSON but body is invalid
          console.error(`Failed to parse JSON response from ${endpoint}:`, jsonError);
          // Throw a more specific error if response was not ok
          if (!response.ok) {
              throw new Error(`API Error: ${response.status} ${response.statusText} (Invalid JSON Response)`);
          }
          // If response was ok but JSON failed, maybe return null or throw?
          responseBody = null; // Or throw new Error('Invalid JSON in successful response');
      }
  } else {
      // Handle non-JSON responses (e.g., plain text, HTML error pages)
      if (!response.ok) {
          const textBody = await response.text(); // Get text for context
          console.error(`Non-JSON error response from ${endpoint}: ${textBody}`);
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      // If response is ok but not JSON, maybe return text or null?
      responseBody = await response.text(); // Or null
  }


  if (!response.ok) {
    // Throw an error object that includes the status and parsed body (if available)
    const error: any = new Error(`API Request Failed: ${response.status}`);
    error.status = response.status;
    error.responseBody = responseBody; // Attach parsed body for more context
    console.error(`API Error on ${endpoint}:`, error.status, error.responseBody);
    throw error;
  }

  // Return the parsed response body on success
  return responseBody as T;
};

export default apiClient;

