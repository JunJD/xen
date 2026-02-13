export {};

type PyodideGlobals = {
  get: (name: string) => unknown;
};

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage?: (packages: string[] | string) => Promise<unknown>;
  globals?: PyodideGlobals;
};

type LoadPyodideOptions = {
  indexURL?: string;
  fullStdLib?: boolean;
};

declare global {
  function loadPyodide(options?: LoadPyodideOptions): Promise<PyodideInterface>;
}

declare module 'pyodide' {
  export function loadPyodide(options?: LoadPyodideOptions): Promise<PyodideInterface>;
}
