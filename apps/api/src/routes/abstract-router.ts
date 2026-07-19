import { Hono } from 'hono';
import { RouteUtils } from './utils';

/**
 * Base class for all API routes.
 */
export abstract class AbstractRouter {
  protected constructor(protected routes = new Hono()) {
    this.routes.onError(RouteUtils.errorHandler);
  }

  /**
   * The group of routes exposed by this router. Created via the `register()`
   * method in the child class.
   */
  public get router(): Hono {
    return this.routes;
  }

  /**
   * Instantiate and register the route group. Define the individual routes
   * in this method on `this.routes`, then call `this.register()` in the child
   * class constructor so that routes only register once at construction.
   * @protected
   */
  protected abstract register(): void;
}
