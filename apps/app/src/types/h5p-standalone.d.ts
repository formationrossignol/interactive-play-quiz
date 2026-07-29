declare module 'h5p-standalone' {
  export class H5P {
    constructor(element: HTMLElement, options: Record<string, unknown>);
    then<TResult = unknown>(
      onfulfilled?: ((value: unknown) => TResult | PromiseLike<TResult>) | null,
    ): Promise<TResult>;
  }

  const standalone: { H5P: typeof H5P };
  export default standalone;
}
