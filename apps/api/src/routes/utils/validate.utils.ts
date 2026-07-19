/**
 * Parses and validates the JSON body against the Zod schema you pass in.
 * On failure, bypasses the route and returns a bad request response.
 * On success, passes the parsed, typed body to the route.
 */
// export function validateJson<T extends z.ZodType>(schema: T) {
//   return zValidator('json', schema, (result, c) => {
//     if (!result.success) {
//       return badRequest(c, 'Invalid request body');
//     }
//     return undefined;
//   });
// }
