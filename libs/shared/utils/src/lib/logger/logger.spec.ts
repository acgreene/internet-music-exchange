import { Logger, LogLevel } from './logger';

describe('Logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs with the level and scope in the line', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    new Logger('api').error('database unreachable');

    expect(errorSpy).toHaveBeenCalledOnce();
    const line = errorSpy.mock.calls[0][0] as string;
    expect(line).toContain('[error]');
    expect(line).toContain('[api]');
    expect(line).toContain('database unreachable');
  });

  it('drops messages below the minimum level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    new Logger('api', LogLevel.Info).debug('noise');

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('passes extra details through to the console', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    new Logger('api').info('listening', { port: 3000 });

    expect(infoSpy).toHaveBeenCalledWith(expect.any(String), { port: 3000 });
  });

  it('child loggers extend the scope', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    new Logger('api').child('db').warn('slow query');

    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toContain('[api:db]');
  });
});
