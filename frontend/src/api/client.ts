const API_BASE = '/api';

/**
 * Standard error response returned by the CampusRent backend.
 *
 * Some backend routes use the "message" property, while older
 * routes may use the "error" property.
 */
interface ApiErrorResponse {
  message?: string;
  error?: string;
}

/**
 * Returns the stored JWT token from localStorage.
 */
function getToken(): string | null {
  return localStorage.getItem('campusrent_token');
}

/**
 * Saves or removes the JWT token.
 *
 * @param token JWT token returned after login, or null to remove it.
 */
export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem('campusrent_token', token);
  } else {
    localStorage.removeItem('campusrent_token');
  }
}

/**
 * Executes an HTTP request to the CampusRent API.
 *
 * This function:
 * - adds the JSON Content-Type header;
 * - adds the JWT Authorization header when available;
 * - reads backend validation messages;
 * - throws an Error when the response is unsuccessful;
 * - returns the parsed JSON response.
 *
 * @param path API endpoint beginning with "/".
 * @param options Fetch configuration.
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  /*
   * Do not manually set Content-Type for FormData.
   * The browser automatically creates the multipart boundary.
   */
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorResponse: ApiErrorResponse = await response
      .json()
      .catch(() => ({
        message: `Request failed with status ${response.status}`,
      }));

    throw new Error(
      errorResponse.message ||
        errorResponse.error ||
        `Request failed with status ${response.status}`
    );
  }

  /*
   * HTTP 204 means the request succeeded but there is no response body.
   */
  if (response.status === 204) {
    return undefined as T;
  }

  /*
   * Some successful API endpoints may return an empty response body.
   */
  const responseText = await response.text();

  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

/**
 * Reusable API methods for CampusRent frontend requests.
 */
export const api = {
  get: <T>(path: string): Promise<T> =>
    request<T>(path),

  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    }),

  put: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PUT',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    }),

  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    }),

  delete: <T>(path: string): Promise<T> =>
    request<T>(path, {
      method: 'DELETE',
    }),

  upload: <T>(
    path: string,
    formData: FormData
  ): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body: formData,
    }),
};

/**
 * CampusRent user returned by authentication and profile endpoints.
 *
 * MongoDB normally returns "_id", while older JSON-backed routes
 * may return "id". Supporting both prevents frontend compatibility
 * problems during the database migration.
 */
export interface User {
  _id?: string;
  id?: number | string;

  email: string;
  first_name: string;
  last_name: string;

  phone?: string;
  bio?: string;

  role: 'student' | 'admin';

  verification_status:
    | 'pending'
    | 'verified'
    | 'rejected';

  status:
    | 'active'
    | 'suspended';

  created_at?: string;
  updated_at?: string;
}

/**
 * Rental listing returned by the listings API.
 */
export interface Listing {
  _id?: string;
  id?: number | string;

  title: string;
  category: string;
  description: string;
  rental_terms: string;

  availability:
    | 'available'
    | 'unavailable';

  images: {
    url: string;
  }[];

  owner?: {
    _id?: string;
    id?: number | string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  } | null;

  contact_hidden?: boolean;

  created_at?: string;
  updated_at?: string;
}

/**
 * Rental request created between a renter and a listing owner.
 */
export interface RentalRequest {
  _id?: string;
  id?: number | string;

  listing_id: number | string;
  renter_id: number | string;

  start_date: string;
  end_date: string;

  status:
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'cancelled'
    | 'completed';

  listing?: {
    _id?: string;
    id?: number | string;
    title: string;
    category: string;
    owner_id: number | string;
  };

  renter?: User;
  owner?: User;

  created_at?: string;
  updated_at?: string;
}

/**
 * Conversation between CampusRent users.
 */
export interface Conversation {
  _id?: string;
  id?: number | string;

  listing?: {
    _id?: string;
    id?: number | string;
    title: string;
  } | null;

  participants: {
    _id?: string;
    id?: number | string;
    first_name: string;
    last_name: string;
  }[];

  other_participant?: {
    _id?: string;
    id?: number | string;
    first_name: string;
    last_name: string;
  };

  last_message?: {
    content: string;
    created_at: string;
    sender_id: number | string;
  } | null;

  created_at?: string;
  updated_at?: string;
}

/**
 * Message inside a CampusRent conversation.
 */
export interface Message {
  _id?: string;
  id?: number | string;

  conversation_id: number | string;
  sender_id: number | string;

  content: string;

  first_name: string;
  last_name: string;

  created_at: string;
}

/**
 * Report submitted against a user or listing.
 */
export interface Report {
  _id?: string;
  id?: number | string;

  reason: string;
  details: string;
  status: string;

  reporter_name?: string;
  reported_user_name?: string;
  reported_listing_title?: string;

  created_at?: string;
  resolved_at?: string;
}