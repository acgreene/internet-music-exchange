import type { Context } from 'hono';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import type { AuthService, UserService } from '@ime/services';

/**
 * Who may call a route: anyone, anyone with the signed-in user known when
 * there is one, only signed-in users, or only platform admins.
 */
export type Access = 'public' | 'optional' | 'user' | 'admin';

/**
 * The caller, as far as a route's access needs to know.
 */
export interface Caller {
  userId: string | undefined;
  /** The caller's access token, for routes that act on the session itself. */
  token: string | undefined;
}

const ANONYMOUS: Caller = { userId: undefined, token: undefined };

/**
 * Works out who is calling from the bearer token, and turns away callers a
 * route's access does not allow. Services still check what the caller may do
 * with a given artist, release, or order.
 */
export class RouteGuard {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
  ) {}

  /**
   * @throws ApiError 401 when a route needs a signed-in user and the token is
   * missing or invalid, 403 when it needs an admin.
   */
  public async identify(c: Context, access: Access): Promise<Caller> {
    if (access === 'public') return ANONYMOUS;

    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;
    if (!token) {
      if (access === 'optional') return ANONYMOUS;
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Unauthorized,
        'Sign in to do that.',
      );
    }

    // an ended session on a route anyone may call is just an anonymous caller
    const user = await this.auth.getUser(token).catch((error: unknown) => {
      const ended =
        error instanceof ApiError && error.status === HttpStatus.Unauthorized;
      if (ended && access === 'optional') return null;
      throw error;
    });
    if (!user) return ANONYMOUS;
    if (access === 'admin' && !(await this.users.isAdmin(user.id))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Forbidden,
        'Admins only.',
      );
    }
    return { userId: user.id, token };
  }
}
