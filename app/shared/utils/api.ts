export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(public override message: string, public status: number) {
    super(message);
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return body as T;
  } catch (_error) {
    throw new ApiError("Invalid JSON in request body", 400);
  }
}

export function createJsonResponse<T>(
  data: ApiResponse<T> | T,
  status: number = 200
): Response {
  const responseData = 'data' in (data as Record<string, unknown>) || 'error' in (data as Record<string, unknown>) || 'message' in (data as Record<string, unknown>)
    ? data as ApiResponse<T>
    : { data } as ApiResponse<T>;
    
  return new Response(JSON.stringify(responseData), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function validateEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new ApiError("Email is required", 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const emailRegex = /^\S+@\S+\.\S+$/;
  
  if (!emailRegex.test(normalizedEmail)) {
    throw new ApiError("Invalid email format", 400);
  }
  
  return normalizedEmail;
}

export function validateRequiredFields(
  data: Record<string, unknown>,
  fields: string[]
): void {
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      throw new ApiError(`${field} is required`, 400);
    }
  }
}

export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('API Error:', error);
      if (error instanceof ApiError) {
        return createErrorResponse(error.message, error.status);
      }
      return createErrorResponse('Internal server error', 500);
    }
  };
}