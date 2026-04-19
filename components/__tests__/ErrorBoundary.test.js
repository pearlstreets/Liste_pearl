import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  it('exports a React component class', () => {
    expect(ErrorBoundary).toBeDefined();
    expect(typeof ErrorBoundary).toBe('function');
    expect(ErrorBoundary.prototype.render).toBeDefined();
  });

  it('has getDerivedStateFromError static method', () => {
    expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();
    const result = ErrorBoundary.getDerivedStateFromError(new Error('test'));
    expect(result).toEqual({ hasError: true, error: expect.any(Error) });
  });

  it('initial state has no error', () => {
    const instance = new ErrorBoundary({});
    expect(instance.state.hasError).toBe(false);
    expect(instance.state.error).toBeNull();
  });

  it('componentDidCatch is defined', () => {
    const instance = new ErrorBoundary({});
    expect(typeof instance.componentDidCatch).toBe('function');
  });
});
