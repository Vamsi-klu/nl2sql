declare module 'sql.js' {
  const init: (opts?: { locateFile?: (file: string) => string }) => Promise<any>;
  export default init;
}

