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
   * Set a whole value, such as a price or an order, with a JSON body.
   */
  Put = 'PUT',

  /**
   * Change part of a resource with a JSON body.
   */
  Patch = 'PATCH',

  /**
   * Remove a resource.
   */
  Delete = 'DELETE',
}
