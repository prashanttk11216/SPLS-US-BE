import { Response } from 'express';

// Define status codes with appropriate messages
const STATUS_CODES: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing', // WebDAV (RFC 2518)
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

// Define a type for optional metadata and response data
type ResponseMeta = Record<string, any>;
type ResponseData = Record<string, any> | any[] | null | Buffer;

// Define the send function to standardize response structure
const send = (
  res: Response,
  statusCode: number = 200,
  msg?: string,
  data: ResponseData = null,
  meta: ResponseMeta = {},
  isBuffer: boolean = false // New parameter to indicate buffer data
) => {
  // Validate status code and retrieve default message
  if (!STATUS_CODES[statusCode]) {
    throw new Error(`Invalid status code: ${statusCode}`);
  }

  // Set message to default if not provided
  const message = msg || STATUS_CODES[statusCode];

  // If isBuffer is true, send the data as a buffer
  if (isBuffer) {
    return res
      .status(statusCode)
      .header('Content-Type', 'application/pdf')
      .send(data);
  }

  // Send the response with a structured format
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300, // Define success as 2xx status
    code: statusCode,
    message,
    data,
    meta,
  });
};



export default send;
