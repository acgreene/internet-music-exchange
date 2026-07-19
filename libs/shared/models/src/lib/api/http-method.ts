/**
 * HTTP methods the API serves. Values are wire format.
 */
export enum HttpMethod {
  /**
   * Read a resource.
   */
  Get = 'GET',

  /**
   * Create a resource or invoke an action with a JSON body.
   */
  Post = 'POST',

  /**
   * Replace or update a resource with a JSON body.
   */
  Put = 'PUT',

  /**
   * Remove a resource.
   */
  Delete = 'DELETE',
}
