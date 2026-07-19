import { Logger } from '@ime/logger';

const log = new Logger('api');

// /**
//  * Respond 400 with the error message.
//  */
// export function badRequest(c: Context, message: string): Response {
//   return c.json({ error: message }, 400);
// }
//
// /**
//  * Respond 401 with the error message.
//  */
// export function unauthorized(
//   c: Context,
//   message = 'Missing bearer token',
// ): Response {
//   return c.json({ error: message }, 401);
// }
//
// /**
//  * Router-level error handler: maps thrown domain errors to contract error
//  * envelopes so route handlers never need try/catch. Unknown errors are logged
//  * and answered with a generic 500 that leaks nothing.
//  */
// export function errorHandler(error: Error, c: Context): Response {
//   if (error instanceof AuthError) {
//     return c.json(
//       { error: error.message },
//       error.status as ContentfulStatusCode,
//     );
//   }
//   if (error instanceof HTTPException) {
//     return error.getResponse();
//   }
//   log.error('Unhandled route error', error);
//   return c.json({ error: 'Internal server error' }, 500);
// }
